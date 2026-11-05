import { Db, Queryable, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, normalizePhone } from "./service";
import { ALL_SCOPE, Scope, scopeArgs } from "./scope";

// Müşteriler: randevulardan türetilen kayıtlar + müşteri profilleri (ad, e-posta, fotoğraf vb.).
// Anahtar telefon numarasıdır. Üye yalnızca kendi randevularında geçen müşterileri görür.

export interface CustomerRow {
  phone: string;
  name: string;
  email: string;
  photo: string | null;
  total: number;
  lastStartsAt: string | null;
  nextStartsAt: string | null;
}

export async function listCustomers(db: Db, tenantId: string, scope: Scope = ALL_SCOPE): Promise<CustomerRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      `WITH agg AS (
         SELECT customer_phone AS phone,
                (array_agg(customer_name ORDER BY starts_at DESC))[1] AS name,
                count(*)::int AS total,
                max(starts_at) FILTER (WHERE starts_at <= now() AND status IN ('onaylandi', 'tamamlandi', 'gelmedi')) AS last_at,
                min(starts_at) FILTER (WHERE starts_at > now() AND status = 'onaylandi') AS next_at
         FROM appointments
         WHERE ($1::boolean OR staff_id = $2)
         GROUP BY customer_phone
       )
       SELECT agg.phone, COALESCE(NULLIF(p.name, ''), agg.name) AS name, COALESCE(p.email, '') AS email, p.photo,
              agg.total, agg.last_at, agg.next_at
       FROM agg LEFT JOIN customer_profiles p ON p.customer_phone = agg.phone
       UNION ALL
       SELECT p.customer_phone, p.name, p.email, p.photo, 0, NULL, NULL
       FROM customer_profiles p
       WHERE $1::boolean AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.customer_phone = p.customer_phone)
       ORDER BY last_at DESC NULLS LAST, name
       LIMIT 300`,
      scopeArgs(scope),
    );
    return r.rows.map((x) => ({
      phone: String(x.phone),
      name: String(x.name ?? ""),
      email: String(x.email ?? ""),
      photo: x.photo ? String(x.photo) : null,
      total: Number(x.total),
      lastStartsAt: x.last_at ? new Date(x.last_at as string).toISOString() : null,
      nextStartsAt: x.next_at ? new Date(x.next_at as string).toISOString() : null,
    }));
  });
}

export interface CustomerHistoryItem { id: string; serviceName: string; startsAt: string; status: string; staffId: string | null }

export interface CustomerDetail {
  phone: string;
  name: string;
  email: string;
  birthDate: string | null;
  gender: string;
  photo: string | null;
  createdAt: string | null;
  note: string;
  history: CustomerHistoryItem[];
}

// Müşteri, kapsamdaki randevular arasında yoksa (üye için) ya da hiç kaydı yoksa görünmez.
async function visibleTo(tx: Queryable, phone: string, scope: Scope): Promise<boolean> {
  if (scope.all) return true;
  const r = await tx.query("SELECT 1 FROM appointments WHERE customer_phone = $1 AND staff_id = $2 LIMIT 1", [phone, scope.staffId]);
  return r.rows.length > 0;
}

export async function getCustomerDetail(db: Db, tenantId: string, phone: string, scope: Scope = ALL_SCOPE): Promise<CustomerDetail | null> {
  if (!/^\d{10,15}$/.test(phone)) return null;
  return withTenant(db, tenantId, async (tx): Promise<CustomerDetail | null> => {
    if (!(await visibleTo(tx, phone, scope))) return null;
    const p = await tx.query<Record<string, unknown>>(
      "SELECT name, email, birth_date::text AS birth_date, gender, photo, created_at::text AS created_at FROM customer_profiles WHERE customer_phone = $1",
      [phone],
    );
    const n = await tx.query<{ note: string }>("SELECT note FROM customer_notes WHERE customer_phone = $1", [phone]);
    const h = await tx.query<Record<string, unknown>>(
      `SELECT id, service_name, starts_at, status, staff_id, customer_name FROM appointments
       WHERE customer_phone = $1 AND ($2::boolean OR staff_id = $3) ORDER BY starts_at DESC LIMIT 200`,
      [phone, ...scopeArgs(scope)],
    );
    const first = await tx.query<{ n: string | null }>("SELECT min(created_at)::text AS n FROM appointments WHERE customer_phone = $1", [phone]);
    const prof = p.rows[0];
    // Ne profili ne de görünür randevusu olan kayıt, müşteri sayılmaz.
    if (!prof && h.rows.length === 0) return null;
    return {
      phone,
      name: String(prof?.name || h.rows[0]?.customer_name || ""),
      email: String(prof?.email ?? ""),
      birthDate: prof?.birth_date ? String(prof.birth_date) : null,
      gender: String(prof?.gender ?? ""),
      photo: prof?.photo ? String(prof.photo) : null,
      createdAt: (prof?.created_at ? String(prof.created_at) : first.rows[0]?.n) ?? null,
      note: n.rows[0]?.note ?? "",
      history: h.rows.map((x) => ({
        id: String(x.id),
        serviceName: String(x.service_name),
        startsAt: new Date(x.starts_at as string).toISOString(),
        status: String(x.status),
        staffId: x.staff_id ? String(x.staff_id) : null,
      })),
    };
  });
}

const GENDERS = ["", "kadin", "erkek", "belirtilmemis"] as const;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

// Profil güncelleme: gönderilen tüm alanlar yazılır. Fotoğraf boş ya da null ise kaldırılır.
export async function saveCustomerProfile(db: Db, tenantId: string, phone: string, raw: unknown, actor?: string, scope: Scope = ALL_SCOPE): Promise<void> {
  if (!/^\d{10,15}$/.test(phone)) throw new AppError(422, "validation", ["phone"]);
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const email = typeof b.email === "string" ? b.email.trim().slice(0, 254) : "";
  const birth = typeof b.birthDate === "string" && b.birthDate ? b.birthDate : null;
  const gender = typeof b.gender === "string" ? b.gender : "";
  const photo = typeof b.photo === "string" && b.photo ? b.photo : null;
  const bad: string[] = [];
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push("email");
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) bad.push("birthDate");
  if (!(GENDERS as readonly string[]).includes(gender)) bad.push("gender");
  if (photo && !PHOTO_RE.test(photo)) bad.push("photo");
  if (photo && photo.length > 200000) bad.push("photo");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    if (!(await visibleTo(tx, phone, scope))) throw new AppError(404, "not_found");
    await tx.query(
      `INSERT INTO customer_profiles (tenant_id, customer_phone, name, email, birth_date, gender, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, customer_phone) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
         birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender, photo = EXCLUDED.photo`,
      [tenantId, phone, name, email, birth, gender, photo],
    );
    await audit(tx, tenantId, actor, "customer.profile", phone, { photo: Boolean(photo) });
  });
}

// Manuel müşteri ekleme (randevusuz kayıt).
export async function createCustomer(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<string> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const phone = normalizePhone(b.phone);
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (!phone) bad.push("phone");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO customer_profiles (tenant_id, customer_phone, name) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, customer_phone) DO UPDATE SET name = EXCLUDED.name`,
      [tenantId, phone, name],
    );
    await audit(tx, tenantId, actor, "customer.create", phone, {});
  });
  return phone!;
}

export async function getCustomerNote(db: Db, tenantId: string, phone: string, scope: Scope = ALL_SCOPE): Promise<string> {
  return withTenant(db, tenantId, async (tx) => {
    if (!(await visibleTo(tx, phone, scope))) return "";
    const r = await tx.query<{ note: string }>("SELECT note FROM customer_notes WHERE customer_phone = $1", [phone]);
    return r.rows[0]?.note ?? "";
  });
}

export async function saveCustomerNote(db: Db, tenantId: string, phone: string, raw: unknown, actor?: string, scope: Scope = ALL_SCOPE): Promise<void> {
  if (!/^\d{10,15}$/.test(phone)) throw new AppError(422, "validation", ["phone"]);
  const note = typeof raw === "string" ? raw.slice(0, 2000) : null;
  if (note === null) throw new AppError(422, "validation", ["note"]);
  await withTenant(db, tenantId, async (tx) => {
    if (!(await visibleTo(tx, phone, scope))) throw new AppError(404, "not_found");
    await tx.query(
      `INSERT INTO customer_notes (tenant_id, customer_phone, note, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (tenant_id, customer_phone) DO UPDATE SET note = EXCLUDED.note, updated_at = now()`,
      [tenantId, phone, note],
    );
    await audit(tx, tenantId, actor, "customer.note", phone, { length: note.length });
  });
}


// Müşteri kaydını siler: profil bilgileri ve not kaldırılır. Randevu geçmişi korunur (silinmez).
export async function deleteCustomerRecord(db: Db, tenantId: string, phone: string, actor?: string): Promise<void> {
  if (!/^\d{10,15}$/.test(phone)) throw new AppError(422, "validation", ["phone"]);
  await withTenant(db, tenantId, async (tx) => {
    const p = await tx.query("DELETE FROM customer_profiles WHERE customer_phone = $1 RETURNING 1", [phone]);
    const n = await tx.query("DELETE FROM customer_notes WHERE customer_phone = $1 RETURNING 1", [phone]);
    if (!p.rows.length && !n.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "customer.delete", phone, {});
  });
}

// İki müşteriyi birleştirir: `from` numarasındaki randevular, hatırlatmalar ve profil `into` numarasına taşınır.
export async function mergeCustomers(db: Db, tenantId: string, from: string, into: string, actor?: string): Promise<void> {
  if (!/^\d{10,15}$/.test(from) || !/^\d{10,15}$/.test(into) || from === into) throw new AppError(422, "validation", ["phone"]);
  await withTenant(db, tenantId, async (tx) => {
    const target = await tx.query("SELECT 1 FROM appointments WHERE customer_phone = $1 UNION SELECT 1 FROM customer_profiles WHERE customer_phone = $1", [into]);
    if (!target.rows.length) throw new AppError(404, "not_found");
    const moved = await tx.query("UPDATE appointments SET customer_phone = $2 WHERE customer_phone = $1 RETURNING 1", [from, into]);
    await tx.query("UPDATE reminder_messages SET to_phone = $2 WHERE to_phone = $1", [from, into]);
    // Hedef profil boşsa kaynak profil bilgileri alınır.
    await tx.query(`
      UPDATE customer_profiles t SET name = CASE WHEN t.name = '' THEN s.name ELSE t.name END,
        email = CASE WHEN t.email = '' THEN s.email ELSE t.email END,
        birth_date = COALESCE(t.birth_date, s.birth_date),
        gender = CASE WHEN t.gender = '' THEN s.gender ELSE t.gender END,
        photo = COALESCE(t.photo, s.photo)
      FROM customer_profiles s WHERE t.customer_phone = $2 AND s.customer_phone = $1`, [from, into]);
    await tx.query("DELETE FROM customer_profiles WHERE customer_phone = $1", [from]);
    await tx.query(`
      INSERT INTO customer_notes (tenant_id, customer_phone, note, updated_at)
      SELECT tenant_id, $2, note, now() FROM customer_notes WHERE customer_phone = $1 AND note <> ''
      ON CONFLICT (tenant_id, customer_phone) DO UPDATE SET note = CASE WHEN customer_notes.note = '' THEN EXCLUDED.note ELSE customer_notes.note END, updated_at = now()`, [from, into]);
    await tx.query("DELETE FROM customer_notes WHERE customer_phone = $1", [from]);
    await audit(tx, tenantId, actor, "customer.merge", into, { from, moved: moved.rows.length });
  });
}

// Integration tests on a real PostgreSQL engine (PGlite, WASM).
// The app role is NOT a superuser and is not the table owner, so RLS is enforced
// exactly as it would be in production. Run with: npm test
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { confirmPasswordReset, createUser, currentUser, login, logout, membershipRole, requestPasswordReset, signup } from "../src/lib/auth";
import { assertSameOrigin, clientIp } from "../src/lib/security";
import { Db, Queryable, withTenant } from "../src/lib/db";
import { AppError } from "../src/lib/errors";
import { cancelAppointment, createAppointment, getSlots, listAppointments } from "../src/lib/appointments";
import { SECTOR_KEYS, SECTORS } from "../src/lib/sectors";
import { getBookingPage, listSectorListings } from "../src/lib/booking-public";
import { addService, addStaff, listServices, listStaff, saveProfile } from "../src/lib/workspace";
import { applySchema } from "../src/db/migrate";
import { audit, getTenant, listAudit } from "../src/lib/service";

async function createTestDb(): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite();
  const db: Db = {
    exec: async (sql) => {
      await pg.exec(sql);
    },
    transaction: (fn) =>
      pg.transaction(async (tx) => {
        // Every application transaction runs as the restricted app role.
        await tx.exec("SET LOCAL ROLE app_user");
        const q: Queryable = {
          query: async <R>(sql: string, params?: unknown[]) => ({ rows: (await tx.query<R>(sql, params)).rows }),
        };
        return fn(q);
      }),
  };
  await applySchema(db);
  await pg.exec(`
    CREATE ROLE app_user NOLOGIN;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  `);
  return { db, pg };
}

async function seedTenant(db: Db, id: string, name: string) {
  await db.transaction((tx) =>
    tx.query("INSERT INTO tenants (id, name, city, plan) VALUES ($1, $2, 'Test', 'pro')", [id, name]),
  );
}

async function expectAppError(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof AppError, `AppError bekleniyordu, gelen: ${String(err)}`);
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}


let db: Db;
let pg: PGlite;
const TA = "t-a";
const TB = "t-b";

async function setup() {
  ({ db, pg } = await createTestDb());
  await seedTenant(db, TA, "Salon A");
  await seedTenant(db, TB, "Salon B");
}

const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

test("auth: login succeeds with the right password and fails otherwise", async () => {
  await createUser(db, "Owner@Example.com", "güçlü-şifre-1");
  const ok = await login(db, "owner@example.com", "güçlü-şifre-1");
  assert.ok(ok.token.length > 30);
  await expectAppError(login(db, "owner@example.com", "yanlış"), 401, "invalid_credentials");
  await expectAppError(login(db, "yok@example.com", "herhangi"), 401, "invalid_credentials");
});

test("auth: session token is resolvable, stored only as a hash, and revocable", async () => {
  await createUser(db, "staff@example.com", "şifre-123456");
  const { token, userId } = await login(db, "staff@example.com", "şifre-123456");
  assert.equal((await currentUser(db, token))?.id, userId);
  const raw = await db.transaction((tx) => tx.query<{ token_hash: string }>("SELECT token_hash FROM sessions"));
  assert.ok(raw.rows.every((r) => r.token_hash !== token), "düz token veritabanında olmamalı");
  await logout(db, token);
  assert.equal(await currentUser(db, token), null);
});

test("authz: membership is required; a user of tenant A is not a member of tenant B", async () => {
  const userId = await createUser(db, "a-owner@example.com", "şifre-abc-123");
  await db.transaction((tx) =>
    tx.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [TA, userId]),
  );
  assert.equal(await membershipRole(db, userId, TA), "owner");
  assert.equal(await membershipRole(db, userId, TB), null);
});

test("login: 5 failures lock the account, even with the right password", async () => {
  await createUser(db, "lock@example.com", "dogru-sifre-123");
  for (let i = 0; i < 5; i++) {
    await expectAppError(login(db, "lock@example.com", "yanlis-sifre", "ip-lock-1"), 401, "invalid_credentials");
  }
  await expectAppError(login(db, "lock@example.com", "dogru-sifre-123", "ip-lock-1"), 429, "too_many_attempts");
});

test("login: a success clears the email failure counter", async () => {
  await createUser(db, "reset-count@example.com", "dogru-sifre-456");
  for (let i = 0; i < 3; i++) await expectAppError(login(db, "reset-count@example.com", "x", "ip-cnt-1"), 401, "invalid_credentials");
  await login(db, "reset-count@example.com", "dogru-sifre-456", "ip-cnt-1");
  for (let i = 0; i < 3; i++) await expectAppError(login(db, "reset-count@example.com", "x", "ip-cnt-2"), 401, "invalid_credentials");
  await login(db, "reset-count@example.com", "dogru-sifre-456", "ip-cnt-2");
});

test("signup: creates a tenant with the user as owner and rejects duplicates", async () => {
  const r = await signup(db, { email: "yeni@ornek.com", password: "cok-guclu-sifre", tenantName: "Yeni Salon", city: "Bursa", sector: "sac-makyaj" }, "ip-su-1");
  assert.equal(await membershipRole(db, r.userId, r.tenantId), "owner");
  assert.ok((await currentUser(db, r.token))?.id === r.userId);
  await expectAppError(
    signup(db, { email: "yeni@ornek.com", password: "cok-guclu-sifre", tenantName: "Başka", city: "Bursa", sector: "sac-makyaj" }, "ip-su-2"),
    409,
    "email_taken",
  );
});

test("signup: weak password and bad fields are rejected", async () => {
  await expectAppError(
    signup(db, { email: "zayif@ornek.com", password: "kisa", tenantName: "Salon", city: "Bursa", sector: "sac-makyaj" }, "ip-su-3"),
    422,
    "validation",
  );
  await expectAppError(
    signup(db, { email: "gecersiz", password: "cok-guclu-sifre", tenantName: "Salon", city: "Bursa", sector: "sac-makyaj" }, "ip-su-4"),
    422,
    "validation",
  );
});

test("signup: repeated attempts from one IP are throttled", async () => {
  for (let i = 0; i < 5; i++) {
    await expectAppError(
      signup(db, { email: `spam${i}@ornek.com`, password: "kisa", tenantName: "Salon", city: "Bursa", sector: "sac-makyaj" }, "ip-spam"),
      422,
      "validation",
    );
  }
  await expectAppError(
    signup(db, { email: "spam9@ornek.com", password: "cok-guclu-sifre", tenantName: "Salon", city: "Bursa", sector: "sac-makyaj" }, "ip-spam"),
    429,
    "too_many_attempts",
  );
});

test("reset: unknown email is silent and queues nothing", async () => {
  const before = await db.transaction((tx) => tx.query<{ n: string }>("SELECT count(*)::text AS n FROM email_outbox"));
  await requestPasswordReset(db, "yok-boyle-biri@ornek.com", "http://localhost:3000");
  const after = await db.transaction((tx) => tx.query<{ n: string }>("SELECT count(*)::text AS n FROM email_outbox"));
  assert.equal(after.rows[0].n, before.rows[0].n);
});

test("reset: token is single-use, revokes sessions, and the new password works", async () => {
  await createUser(db, "sifre-sifirla@example.com", "eski-sifre-1234");
  const { token: sess } = await login(db, "sifre-sifirla@example.com", "eski-sifre-1234", "ip-rs-1");
  await requestPasswordReset(db, "sifre-sifirla@example.com", "http://localhost:3000");
  const mail = await db.transaction((tx) => tx.query<{ body: string }>("SELECT body FROM email_outbox WHERE to_address = 'sifre-sifirla@example.com'"));
  const token = /token=([A-Za-z0-9_-]+)/.exec(mail.rows[0].body)?.[1];
  assert.ok(token, "e-postada jeton olmalı");

  await confirmPasswordReset(db, token, "yeni-sifre-12345");
  assert.equal(await currentUser(db, sess), null, "eski oturum iptal edilmeli");
  await expectAppError(confirmPasswordReset(db, token, "baska-sifre-123"), 422, "invalid_token");
  await login(db, "sifre-sifirla@example.com", "yeni-sifre-12345", "ip-rs-2");
  await expectAppError(login(db, "sifre-sifirla@example.com", "eski-sifre-1234", "ip-rs-3"), 401, "invalid_credentials");
});

test("reset: an expired token is rejected", async () => {
  await createUser(db, "suresi@example.com", "eski-sifre-999x");
  await requestPasswordReset(db, "suresi@example.com", "http://localhost:3000");
  const mail = await db.transaction((tx) => tx.query<{ body: string }>("SELECT body FROM email_outbox WHERE to_address = 'suresi@example.com'"));
  const token = /token=([A-Za-z0-9_-]+)/.exec(mail.rows[0].body)![1];
  await db.transaction((tx) => tx.query("UPDATE password_resets SET expires_at = now() - interval '1 minute'"));
  await expectAppError(confirmPasswordReset(db, token, "yeni-sifre-999x"), 422, "invalid_token");
});

test("audit: updates and deletes are rejected by the database, even for the app role", async () => {
  // Silme ve güncelleme yalnızca satır varken tetiklenir; önce bir denetim satırı yazılır.
  await withTenant(db, TA, (tx) => audit(tx, TA, undefined, "seed.test", null));
  await assert.rejects(
    withTenant(db, TA, (tx) => tx.query("DELETE FROM audit_events")),
    /append-only/i,
  );
  await assert.rejects(
    withTenant(db, TA, (tx) => tx.query("UPDATE audit_events SET action = 'tahrif'")),
    /append-only/i,
  );
});

test("csrf: mutations need JSON and a same-origin Origin header", async () => {
  const mk = (method: string, headers: Record<string, string>) => new Request("http://app.test/api/x", { method, headers });
  assertSameOrigin(mk("GET", {}));
  assertSameOrigin(mk("POST", { "content-type": "application/json", host: "app.test", origin: "http://app.test" }));
  assert.throws(() => assertSameOrigin(mk("POST", { "content-type": "application/json", host: "app.test", origin: "https://kotu.example" })), (e: unknown) => e instanceof AppError && e.status === 403);
  assert.throws(() => assertSameOrigin(mk("POST", { "content-type": "text/plain", host: "app.test" })), (e: unknown) => e instanceof AppError && e.status === 415);
});

test("transactions: a failing change leaves no half-written audit line", async () => {
  const before = (await listAudit(db, TA)).length;
  await assert.rejects(
    withTenant(db, TA, async (tx) => {
      await audit(tx, TA, "x", "deneme.islem", null, {});
      throw new Error("işlem bozuldu");
    }),
  );
  assert.equal((await listAudit(db, TA)).length, before, "başarısız işlemin denetim satırı kalmamalı");
});

test("security: client IP headers are ignored unless TRUST_PROXY=1", async () => {
  const req = new Request("http://app.test/x", { headers: { "x-real-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8" } });
  delete process.env.TRUST_PROXY;
  assert.equal(clientIp(req), null, "spoofable başlıklara güvenilmemeli");
  process.env.TRUST_PROXY = "1";
  assert.equal(clientIp(req), "8.8.8.8");
  delete process.env.TRUST_PROXY;
});

// ---------- Çekirdek veri kuralları ----------
test("RLS: services are visible only to their own tenant; without context nothing is visible", async () => {
  await withTenant(db, TA, (tx) => tx.query("INSERT INTO services (id, tenant_id, name, duration_min) VALUES ('rls-a', $1, 'Saç kesimi', 60)", [TA]));
  assert.equal((await listServices(db, TB)).length, 0);
  assert.equal((await listServices(db, TA)).length, 1);
  const none = await db.transaction((tx) => tx.query<{ n: string }>("SELECT count(*)::text AS n FROM services"));
  assert.equal(none.rows[0].n, "0", "kiracı bağlamı yokken satır dönmemeli");
});

test("RLS: a tenant cannot insert a service for another tenant", async () => {
  await assert.rejects(
    withTenant(db, TA, (tx) => tx.query("INSERT INTO services (id, tenant_id, name, duration_min) VALUES ('rls-x', $1, 'Kaçak', 30)", [TB])),
  );
});

test("workspace: services and staff are tenant-scoped and validated", async () => {
  await addService(db, TA, { name: "Fön", priceTl: 200, durationMin: 30 });
  await addStaff(db, TA, { name: "Zeynep Aydın", role: "Kuaför" });
  assert.equal((await listStaff(db, TA)).length, 1);
  assert.equal((await listStaff(db, TB)).length, 0);
  await expectAppError(addService(db, TA, { name: "x", durationMin: 0 }), 422, "validation");
  await expectAppError(addStaff(db, TA, { name: "" }), 422, "validation");
});

test("audit: service changes are recorded with the actor, visible only to their tenant", async () => {
  await addService(db, TA, { name: "Makyaj", durationMin: 60 }, "actor-1");
  const mine = await listAudit(db, TA);
  assert.ok(mine.some((e) => e.action === "service.add" && e.actor_user_id === "actor-1"));
  const theirs = await listAudit(db, TB);
  assert.ok(!theirs.some((e) => JSON.stringify(e).includes("Makyaj")));
});

test("signup: a randevu sector is required and stored; an unknown sector is rejected", async () => {
  const ok = await signup(db, { email: "sek-ok@test.com", password: "Guclu-Parola-1", tenantName: "Sektörlü", city: "Ankara", sector: "fotografci" });
  const row = await db.transaction((tx) => tx.query<{ sector: string }>("SELECT sector FROM tenants WHERE id = $1", [ok.tenantId]));
  assert.equal(row.rows[0].sector, "fotografci");
  await expectAppError(signup(db, { email: "sek-yok@test.com", password: "Guclu-Parola-1", tenantName: "Sektörsüz", city: "Ankara" }), 422, "validation");
  await expectAppError(signup(db, { email: "sek-bad@test.com", password: "Guclu-Parola-1", tenantName: "Yanlış", city: "Ankara", sector: "x" }), 422, "validation");
});




// ---------- Randevu ----------
const APPT_DATE = "2030-05-14"; // gelecekte bir tarih; çalışma saatleri 09:00–20:00
const PHONE = "05321234567";

// Kiracı, yayın durumu, bir hizmet ve belirtilen sayıda personel oluşturur.
async function seedBookable(id: string, staffCount: number, published = true): Promise<{ serviceId: string; staffIds: string[] }> {
  await seedTenant(db, id, `Randevu ${id}`);
  return withTenant(db, id, async (tx) => {
    const serviceId = `svc-${id}`;
    await tx.query("INSERT INTO services (id, tenant_id, name, price_tl, duration_min) VALUES ($1, $2, 'Saç kesimi', 500, 60)", [serviceId, id]);
    const staffIds: string[] = [];
    for (let i = 0; i < staffCount; i++) {
      const sid = `st-${id}-${i}`;
      await tx.query("INSERT INTO staff (id, tenant_id, name) VALUES ($1, $2, $3)", [sid, id, `Personel ${i + 1}`]);
      staffIds.push(sid);
    }
    await tx.query("INSERT INTO tenant_profiles (tenant_id, published) VALUES ($1, $2)", [id, published]);
    return { serviceId, staffIds };
  });
}

const appt = (serviceId: string, time: string, extra: Record<string, unknown> = {}) => ({
  serviceId,
  date: APPT_DATE,
  time,
  customerName: "Ayşe Yılmaz",
  customerPhone: PHONE,
  ...extra,
});

const slotAt = (slots: Array<{ time: string; available: boolean }>, time: string) => slots.find((s) => s.time === time)!;

test("appointments: slots cover opening hours in 30-minute steps; the last start fits before closing", async () => {
  const { serviceId } = await seedBookable("appt-1", 1);
  const slots = await getSlots(db, "appt-1", { serviceId, date: APPT_DATE, publicOnly: true });
  assert.equal(slots.length, 21, "09:00..19:00 arası 21 başlangıç");
  assert.equal(slots[0].time, "09:00");
  assert.equal(slots[slots.length - 1].time, "19:00");
  assert.ok(slots.every((s) => s.available));
});

test("appointments: a booked slot is unavailable (overlaps included) and a second booking there is refused", async () => {
  const { serviceId } = await seedBookable("appt-2", 1);
  await createAppointment(db, "appt-2", appt(serviceId, "10:00"), { publicBooking: true });
  const slots = await getSlots(db, "appt-2", { serviceId, date: APPT_DATE, publicOnly: true });
  assert.equal(slotAt(slots, "10:00").available, false);
  assert.equal(slotAt(slots, "10:30").available, false, "60 dk'lık hizmet 10:30'da çakışır");
  assert.equal(slotAt(slots, "11:00").available, true, "bitişe değen slot serbesttir");
  await expectAppError(createAppointment(db, "appt-2", appt(serviceId, "10:00"), { publicBooking: true }), 409, "slot_taken");
});

test("appointments: with two staff, two bookings at the same time both succeed and a third is refused", async () => {
  const { serviceId, staffIds } = await seedBookable("appt-3", 2);
  const first = await createAppointment(db, "appt-3", appt(serviceId, "10:00"), { publicBooking: true });
  const second = await createAppointment(db, "appt-3", appt(serviceId, "10:00", { customerName: "Zeynep Kaya" }), { publicBooking: true });
  assert.notEqual(first.staffId, second.staffId, "iki randevu farklı personele atanmalı");
  assert.ok(staffIds.includes(first.staffId!) && staffIds.includes(second.staffId!));
  await expectAppError(createAppointment(db, "appt-3", appt(serviceId, "10:00", { customerName: "Elif Demir" }), { publicBooking: true }), 409, "slot_taken");
});

test("appointments: an explicitly chosen staff member cannot be double-booked, others remain free", async () => {
  const { serviceId, staffIds } = await seedBookable("appt-4", 2);
  await createAppointment(db, "appt-4", appt(serviceId, "10:00", { staffId: staffIds[0] }), { publicBooking: true });
  await expectAppError(createAppointment(db, "appt-4", appt(serviceId, "10:00", { staffId: staffIds[0] }), { publicBooking: true }), 409, "slot_taken");
  const other = await createAppointment(db, "appt-4", appt(serviceId, "10:00", { staffId: staffIds[1] }), { publicBooking: true });
  assert.equal(other.staffId, staffIds[1]);
});

test("appointments: off-grid times, times outside opening hours, past dates and bad phones are rejected", async () => {
  const { serviceId } = await seedBookable("appt-5", 1);
  const ok = { publicBooking: true };
  await expectAppError(createAppointment(db, "appt-5", appt(serviceId, "09:15"), ok), 422, "validation"); // adım dışı
  await expectAppError(createAppointment(db, "appt-5", appt(serviceId, "08:30"), ok), 422, "validation"); // açılıştan önce
  await expectAppError(createAppointment(db, "appt-5", appt(serviceId, "19:30"), ok), 422, "validation"); // kapanışı aşar
  await expectAppError(createAppointment(db, "appt-5", appt(serviceId, "10:00", { date: "2020-01-01" }), ok), 422, "validation");
  await expectAppError(createAppointment(db, "appt-5", appt(serviceId, "10:00", { customerPhone: "123" }), ok), 422, "validation");
});

test("appointments: an unpublished business is invisible to public booking but still manageable by its members", async () => {
  const { serviceId } = await seedBookable("appt-6", 1, false);
  await expectAppError(getSlots(db, "appt-6", { serviceId, date: APPT_DATE, publicOnly: true }), 404, "not_found");
  await expectAppError(createAppointment(db, "appt-6", appt(serviceId, "10:00"), { publicBooking: true }), 404, "not_found");
  const created = await createAppointment(db, "appt-6", appt(serviceId, "10:00"), { publicBooking: false });
  assert.ok(created.id);
});

test("appointments: a business cannot see or cancel another business's appointments", async () => {
  const a = await seedBookable("appt-7", 1);
  await seedBookable("appt-8", 1);
  const created = await createAppointment(db, "appt-7", appt(a.serviceId, "10:00"), { publicBooking: true });
  assert.equal((await listAppointments(db, "appt-8", APPT_DATE)).length, 0);
  await expectAppError(cancelAppointment(db, "appt-8", created.id), 404, "not_found");
  const mine = await listAppointments(db, "appt-7", APPT_DATE);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, "onaylandi", "başka kiracı iptal edemez");
});

test("appointments: cancelling frees the slot; a cancelled appointment cannot be cancelled again", async () => {
  const { serviceId } = await seedBookable("appt-9", 1);
  const first = await createAppointment(db, "appt-9", appt(serviceId, "10:00"), { publicBooking: true });
  await cancelAppointment(db, "appt-9", first.id);
  const slots = await getSlots(db, "appt-9", { serviceId, date: APPT_DATE, publicOnly: true });
  assert.equal(slotAt(slots, "10:00").available, true);
  await createAppointment(db, "appt-9", appt(serviceId, "10:00", { customerName: "Mert Şahin" }), { publicBooking: true });
  await expectAppError(cancelAppointment(db, "appt-9", first.id), 404, "not_found");
});

test("appointments: the audit trail records the change without customer name or phone", async () => {
  const { serviceId } = await seedBookable("appt-10", 1);
  const created = await createAppointment(db, "appt-10", appt(serviceId, "10:00"), { publicBooking: true });
  const rows = await listAudit(db, "appt-10");
  const entry = rows.find((r) => r.action === "appointment.create" && r.target === created.id);
  assert.ok(entry, "denetim satırı yazılmalı");
  const text = JSON.stringify(entry);
  assert.ok(!text.includes(PHONE) && !text.includes("Ayşe"), "müşteri verisi denetim kaydına girmemeli");
});

// ---------- Sektörler ve müşteri randevu sayfası ----------
async function setSector(id: string, sector: string | null) {
  await db.transaction((tx) => tx.query("UPDATE tenants SET sector = $2 WHERE id = $1", [id, sector]));
}

test("sectors: four keys, each with a label, and the database rejects an unknown sector", async () => {
  assert.equal(SECTOR_KEYS.length, 4);
  assert.equal(new Set(SECTOR_KEYS).size, 4);
  for (const k of SECTOR_KEYS) assert.ok(SECTORS[k].label.length > 0);
  await seedTenant(db, "sec-1", "Sektör testi");
  await assert.rejects(setSector("sec-1", "bilinmeyen"));
  await setSector("sec-1", "sac-makyaj");
});

test("listing: a published business with a sector appears in its sector list; unpublished ones do not", async () => {
  const { serviceId } = await seedBookable("list-1", 1, true);
  await setSector("list-1", "sac-makyaj");
  await saveProfile(db, "list-1", { published: true, description: "Şehrin merkezinde." });
  const listed = await listSectorListings(db, "sac-makyaj");
  assert.ok(listed.some((l) => l.tenantId === "list-1" && l.description === "Şehrin merkezinde."));
  assert.ok(!(await listSectorListings(db, "fotografci")).some((l) => l.tenantId === "list-1"), "başka sektörde görünmemeli");
  await saveProfile(db, "list-1", { published: false });
  assert.ok(!(await listSectorListings(db, "sac-makyaj")).some((l) => l.tenantId === "list-1"), "yayından kalkınca gizlenmeli");
  assert.ok(serviceId);
});

test("booking page: shows services and staff only for a published business with a sector", async () => {
  const { serviceId, staffIds } = await seedBookable("page-1", 2, true);
  assert.equal(await getBookingPage(db, "page-1"), null, "sektör yoksa sayfa açılmaz");
  await setSector("page-1", "dugun-salonu");
  const page = await getBookingPage(db, "page-1");
  assert.ok(page);
  assert.equal(page!.sector, "dugun-salonu");
  assert.equal(page!.services.length, 1);
  assert.equal(page!.services[0].id, serviceId);
  assert.deepEqual(page!.staff.map((s) => s.id), staffIds);
  await seedBookable("page-2", 0, false);
  await setSector("page-2", "dugun-salonu");
  assert.equal(await getBookingPage(db, "page-2"), null, "yayında olmayan işletme açılmaz");
});


// ---------- Hatırlatmalar ----------
test("reminders: upcoming appointments are queued once, cancelled and far-future ones are not", async () => {
  const { queueReminders, listQueuedReminders } = await import("../src/lib/reminders");
  const { serviceId } = await seedBookable("rem-1", 1, true);
  await setSector("rem-1", "sac-makyaj");
  const now = new Date("2030-05-13T09:00:00Z");
  const near = await createAppointment(db, "rem-1", appt(serviceId, "10:00"), { publicBooking: true });
  const cancelled = await createAppointment(db, "rem-1", appt(serviceId, "11:00", { customerName: "İptal Eden" }), { publicBooking: true });
  await cancelAppointment(db, "rem-1", cancelled.id);
  await createAppointment(db, "rem-1", appt(serviceId, "10:00", { date: "2030-05-16", customerName: "Uzak Müşteri" }), { publicBooking: true });
  assert.equal(await queueReminders(db, "rem-1", { now }), 1, "yalnızca 24 saat içindeki onaylı randevu");
  assert.equal(await queueReminders(db, "rem-1", { now }), 0, "ikinci çağrı çoğaltmamalı");
  const items = await listQueuedReminders(db, "rem-1");
  assert.equal(items.length, 1);
  assert.equal(items[0].customerName, "Ayşe Yılmaz");
  assert.ok(items[0].link.startsWith("https://wa.me/905321234567?text="));
  assert.ok(decodeURIComponent(items[0].link).includes("Merhaba Ayşe"));
  assert.ok(near.id);
});

test("reminders: marking as sent removes it from the queue, is audited, and is tenant-scoped", async () => {
  const { queueReminders, listQueuedReminders, setReminderStatus } = await import("../src/lib/reminders");
  const { serviceId } = await seedBookable("rem-2", 1, true);
  await seedBookable("rem-3", 1, true);
  await createAppointment(db, "rem-2", appt(serviceId, "10:00"), { publicBooking: true });
  await queueReminders(db, "rem-2", { now: new Date("2030-05-13T09:00:00Z") });
  const [item] = await listQueuedReminders(db, "rem-2");
  await expectAppError(setReminderStatus(db, "rem-3", item.id, "sent"), 404, "not_found");
  await setReminderStatus(db, "rem-2", item.id, "sent", "actor-2");
  assert.equal((await listQueuedReminders(db, "rem-2")).length, 0);
  const audit2 = await listAudit(db, "rem-2");
  assert.ok(audit2.some((e) => e.action === "reminder.sent" && e.actor_user_id === "actor-2"));
  await expectAppError(setReminderStatus(db, "rem-2", item.id, "bilinmeyen"), 422, "validation");
});

test("staff: a member with upcoming appointments cannot be deleted; a free one can", async () => {
  const { deleteStaff, addStaff, listStaff } = await import("../src/lib/workspace");
  const { serviceId, staffIds } = await seedBookable("staff-del", 1, true);
  await createAppointment(db, "staff-del", appt(serviceId, "10:00", { staffId: staffIds[0] }), { publicBooking: true });
  await expectAppError(deleteStaff(db, "staff-del", staffIds[0]), 409, "staff_has_appointments");
  await addStaff(db, "staff-del", { name: "Boş Personel" });
  const free = (await listStaff(db, "staff-del")).find((x) => x.name === "Boş Personel")!;
  await deleteStaff(db, "staff-del", free.id);
  assert.equal((await listStaff(db, "staff-del")).length, 1);
});

// ---------- Çalışma saatleri ----------
test("working hours: each business sets its own hours; slots and bookings follow them", async () => {
  const { serviceId } = await seedBookable("hours-1", 1, true);
  await saveProfile(db, "hours-1", { published: true, opensAt: "10:00", closesAt: "18:00" });
  const slots = await getSlots(db, "hours-1", { serviceId, date: APPT_DATE, publicOnly: true });
  assert.equal(slots[0].time, "10:00");
  assert.equal(slots[slots.length - 1].time, "17:00", "60 dk'lık hizmet 18:00'de biter");
  assert.equal(slots.length, 15);
  await expectAppError(createAppointment(db, "hours-1", appt(serviceId, "09:00"), { publicBooking: true }), 422, "validation");
  await expectAppError(createAppointment(db, "hours-1", appt(serviceId, "17:30"), { publicBooking: true }), 422, "validation");
  const ok = await createAppointment(db, "hours-1", appt(serviceId, "17:00"), { publicBooking: true });
  assert.ok(ok.id, "kapanıştan önce biten son randevu kabul edilmeli");
});

test("working hours: invalid values are rejected with field names", async () => {
  await seedBookable("hours-2", 1, true);
  await expectAppError(saveProfile(db, "hours-2", { opensAt: "18:00", closesAt: "10:00" }), 422, "validation");
  await expectAppError(saveProfile(db, "hours-2", { opensAt: "10:15" }), 422, "validation");
  await expectAppError(saveProfile(db, "hours-2", { closesAt: "25:00" }), 422, "validation");
});

// ---------- Gün bazlı çalışma saatleri ----------
const weekdayIndex = (date: string) => new Date(`${date}T12:00:00+03:00`).getUTCDay();
const weekWith = (date: string, entry: Record<string, unknown> | null) =>
  Array.from({ length: 7 }, (_, i) => (i === weekdayIndex(date) ? entry : { on: true, opensAt: "09:00", closesAt: "20:00" }));

test("day hours: a closed day has no slots and refuses bookings", async () => {
  const { serviceId } = await seedBookable("day-1", 1, true);
  await saveProfile(db, "day-1", { published: true, dayHours: weekWith(APPT_DATE, { on: false }) });
  assert.equal((await getSlots(db, "day-1", { serviceId, date: APPT_DATE, publicOnly: true })).length, 0);
  await expectAppError(createAppointment(db, "day-1", appt(serviceId, "10:00"), { publicBooking: true }), 422, "validation");
  const nextDay = "2030-05-15";
  assert.ok((await getSlots(db, "day-1", { serviceId, date: nextDay, publicOnly: true })).length > 0, "diğer günler açık kalmalı");
});

test("day hours: a custom window applies only to its weekday", async () => {
  const { serviceId } = await seedBookable("day-2", 1, true);
  await saveProfile(db, "day-2", { published: true, dayHours: weekWith(APPT_DATE, { on: true, opensAt: "10:00", closesAt: "12:00" }) });
  const slots = await getSlots(db, "day-2", { serviceId, date: APPT_DATE, publicOnly: true });
  assert.deepEqual(slots.map((s) => s.time), ["10:00", "10:30", "11:00"]);
  await expectAppError(createAppointment(db, "day-2", appt(serviceId, "09:00"), { publicBooking: true }), 422, "validation");
  await expectAppError(createAppointment(db, "day-2", appt(serviceId, "11:30"), { publicBooking: true }), 422, "validation");
  const ok = await createAppointment(db, "day-2", appt(serviceId, "11:00"), { publicBooking: true });
  assert.ok(ok.id);
  assert.ok((await getSlots(db, "day-2", { serviceId, date: "2030-05-15", publicOnly: true })).some((s) => s.time === "09:00"));
});

test("day hours: invalid day entries are rejected", async () => {
  await seedBookable("day-3", 1, true);
  await expectAppError(saveProfile(db, "day-3", { dayHours: [{ on: false }] }), 422, "validation");
  await expectAppError(saveProfile(db, "day-3", { dayHours: weekWith(APPT_DATE, { on: true, opensAt: "18:00", closesAt: "10:00" }) }), 422, "validation");
});

// ---------- Müşteriler ----------
test("customers: appointments are grouped by phone, scoped to the business, with history", async () => {
  const { listCustomers, getCustomerDetail } = await import("../src/lib/customers");
  const { serviceId } = await seedBookable("cust-1", 1, true);
  await seedBookable("cust-2", 1, true);
  await createAppointment(db, "cust-1", appt(serviceId, "10:00"), { publicBooking: true });
  await createAppointment(db, "cust-1", appt(serviceId, "13:00", { customerName: "Ayşe Yılmaz Güncel" }), { publicBooking: true });
  await createAppointment(db, "cust-1", appt(serviceId, "15:00", { customerName: "Başka Biri", customerPhone: "05320000001" }), { publicBooking: true });
  const list = await listCustomers(db, "cust-1");
  assert.equal(list.length, 2);
  const ayse = list.find((c) => c.phone === "905321234567")!;
  assert.equal(ayse.total, 2);
  assert.equal(ayse.name, "Ayşe Yılmaz Güncel", "en son kullanılan ad");
  assert.equal((await listCustomers(db, "cust-2")).length, 0, "başka işletmenin müşterisi görünmemeli");
  assert.equal((await getCustomerDetail(db, "cust-1", "905321234567"))!.history.length, 2);
  assert.equal(await getCustomerDetail(db, "cust-2", "905321234567"), null, "başka işletmenin müşterisi açılmamalı");
});

// ---------- Randevu sonucu ----------
test("outcomes: an approved appointment can be marked completed or no-show; cancelled ones cannot", async () => {
  const { setAppointmentOutcome } = await import("../src/lib/appointments");
  const { serviceId } = await seedBookable("out-1", 1, true);
  const a = await createAppointment(db, "out-1", appt(serviceId, "10:00"), { publicBooking: true });
  const b = await createAppointment(db, "out-1", appt(serviceId, "12:00", { customerName: "Gelmeyen Müşteri" }), { publicBooking: true });
  await setAppointmentOutcome(db, "out-1", a.id, "tamamlandi", "actor-3");
  await setAppointmentOutcome(db, "out-1", b.id, "gelmedi", "actor-3");
  const rows = await listAppointments(db, "out-1", APPT_DATE);
  assert.equal(rows.find((r) => r.id === a.id)!.status, "tamamlandi");
  assert.equal(rows.find((r) => r.id === b.id)!.status, "gelmedi");
  await expectAppError(setAppointmentOutcome(db, "out-1", a.id, "tamamlandi"), 404, "not_found");
  await expectAppError(setAppointmentOutcome(db, "out-1", a.id, "iptal"), 422, "validation");
  const c = await createAppointment(db, "out-1", appt(serviceId, "15:00", { customerName: "İptal Olan" }), { publicBooking: true });
  await cancelAppointment(db, "out-1", c.id);
  await expectAppError(setAppointmentOutcome(db, "out-1", c.id, "gelmedi"), 404, "not_found");
});

// ---------- Hizmet ve personel düzenleme ----------
test("edit: services and staff can be updated, validated, and are tenant-scoped", async () => {
  const { updateService, updateStaff, addService, listServices, addStaff, listStaff } = await import("../src/lib/workspace");
  await seedBookable("edit-1", 0, true);
  await seedBookable("edit-2", 0, true);
  await addService(db, "edit-1", { name: "Eski ad", priceTl: 100, durationMin: 30 });
  await addStaff(db, "edit-1", { name: "Eski Personel", role: "A" });
  const svc = (await listServices(db, "edit-1"))[0];
  const st = (await listStaff(db, "edit-1"))[0];
  await updateService(db, "edit-1", svc.id, { name: "Yeni ad", priceTl: 250, durationMin: 45 });
  await updateStaff(db, "edit-1", st.id, { name: "Yeni Personel", role: "B" });
  const s2 = (await listServices(db, "edit-1"))[0];
  assert.equal(s2.name, "Yeni ad");
  assert.equal(s2.durationMin, 45);
  assert.equal((await listStaff(db, "edit-1"))[0].role, "B");
  await expectAppError(updateService(db, "edit-2", svc.id, { name: "Kaçak", durationMin: 30 }), 404, "not_found");
  await expectAppError(updateService(db, "edit-1", svc.id, { name: "x", durationMin: 0 }), 422, "validation");
  await expectAppError(updateStaff(db, "edit-1", st.id, { name: "" }), 422, "validation");
});

// ---------- Ekip üyeleri ----------
test("members: invite creates a staff membership and queues a set-password email; owner cannot be removed", async () => {
  const { inviteMember, listMembers, removeMember } = await import("../src/lib/members");
  const { signup } = await import("../src/lib/auth");
  const own = await signup(db, { email: "sahip-ekip@test.com", password: "Guclu-Parola-1", tenantName: "Ekipli", city: "Ankara", sector: "sac-makyaj" });
  await inviteMember(db, own.tenantId, "calisan@test.com", "http://app.test", own.userId);
  const members = await listMembers(db, own.tenantId);
  assert.equal(members.length, 2);
  assert.equal(members.find((m) => m.email === "calisan@test.com")!.role, "staff");
  const mail = await db.transaction((tx) => tx.query<{ n: string }>("SELECT count(*)::text AS n FROM email_outbox WHERE to_address = 'calisan@test.com'"));
  assert.equal(mail.rows[0].n, "1", "parola belirleme e-postası kuyruğa girmeli");
  await expectAppError(inviteMember(db, own.tenantId, "calisan@test.com", "http://app.test", own.userId), 409, "already_member");
  await expectAppError(removeMember(db, own.tenantId, own.userId, own.userId), 422, "validation");
  const calisan = members.find((m) => m.email === "calisan@test.com")!;
  await removeMember(db, own.tenantId, calisan.userId, own.userId);
  assert.equal((await listMembers(db, own.tenantId)).length, 1);
});

// ---------- İstatistikler ----------
test("stats: outcomes, cancellations, no-show rate, and occupancy over a window", async () => {
  const { getStats } = await import("../src/lib/stats");
  const { setAppointmentOutcome } = await import("../src/lib/appointments");
  const { serviceId } = await seedBookable("stat-1", 1, true);
  const a = await createAppointment(db, "stat-1", appt(serviceId, "10:00"), { publicBooking: true });
  const b = await createAppointment(db, "stat-1", appt(serviceId, "12:00", { customerName: "Gelmedi Kişi" }), { publicBooking: true });
  const c = await createAppointment(db, "stat-1", appt(serviceId, "14:00", { customerName: "İptal Kişi" }), { publicBooking: true });
  await setAppointmentOutcome(db, "stat-1", a.id, "tamamlandi");
  await setAppointmentOutcome(db, "stat-1", b.id, "gelmedi");
  await cancelAppointment(db, "stat-1", c.id);
  const s = await getStats(db, "stat-1", 30, new Date("2030-05-20T12:00:00+03:00"));
  assert.equal(s.total, 3);
  assert.equal(s.completed, 1);
  assert.equal(s.noShow, 1);
  assert.equal(s.cancelled, 1);
  assert.equal(s.noShowRate, 0.5);
  assert.equal(s.bookedMin, 120, "iki aktif 60 dakikalık randevu");
  assert.ok(s.availableMin > 0, "çalışma dakikaları hesaplanmalı");
  assert.ok(s.occupancy > 0 && s.occupancy < 1);
  assert.equal(s.topServices[0].name, "Saç kesimi");
});

// ---------- Randevu taşıma ----------
test("reschedule: an appointment moves to a free slot, frees the old one, and conflicts are refused", async () => {
  const { rescheduleAppointment } = await import("../src/lib/appointments");
  const { serviceId } = await seedBookable("res-1", 1, true);
  const a = await createAppointment(db, "res-1", appt(serviceId, "10:00"), { publicBooking: true });
  await createAppointment(db, "res-1", appt(serviceId, "13:00", { customerName: "Dolu Kişi" }), { publicBooking: true });
  await rescheduleAppointment(db, "res-1", a.id, { date: APPT_DATE, time: "11:00" }, "actor-4");
  const slots = await getSlots(db, "res-1", { serviceId, date: APPT_DATE, publicOnly: true });
  assert.equal(slotAt(slots, "10:00").available, true, "eski saat serbest kalmalı");
  assert.equal(slotAt(slots, "11:00").available, false, "yeni saat dolu olmalı");
  await expectAppError(rescheduleAppointment(db, "res-1", a.id, { date: APPT_DATE, time: "13:00" }), 409, "slot_taken");
  await expectAppError(rescheduleAppointment(db, "res-1", a.id, { date: APPT_DATE, time: "10:15" }), 422, "validation");
});

// ---------- Müşteri notları ----------
test("customer notes: saved per business and per customer; other businesses cannot read them", async () => {
  const { saveCustomerNote, getCustomerNote } = await import("../src/lib/customers");
  await seedBookable("note-1", 0, true);
  await seedBookable("note-2", 0, true);
  await saveCustomerNote(db, "note-1", "905321234567", "Hassas cilt", "actor-5");
  assert.equal(await getCustomerNote(db, "note-1", "905321234567"), "Hassas cilt");
  assert.equal(await getCustomerNote(db, "note-2", "905321234567"), "", "başka işletme notu görmemeli");
  await saveCustomerNote(db, "note-1", "905321234567", "Güncel not");
  assert.equal(await getCustomerNote(db, "note-1", "905321234567"), "Güncel not");
  await expectAppError(saveCustomerNote(db, "note-1", "123", "x"), 422, "validation");
});

// ---------- Parola değiştirme ----------
test("password change: needs the current password, keeps this session, and revokes the others", async () => {
  const { changePassword, login, currentUser, hashToken } = await import("../src/lib/auth");
  await createUser(db, "parola-degis@test.com", "eski-parola-1234");
  const s1 = await login(db, "parola-degis@test.com", "eski-parola-1234");
  const s2 = await login(db, "parola-degis@test.com", "eski-parola-1234");
  await expectAppError(changePassword(db, s1.userId, "yanlis-parola", "yeni-parola-12345", hashToken(s1.token)), 422, "validation");
  await expectAppError(changePassword(db, s1.userId, "eski-parola-1234", "kisa", hashToken(s1.token)), 422, "validation");
  await changePassword(db, s1.userId, "eski-parola-1234", "yeni-parola-12345", hashToken(s1.token));
  assert.ok(await currentUser(db, s1.token), "bu oturum açık kalmalı");
  assert.equal(await currentUser(db, s2.token), null, "diğer oturum kapanmalı");
  await expectAppError(login(db, "parola-degis@test.com", "eski-parola-1234"), 401, "invalid_credentials");
  assert.ok(await login(db, "parola-degis@test.com", "yeni-parola-12345"));
});

// ---------- Rol bazlı yetkiler ----------
test("roles: owners can do everything; staff can only manage appointments and customers", async () => {
  const { can, assertCan } = await import("../src/lib/permissions");
  assert.ok(can("owner", "manage_catalog") && can("owner", "manage_members") && can("owner", "view_audit"));
  assert.ok(can("staff", "manage_appointments") && can("staff", "manage_customers"));
  for (const a of ["manage_catalog", "manage_profile", "manage_members", "view_audit"] as const) {
    assert.equal(can("staff", a), false, `personel ${a} yapamamalı`);
  }
  assert.equal(can("unknown", "manage_appointments"), false);
  assertCan("staff", "manage_appointments");
  await expectAppError(Promise.resolve().then(() => assertCan("staff", "manage_catalog")), 403, "forbidden");
});

test("roles: an invited member is staff and cannot be given owner powers by the invite flow", async () => {
  const { inviteMember, listMembers } = await import("../src/lib/members");
  const { signup } = await import("../src/lib/auth");
  const own = await signup(db, { email: "rol-sahip@test.com", password: "Guclu-Parola-1", tenantName: "Rolcü", city: "Ankara", sector: "sac-makyaj" });
  await inviteMember(db, own.tenantId, "rol-uye@test.com", "http://app.test", own.userId);
  const uye = (await listMembers(db, own.tenantId)).find((m) => m.email === "rol-uye@test.com")!;
  assert.equal(uye.role, "staff");
});

// ---------- Kişisel kapsam ----------
test("personal scope: a staff member sees and changes only their own appointments", async () => {
  const { listCustomers } = await import("../src/lib/customers");
  const { serviceId, staffIds } = await seedBookable("sc-1", 2, true);
  const mine = await createAppointment(db, "sc-1", appt(serviceId, "10:00", { staffId: staffIds[0] }), { publicBooking: true });
  const theirs = await createAppointment(db, "sc-1", appt(serviceId, "11:00", { staffId: staffIds[1], customerName: "Diğer Personel Müşterisi", customerPhone: "05329990000" }), { publicBooking: true });
  const scopeA = { all: false as const, staffId: staffIds[0] };
  const visible = await listAppointments(db, "sc-1", APPT_DATE, scopeA);
  assert.deepEqual(visible.map((v) => v.id), [mine.id]);
  await expectAppError(cancelAppointment(db, "sc-1", theirs.id, "x", scopeA), 404, "not_found");
  await cancelAppointment(db, "sc-1", mine.id, "x", scopeA);
  const customers = await listCustomers(db, "sc-1", scopeA);
  assert.equal(customers.length, 1, "yalnızca kendi müşterisi görünmeli");
  assert.equal(customers[0].phone, "905321234567");
});

test("personal scope: a staff member without a linked staff record sees nothing and cannot write notes", async () => {
  const { serviceId } = await seedBookable("sc-2", 1, true);
  await createAppointment(db, "sc-2", appt(serviceId, "10:00"), { publicBooking: true });
  const none = { all: false as const, staffId: null };
  assert.equal((await listAppointments(db, "sc-2", APPT_DATE, none)).length, 0);
  const { saveCustomerNote } = await import("../src/lib/customers");
  await expectAppError(saveCustomerNote(db, "sc-2", "905321234567", "not", "x", none), 404, "not_found");
});

// ---------- Pasif personel ----------
test("staff: an inactive member is not assigned to new appointments", async () => {
  const { updateStaff, listStaff } = await import("../src/lib/workspace");
  const { serviceId, staffIds } = await seedBookable("act-1", 2, true);
  await updateStaff(db, "act-1", staffIds[0], { active: false });
  const a = await createAppointment(db, "act-1", appt(serviceId, "10:00"), { publicBooking: true });
  assert.equal(a.staffId, staffIds[1], "pasif personele atanmamalı");
  await expectAppError(createAppointment(db, "act-1", appt(serviceId, "11:00", { staffId: staffIds[0] }), { publicBooking: true }), 422, "validation");
  await updateStaff(db, "act-1", staffIds[0], { active: true });
  assert.equal((await listStaff(db, "act-1")).find((s) => s.id === staffIds[0])!.active, true);
});

// ---------- Müşteri silme ve birleştirme ----------
test("customer records: delete keeps appointments; merge moves appointments and profile to the target", async () => {
  const { saveCustomerProfile, saveCustomerNote, deleteCustomerRecord, mergeCustomers, getCustomerDetail, createCustomer } = await import("../src/lib/customers");
  const { serviceId } = await seedBookable("mg-1", 1, true);
  await createAppointment(db, "mg-1", appt(serviceId, "10:00", { customerName: "Kaynak Müşteri", customerPhone: "05321110011" }), { publicBooking: true });
  await createAppointment(db, "mg-1", appt(serviceId, "12:00", { customerName: "Hedef Müşteri", customerPhone: "05321110022" }), { publicBooking: true });
  await saveCustomerProfile(db, "mg-1", "905321110011", { name: "Kaynak Müşteri", email: "k@test.com" }, "a");
  await saveCustomerNote(db, "mg-1", "905321110011", "Kaynak notu", "a");
  await deleteCustomerRecord(db, "mg-1", "905321110011", "a");
  const afterDelete = await getCustomerDetail(db, "mg-1", "905321110011");
  assert.ok(afterDelete && afterDelete.history.length === 1, "randevu geçmişi korunmalı");
  assert.equal(afterDelete!.email, "", "profil bilgisi silinmeli");
  assert.equal(afterDelete!.note, "", "not silinmeli");

  await createCustomer(db, "mg-1", { name: "Hedef Müşteri", phone: "05321110022" }, "a");
  await mergeCustomers(db, "mg-1", "905321110022", "905321110011", "a").catch(() => undefined);
  await expectAppError(mergeCustomers(db, "mg-1", "905321110022", "905321110099", "a"), 404, "not_found");
  await expectAppError(mergeCustomers(db, "mg-1", "905321110022", "905321110022", "a"), 422, "validation");
  await mergeCustomers(db, "mg-1", "905321110022", "905321110011", "a");
  const merged = await getCustomerDetail(db, "mg-1", "905321110011");
  assert.equal(merged!.history.length, 2, "iki müşterinin randevuları birleşmeli");
  assert.equal(await getCustomerDetail(db, "mg-1", "905321110022"), null, "kaynak müşteri kalmamalı");
});

// ---------- Kasa ----------
test("ledger: completing an appointment records its service price once; expenses reduce the net", async () => {
  const { listLedger, addLedgerEntry } = await import("../src/lib/ledger");
  const { setAppointmentOutcome } = await import("../src/lib/appointments");
  const { serviceId, staffIds } = await seedBookable("lg-1", 1, true);
  const a = await createAppointment(db, "lg-1", appt(serviceId, "10:00"), { publicBooking: true });
  await setAppointmentOutcome(db, "lg-1", a.id, "tamamlandi", "x");
  const v1 = await listLedger(db, "lg-1", { donem: "tumu" });
  assert.equal(v1.entries.length, 1);
  assert.equal(v1.entries[0].kind, "gelir");
  assert.equal(v1.entries[0].amountTl, 500);
  assert.equal(v1.entries[0].receiptNo, "SS-0001");
  assert.equal(v1.summary.income, 500);
  await addLedgerEntry(db, "lg-1", { kind: "gider", category: "Malzeme", amountTl: 120, method: "kart", staffId: staffIds[0] }, "x");
  const v2 = await listLedger(db, "lg-1", { donem: "tumu" });
  assert.equal(v2.summary.expense, 120);
  assert.equal(v2.summary.net, 380);
  assert.equal((await listLedger(db, "lg-1", { donem: "tumu", sekme: "gider" })).entries.length, 1);
  assert.equal((await listLedger(db, "lg-1", { donem: "tumu", sekme: "personel" })).entries.length, 2, "personele bağlı gelir ve gider");
  assert.ok(v2.categories.includes("Malzeme"));
  await expectAppError(addLedgerEntry(db, "lg-1", { kind: "gelir", category: "", amountTl: 5 }), 422, "validation");
});

test("ledger: a service without a price records no income; members have no ledger permission", async () => {
  const { listLedger } = await import("../src/lib/ledger");
  const { can } = await import("../src/lib/permissions");
  const { setAppointmentOutcome } = await import("../src/lib/appointments");
  const { serviceId } = await seedBookable("lg-2", 1, true);
  await withTenant(db, "lg-2", (tx) => tx.query("UPDATE services SET price_tl = 0 WHERE tenant_id = 'lg-2'"));
  const a = await createAppointment(db, "lg-2", appt(serviceId, "10:00"), { publicBooking: true });
  await setAppointmentOutcome(db, "lg-2", a.id, "tamamlandi", "x");
  assert.equal((await listLedger(db, "lg-2", { donem: "tumu" })).entries.length, 0);
  assert.equal(can("staff", "view_ledger"), false);
  assert.equal(can("owner", "view_ledger"), true);
});

// ---------- Çok kalemli kasa kaydı ----------
test("ledger: a multi-item receipt shares one receipt number, links a customer, and keeps a past date", async () => {
  const { addLedgerEntry, listLedger } = await import("../src/lib/ledger");
  await seedBookable("lg-3", 0, true);
  await addLedgerEntry(db, "lg-3", { kind: "gelir", method: "kart", customerPhone: "05321234567", occurredAt: "2030-01-15", items: [{ name: "Cilt bakımı", amountTl: 300 }, { name: "Diğer", amountTl: "50" }] }, "x");
  const v = await listLedger(db, "lg-3", { donem: "tumu" });
  assert.equal(v.entries.length, 2);
  assert.ok(v.entries.every((e) => e.receiptNo === "SS-0001"), "aynı fiş no");
  assert.ok(v.entries.every((e) => e.customerPhone === "905321234567"), "müşteri bağlantısı");
  assert.equal(v.summary.income, 350);
  assert.ok(v.entries.every((e) => e.occurredAt.startsWith("2030-01-15")), "geçmiş tarih");
  await expectAppError(addLedgerEntry(db, "lg-3", { kind: "gider", items: [] }), 422, "validation");
});

// ---------- Personel ödemesi, ürün, personel filtresi ----------
test("ledger: per-item staff payments can be filtered by person; products are tenant-scoped", async () => {
  const { addLedgerEntry, listLedger } = await import("../src/lib/ledger");
  const { addProduct, listProducts } = await import("../src/lib/products");
  const { staffIds } = await seedBookable("lg-4", 2, true);
  await addLedgerEntry(db, "lg-4", { kind: "gider", method: "havale", items: [{ name: "Personel ödemesi · A", amountTl: 1000, staffId: staffIds[0] }, { name: "Kira", amountTl: 5000 }] }, "x");
  await addLedgerEntry(db, "lg-4", { kind: "gider", items: [{ name: "Personel ödemesi · B", amountTl: 800, staffId: staffIds[1] }] }, "x");
  const onlyA = await listLedger(db, "lg-4", { donem: "tumu", sekme: "personel", personelId: staffIds[0] });
  assert.equal(onlyA.entries.length, 1);
  assert.equal(onlyA.entries[0].amountTl, 1000);
  assert.equal((await listLedger(db, "lg-4", { donem: "tumu", sekme: "personel" })).entries.length, 2);
  assert.equal((await listLedger(db, "lg-4", { donem: "tumu", sekme: "gider" })).entries.length, 3);
  await expectAppError(addLedgerEntry(db, "lg-4", { kind: "gider", items: [{ name: "X", amountTl: 5, staffId: "yok" }] }), 422, "validation");
  await addProduct(db, "lg-4", { name: "Bakım kremi", priceTl: 250 }, "x");
  assert.equal((await listProducts(db, "lg-4")).length, 1);
  assert.equal((await listProducts(db, "lg-3")).length, 0, "ürünler kiracıya özel");
});

// ---------- Maaş ve prim planları ----------
test("payroll: salary and commission are generated once on the payment day; commission uses last month's staff income", async () => {
  const { savePlan, runDuePayroll, prevPeriod } = await import("../src/lib/payroll");
  const { addLedgerEntry, listLedger } = await import("../src/lib/ledger");
  const { staffIds } = await seedBookable("pay-1", 1, true);
  await savePlan(db, "pay-1", staffIds[0], { monthlySalaryTl: 10000, primPercent: 10, paymentDay: 5 }, "x");
  await addLedgerEntry(db, "pay-1", { kind: "gelir", occurredAt: "2030-04-10", items: [{ name: "Hizmet", amountTl: 2000, staffId: staffIds[0] }] }, "x");
  assert.equal(prevPeriod("2030-01"), "2029-12");
  assert.equal(await runDuePayroll(db, "pay-1", new Date("2030-05-04T12:00:00+03:00")), 0, "vade öncesi üretilmemeli");
  assert.equal(await runDuePayroll(db, "pay-1", new Date("2030-05-05T12:00:00+03:00")), 2, "maaş ve prim");
  assert.equal(await runDuePayroll(db, "pay-1", new Date("2030-05-06T12:00:00+03:00")), 0, "tekrar üretilmemeli");
  const v = await listLedger(db, "pay-1", { donem: "tumu", sekme: "gider" });
  assert.equal(v.entries.filter((e) => e.category === "Maaş").length, 1);
  const prim = v.entries.find((e) => e.category === "Prim")!;
  assert.equal(prim.amountTl, 200);
  assert.equal(prim.staffId, staffIds[0]);
});

// ---------- İsteğe bağlı özellikler ----------
test("modules: defaults apply, owners can switch features, and data is kept when a feature is off", async () => {
  const { getModules, saveModules, defaultModules } = await import("../src/lib/modules");
  await seedBookable("mod-1", 0, true);
  await setSector("mod-1", "sac-makyaj");
  const before = await getModules(db, "mod-1");
  assert.equal(before.products, false, "ürünler varsayılan kapalı");
  assert.equal(before.stats, true);
  const after = await saveModules(db, "mod-1", { stats: false, products: true, bilinmeyen: true }, "x");
  assert.equal(after.stats, false);
  assert.equal(after.products, true);
  assert.equal((await getModules(db, "mod-1")).stats, false, "değişiklik kalıcı olmalı");
  assert.equal(Object.keys(defaultModules()).includes("bilinmeyen"), false);
});

// ---------- İşletme profili ----------
test("business profile: logo, cover, contact, sector, gallery, and reviews are stored, validated, and scoped", async () => {
  const bp = await import("../src/lib/business-profile");
  const { listSectorListings } = await import("../src/lib/booking-public");
  await seedBookable("bp-1", 0, true);
  await seedBookable("bp-2", 0, true);
  const img = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  await bp.saveBusinessProfile(db, "bp-1", { logo: img, phone: "05321112233", address: "Merkez", sector: "sac-makyaj" }, "x");
  const p = await bp.getBusinessProfile(db, "bp-1");
  assert.equal(p!.logo, img);
  assert.equal(p!.phone, "05321112233");
  assert.equal(p!.address, "Merkez");
  assert.equal(p!.sector, "sac-makyaj");
  assert.equal(p!.cover, null, "kısmi güncelleme diğer alanları silmemeli");
  assert.equal((await bp.getBusinessProfile(db, "bp-2"))!.logo, null, "başka işletme etkilenmemeli");
  await expectAppError(bp.saveBusinessProfile(db, "bp-1", { logo: "javascript:alert(1)" }), 422, "validation");
  await expectAppError(bp.saveBusinessProfile(db, "bp-1", { sector: "bilinmeyen" }), 422, "validation");
  await bp.addGalleryPhoto(db, "bp-1", { image: img }, "x");
  const gid = (await bp.getBusinessProfile(db, "bp-1"))!.gallery[0].id;
  await bp.deleteGalleryPhoto(db, "bp-1", gid, "x");
  assert.equal((await bp.getBusinessProfile(db, "bp-1"))!.gallery.length, 0);
  await withTenant(db, "bp-1", (tx) => tx.query("INSERT INTO reviews (id, tenant_id, rating, body, customer_name) VALUES ('rv-1', 'bp-1', 4, 'İyi', 'Ayşe')"));
  await bp.setReviewStatus(db, "bp-1", "rv-1", "hidden", "x");
  assert.equal((await bp.getBusinessProfile(db, "bp-1"))!.rating.count, 0, "gizlenen yorum puana girmemeli");
  assert.ok((await listSectorListings(db, "sac-makyaj")).length >= 0);
});

test("public page: only published pages show, reviews start pending and count after approval", async () => {
  const bp = await import("../src/lib/business-profile");
  await seedBookable("pp-1", 0, true);
  await seedBookable("pp-2", 0, false);
  await setSector("pp-1", "sac-makyaj");
  await setSector("pp-2", "sac-makyaj");
  const page = await bp.getPublicBusinessPage(db, "pp-1");
  assert.ok(page, "yayındaki işletme sayfası dönmeli");
  assert.equal(page!.tenantId, "pp-1");
  assert.equal(page!.rating.count, 0);
  assert.equal(await bp.getPublicBusinessPage(db, "pp-2"), null, "yayında olmayan sayfa gösterilmemeli");
  assert.equal(await bp.getPublicBusinessPage(db, "yok-tenant"), null);
  await expectAppError(bp.addPublicReview(db, "pp-1", { name: "A", rating: 5 }), 422, "validation");
  await expectAppError(bp.addPublicReview(db, "pp-1", { name: "Ayşe", rating: 9 }), 422, "validation");
  await expectAppError(bp.addPublicReview(db, "pp-2", { name: "Ayşe", rating: 5 }), 404, "not_found");
  await bp.addPublicReview(db, "pp-1", { name: "Ayşe", rating: 4, body: "Harikaydı" });
  const before = await bp.getPublicBusinessPage(db, "pp-1");
  assert.equal(before!.reviews.length, 0, "bekleyen yorum yayınlanmamalı");
  assert.equal(before!.rating.count, 0, "bekleyen yorum puana girmemeli");
  const pending = await withTenant(db, "pp-1", (tx) => tx.query<{ id: string; status: string }>("SELECT id, status FROM reviews"));
  assert.equal(pending.rows[0].status, "pending");
  await bp.setReviewStatus(db, "pp-1", pending.rows[0].id, "shown", "x");
  const after = await bp.getPublicBusinessPage(db, "pp-1");
  assert.equal(after!.reviews.length, 1);
  assert.equal(after!.rating.count, 1);
  assert.equal(after!.rating.average, 4);
});

test("public page: services and prices can be hidden by the owner; rating breakdown counts shown reviews", async () => {
  const bp = await import("../src/lib/business-profile");
  await seedBookable("vis-1", 0, true);
  await setSector("vis-1", "sac-makyaj");
  let p = await bp.getPublicBusinessPage(db, "vis-1");
  assert.equal(p!.showServices, true, "varsayılan: hizmetler açık");
  assert.equal(p!.showPrices, true, "varsayılan: fiyatlar açık");
  await expectAppError(bp.saveBusinessProfile(db, "vis-1", { showPrices: "evet" }), 422, "validation");
  await bp.saveBusinessProfile(db, "vis-1", { showPrices: false }, "x");
  p = await bp.getPublicBusinessPage(db, "vis-1");
  assert.equal(p!.showPrices, false);
  assert.equal(p!.showServices, true, "kısmi güncelleme diğer bayrağı değiştirmemeli");
  assert.equal((await bp.getBusinessProfile(db, "vis-1"))!.showPrices, false);
  await withTenant(db, "vis-1", async (tx) => {
    await tx.query("INSERT INTO reviews (id, tenant_id, customer_name, rating, body, status) VALUES ('vr-1', 'vis-1', 'A', 5, '', 'shown'), ('vr-2', 'vis-1', 'B', 5, '', 'shown'), ('vr-3', 'vis-1', 'C', 2, '', 'shown'), ('vr-4', 'vis-1', 'D', 1, '', 'pending')");
  });
  p = await bp.getPublicBusinessPage(db, "vis-1");
  assert.deepEqual(p!.ratingBreakdown, [2, 0, 0, 1, 0], "yalnızca gösterilen yorumlar sayılır");
});

test("notifications: owner sees all counts, staff only their own, reviews are owner-only", async () => {
  const { getNotifications } = await import("../src/lib/notifications");
  const { staffIds } = await seedBookable("nt-1", 1, true);
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());
  const start = new Date(`${today}T00:00:00+03:00`).getTime();
  const starts = new Date(start + 12 * 3600e3).toISOString();
  const ends = new Date(start + 13 * 3600e3).toISOString();
  await withTenant(db, "nt-1", async (tx) => {
    await tx.query("INSERT INTO appointments (id, tenant_id, service_id, service_name, staff_id, customer_name, customer_phone, starts_at, ends_at) VALUES ('nap-1', 'nt-1', 'svc-nt-1', 'Saç kesimi', $1, 'Ayşe Yılmaz', '05320000001', $2, $3)", [staffIds[0], starts, ends]);
    await tx.query("INSERT INTO reminder_messages (id, tenant_id, appointment_id, to_phone, body) VALUES ('nrm-1', 'nt-1', 'nap-1', '05320000001', 'Merhaba')");
    await tx.query("INSERT INTO reviews (id, tenant_id, customer_name, rating, body) VALUES ('nrv-1', 'nt-1', 'A', 5, '')");
  });
  type N = { items: Array<{ key: string; count: number }>; total: number };
  const get = (r: N, k: string) => r.items.find((i) => i.key === k)?.count;
  const owner = (await getNotifications(db, "nt-1", { all: true }, true)) as N;
  assert.equal(get(owner, "new"), 1);
  assert.equal(get(owner, "today"), 1);
  assert.equal(get(owner, "reminders"), 1);
  assert.equal(get(owner, "reviews"), 1);
  assert.equal(owner.total, 4);
  const staff = (await getNotifications(db, "nt-1", { all: false, staffId: staffIds[0] }, false)) as N;
  assert.equal(get(staff, "today"), 1);
  assert.equal(staff.items.some((i) => i.key === "reviews"), false, "personel yorum bildirimi görmemeli");
  const other = (await getNotifications(db, "nt-1", { all: false, staffId: null }, false)) as N;
  assert.equal(get(other, "today"), 0, "personel kaydı olmayan üye hiçbir randevu görmemeli");
});

test("business profile: logo and cover fit (zoom and focus) are validated and reset when a new image is uploaded", async () => {
  const bp = await import("../src/lib/business-profile");
  await seedBookable("fit-1", 0, true);
  const img = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  await bp.saveBusinessProfile(db, "fit-1", { logo: img, cover: img }, "x");
  let p = await bp.getBusinessProfile(db, "fit-1");
  assert.equal(p!.logoFit, null, "varsayılan kırpma yok");
  await bp.saveBusinessProfile(db, "fit-1", { logoFit: { zoom: 1.5, x: 20, y: 80 }, coverFit: { zoom: 2, x: 50, y: 10 } }, "x");
  p = await bp.getBusinessProfile(db, "fit-1");
  assert.deepEqual(p!.logoFit, { zoom: 1.5, x: 20, y: 80 });
  assert.deepEqual(p!.coverFit, { zoom: 2, x: 50, y: 10 });
  const pub = await bp.getPublicBusinessPage(db, "fit-1");
  assert.equal(pub, null, "yayında olmayan işletme sayfası dönmez");
  await expectAppError(bp.saveBusinessProfile(db, "fit-1", { logoFit: { zoom: 5, x: 10, y: 10 } }), 422, "validation");
  await expectAppError(bp.saveBusinessProfile(db, "fit-1", { coverFit: { zoom: 1, x: -1, y: 10 } }), 422, "validation");
  await bp.saveBusinessProfile(db, "fit-1", { logo: img }, "x");
  assert.equal((await bp.getBusinessProfile(db, "fit-1"))!.logoFit, null, "yeni logo kırpmayı sıfırlar");
  assert.deepEqual((await bp.getBusinessProfile(db, "fit-1"))!.coverFit, { zoom: 2, x: 50, y: 10 }, "kapak kırpması korunur");
});

test("sector modules: photo delivery is only for photographers; other sectors cannot enable it", async () => {
  const { saveModules, getModules } = await import("../src/lib/modules");
  await seedBookable("sm-f", 0, true);
  await setSector("sm-f", "fotografci");
  await seedBookable("sm-k", 0, true);
  await setSector("sm-k", "sac-makyaj");
  assert.equal((await getModules(db, "sm-f")).photo_delivery, true);
  await expectAppError(saveModules(db, "sm-k", { photo_delivery: true }, "x"), 422, "validation");
  await saveModules(db, "sm-f", { stats: false }, "x");
  assert.equal((await getModules(db, "sm-f")).stats, false, "kapatılan modül kaydedilir");
});

test("photo delivery: limit, expiry, token scope and single submission", async () => {
  const dl = await import("../src/lib/delivery");
  const { saveModules } = await import("../src/lib/modules");
  await seedBookable("dl-1", 0, true);
  await setSector("dl-1", "fotografci");
  await seedBookable("dl-2", 0, true);
  await setSector("dl-2", "fotografci");
  const img = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  const { id, token } = await dl.createDeliverySession(db, "dl-1", { title: "Düğün çekimi", clientName: "Ayşe", photoLimit: 2 }, "x");
  const a = await dl.addDeliveryPhoto(db, "dl-1", id, { image: img }, "x");
  const b = await dl.addDeliveryPhoto(db, "dl-1", id, { image: img }, "x");
  await dl.addDeliveryPhoto(db, "dl-1", id, { image: img }, "x");
  const pub = await dl.getPublicDelivery(db, "dl-1", token);
  assert.equal(pub.photos.length, 3);
  assert.equal(pub.submitted, false);
  await expectAppError(dl.getPublicDelivery(db, "dl-1", "yanlis-token"), 404, "not_found");
  await expectAppError(dl.getPublicDelivery(db, "dl-2", token), 404, "not_found");
  await expectAppError(dl.submitDeliverySelection(db, "dl-1", token, { photoIds: [] }), 422, "validation");
  await expectAppError(dl.submitDeliverySelection(db, "dl-1", token, { photoIds: [a, b, a] }), 422, "validation");
  const pickThree = (await dl.getPublicDelivery(db, "dl-1", token)).photos.map((x) => x.id);
  await expectAppError(dl.submitDeliverySelection(db, "dl-1", token, { photoIds: pickThree }), 422, "validation");
  await dl.submitDeliverySelection(db, "dl-1", token, { photoIds: [a, b] });
  const after = await dl.getPublicDelivery(db, "dl-1", token);
  assert.equal(after.submitted, true);
  assert.equal(after.photos.filter((x) => x.selected).length, 2);
  await expectAppError(dl.submitDeliverySelection(db, "dl-1", token, { photoIds: [a] }), 409, "already_submitted");
  const sum = await dl.listDeliverySessions(db, "dl-1");
  assert.equal(sum[0].selectedCount, 2);
  await dl.updateDeliverySession(db, "dl-1", id, { closed: true }, "x");
  await expectAppError(dl.addDeliveryPhoto(db, "dl-1", id, { image: img }, "x"), 409, "closed");
  // Süre dolumu
  const s2 = await dl.createDeliverySession(db, "dl-1", { title: "Nişan", photoLimit: 5 }, "x");
  await dl.addDeliveryPhoto(db, "dl-1", s2.id, { image: img }, "x");
  await withTenant(db, "dl-1", (tx) => tx.query("UPDATE delivery_sessions SET expires_at = now() - interval '1 day' WHERE id = $1", [s2.id]));
  await expectAppError(dl.submitDeliverySelection(db, "dl-1", s2.token, { photoIds: [] }), 422, "validation");
  const pub2 = await dl.getPublicDelivery(db, "dl-1", s2.token);
  assert.equal(pub2.expired, true);
  // Modül kapalıysa uç nokta yok
  await saveModules(db, "dl-1", { photo_delivery: false }, "x");
  await expectAppError(dl.listDeliverySessions(db, "dl-1"), 404, "not_found");
});

test("venue: day and session bookings are unique, cancel frees the slot, deposit is validated, sector gate applies", async () => {
  const v = await import("../src/lib/venue");
  await seedBookable("vn-1", 0, true);
  await setSector("vn-1", "dugun-salonu");
  await seedBookable("vn-2", 0, true);
  await setSector("vn-2", "fotografci");
  const id1 = await v.createVenueSession(db, "vn-1", { date: "2026-12-05", slot: "gece", coupleName: "Ayşe & Mehmet", phone: "0532 111 22 33", priceTl: 90000, depositTl: 20000 }, "x");
  await expectAppError(v.createVenueSession(db, "vn-1", { date: "2026-12-05", slot: "gece", coupleName: "Başka Çift", priceTl: 1, depositTl: 0 }), 409, "slot_taken");
  await v.createVenueSession(db, "vn-1", { date: "2026-12-05", slot: "gunduz", coupleName: "Gündüz Çifti", priceTl: 50000, depositTl: 0 }, "x");
  await expectAppError(v.createVenueSession(db, "vn-1", { date: "2026-12-06", slot: "gece", coupleName: "Kapora Hatası", priceTl: 1000, depositTl: 5000 }), 422, "validation");
  await expectAppError(v.createVenueSession(db, "vn-1", { date: "2026-02-31", slot: "gece", coupleName: "Geçersiz Tarih" }), 422, "validation");
  let list = await v.listVenueSessions(db, "vn-1", "2026-12-01", "2026-12-31");
  assert.equal(list.length, 2);
  assert.equal(list.find((x) => x.slot === "gece")!.phone, "05321112233".replace(/^0/, "0"), "telefon rakamlara indirgenir");
  await v.updateVenueSession(db, "vn-1", id1, { status: "iptal" }, "x");
  await v.createVenueSession(db, "vn-1", { date: "2026-12-05", slot: "gece", coupleName: "Yeni Çift", priceTl: 1, depositTl: 0 }, "x");
  await expectAppError(v.updateVenueSession(db, "vn-1", id1, { status: "aktif" }, "x"), 409, "slot_taken");
  await expectAppError(v.listVenueSessions(db, "vn-2", "2026-12-01", "2026-12-31"), 404, "not_found");
  await expectAppError(v.listVenueSessions(db, "vn-1", "bozuk", "2026-12-31"), 422, "validation");
});

test("venue inquiries: only published venues accept requests; validation and status updates", async () => {
  const v = await import("../src/lib/venue");
  await seedBookable("vi-1", 0, false);
  await setSector("vi-1", "dugun-salonu");
  await expectAppError(v.createPublicInquiry(db, "vi-1", { name: "Ali Veli", phone: "05320000000" }), 404, "not_found");
  await withTenant(db, "vi-1", (tx) => tx.query("UPDATE tenant_profiles SET published = true"));
  await expectAppError(v.createPublicInquiry(db, "vi-1", { name: "A", phone: "05320000000" }), 422, "validation");
  await expectAppError(v.createPublicInquiry(db, "vi-1", { name: "Ali Veli", phone: "12" }), 422, "validation");
  await v.createPublicInquiry(db, "vi-1", { name: "Ali Veli", phone: "0532 000 00 00", eventDate: "2027-05-10", guestCount: 300, message: "Açık hava" });
  const items = await v.listVenueInquiries(db, "vi-1");
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "yeni");
  assert.equal(items[0].eventDate, "2027-05-10");
  await v.setVenueInquiryStatus(db, "vi-1", items[0].id, "teklif_verildi", "x");
  assert.equal((await v.listVenueInquiries(db, "vi-1"))[0].status, "teklif_verildi");
});

test("venue deposit: recorded once in the ledger, follows changes, and amenities are stored as a clean list", async () => {
  const v = await import("../src/lib/venue");
  const { listLedger } = await import("../src/lib/ledger");
  const bp = await import("../src/lib/business-profile");
  await seedBookable("vd-1", 0, true);
  await setSector("vd-1", "dugun-salonu");
  const id = await v.createVenueSession(db, "vd-1", { date: "2027-03-14", slot: "gece", coupleName: "Kapora Testi", priceTl: 50000, depositTl: 10000 }, "x");
  const deposits = async () => (await withTenant(db, "vd-1", (tx) => tx.query<{ amount_tl: string; category: string }>("SELECT amount_tl::text, category FROM ledger_entries WHERE venue_session_id IS NOT NULL")) ).rows;
  let d = await deposits();
  assert.equal(d.length, 1);
  assert.equal(Number(d[0].amount_tl), 10000);
  assert.equal(d[0].category, "Kapora");
  await v.updateVenueSession(db, "vd-1", id, { depositTl: 15000, priceTl: 50000 }, "x");
  d = await deposits();
  assert.equal(d.length, 1, "kapora değişince tek kayıt güncellenir");
  assert.equal(Number(d[0].amount_tl), 15000);
  await v.updateVenueSession(db, "vd-1", id, { status: "iptal" }, "x");
  assert.equal((await deposits()).length, 1, "iptalde kapora kaydı silinmez");
  const ledger = await listLedger(db, "vd-1", { donem: "bugun" });
  assert.ok(ledger.entries.some((e) => e.category === "Kapora"), "kasa listesinde kapora görünür");
  await bp.saveBusinessProfile(db, "vd-1", { amenities: ["  Bahçe ", "Kapalı salon", "bahçe", ""] }, "x");
  assert.deepEqual((await bp.getBusinessProfile(db, "vd-1"))!.amenities, ["Bahçe", "Kapalı salon", "bahçe"]);
  await expectAppError(bp.saveBusinessProfile(db, "vd-1", { amenities: "bahçe" }), 422, "validation");
});

test("venue halls: same slot is allowed in different halls, conflicts stay within a hall; share links show availability without names; suppliers validated", async () => {
  const v = await import("../src/lib/venue");
  await seedBookable("vh-1", 0, true);
  await setSector("vh-1", "dugun-salonu");
  const ana = (await v.listVenueHalls(db, "vh-1"))[0];
  assert.equal(ana.name, "Ana salon", "ilk salon otomatik oluşur");
  const hallId = await v.saveVenueHall(db, "vh-1", null, { name: "Bahçe salonu", capacity: 300 }, "x");
  await v.createVenueSession(db, "vh-1", { date: "2027-06-01", slot: "gece", coupleName: "Ana Salon Çifti", priceTl: 1, depositTl: 0 }, "x");
  await v.createVenueSession(db, "vh-1", { date: "2027-06-01", slot: "gece", coupleName: "Bahçe Çifti", priceTl: 1, depositTl: 0, hallId }, "x");
  await expectAppError(v.createVenueSession(db, "vh-1", { date: "2027-06-01", slot: "gece", coupleName: "Çakışma", priceTl: 1, depositTl: 0, hallId }), 409, "slot_taken");
  await expectAppError(v.createVenueSession(db, "vh-1", { date: "2027-06-02", slot: "gunduz", coupleName: "Yanlış Salon", priceTl: 1, depositTl: 0, hallId: "olmayan" }), 422, "validation");
  const sessions = await v.listVenueSessions(db, "vh-1", "2027-06-01", "2027-06-30", hallId);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].coupleName, "Bahçe Çifti");
  const token = await v.createVenueShareLink(db, "vh-1", { label: "Çift A", days: 30 }, "x");
  const av = await v.getSharedAvailability(db, "vh-1", token, "2027-06-01", "2027-06-30");
  assert.equal(av.taken.length, 2);
  assert.equal(JSON.stringify(av).includes("Çifti"), false, "paylaşımda kişi adı olmamalı");
  assert.deepEqual(Object.keys(av.taken[0]).sort(), ["date", "hallId", "slot"], "paylaşılan kayıtta yalnızca salon, tarih ve seans olmalı");
  await expectAppError(v.getSharedAvailability(db, "vh-1", "yanlis", "2027-06-01", "2027-06-30"), 404, "not_found");
  const link = (await v.listVenueShareLinks(db, "vh-1"))[0];
  await v.revokeVenueShareLink(db, "vh-1", link.id, "x");
  await expectAppError(v.getSharedAvailability(db, "vh-1", token, "2027-06-01", "2027-06-30"), 404, "not_found");
  await v.saveVenueSupplier(db, "vh-1", null, { name: "Ses Sistemi Ltd", category: "muzik", phone: "0532 000 00 00", costTl: 12000 }, "x");
  await expectAppError(v.saveVenueSupplier(db, "vh-1", null, { name: "Hatalı", category: "uzay" }, "x"), 422, "validation");
  const sup = await v.listVenueSuppliers(db, "vh-1");
  assert.equal(sup.length, 1);
  assert.equal(sup[0].costTl, 12000);
});

test("venue services: guest count and menu replace duration; other sectors keep duration", async () => {
  const w = await import("../src/lib/workspace");
  await seedBookable("vs-1", 0, true);
  await setSector("vs-1", "dugun-salonu");
  await seedBookable("vs-2", 0, true);
  await setSector("vs-2", "sac-makyaj");
  await w.addService(db, "vs-1", { name: "Düğün paketi", priceTl: 90000, guestCount: 300, menu: "etli" }, "x");
  await expectAppError(w.addService(db, "vs-1", { name: "Eksik paket", priceTl: 1000, menu: "etli" }), 422, "validation");
  await expectAppError(w.addService(db, "vs-1", { name: "Yanlış menü", priceTl: 1000, guestCount: 100, menu: "uzay" }), 422, "validation");
  const venue = (await w.listServices(db, "vs-1")).find((x) => x.name === "Düğün paketi")!;
  assert.equal(venue.guestCount, 300);
  assert.equal(venue.menu, "etli");
  await w.addService(db, "vs-2", { name: "Saç kesimi", priceTl: 500, durationMin: 45 }, "x");
  const other = (await w.listServices(db, "vs-2")).find((x) => x.name === "Saç kesimi" && x.durationMin === 45)!;
  assert.equal(other.guestCount, null);
  assert.equal(other.menu, null);
});

test("organization: events validated, staff must belong to the tenant, tasks and budget totals, other sectors blocked", async () => {
  const o = await import("../src/lib/org");
  const { seedBookable: sb } = { seedBookable };
  const { staffIds } = await sb("og-1", 1, true);
  await setSector("og-1", "organizasyon");
  await sb("og-2", 0, true);
  await setSector("og-2", "sac-makyaj");
  const id = await o.saveOrgEvent(db, "og-1", null, { title: "Kurumsal gala", clientName: "Acme", clientPhone: "0532 111 22 33", eventDate: "2027-04-20", location: "Hilton", guestCount: 200, budgetTl: 150000, status: "onaylandi" }, "x");
  await expectAppError(o.saveOrgEvent(db, "og-1", null, { title: "X", eventDate: "2027-04-20" }), 422, "validation");
  await expectAppError(o.saveOrgEvent(db, "og-1", null, { title: "Tarih yok", eventDate: "2027-02-30" }), 422, "validation");
  await o.setOrgEventStaff(db, "og-1", id, [staffIds[0]], "x");
  await expectAppError(o.setOrgEventStaff(db, "og-1", id, ["baska-kisi"], "x"), 422, "validation");
  await o.addOrgTask(db, "og-1", id, { title: "Mekan onayı", dueDate: "2027-04-01", assigneeId: staffIds[0] }, "x");
  await o.addOrgTask(db, "og-1", id, { title: "Davetiye" }, "x");
  let d = await o.getOrgEvent(db, "og-1", id);
  assert.equal(d.tasks.length, 2);
  await o.setOrgTaskDone(db, "og-1", d.tasks[0].id, true, "x");
  let list = await o.listOrgEvents(db, "og-1");
  assert.equal(list[0].taskTotal, 2);
  assert.equal(list[0].taskDone, 1);
  assert.deepEqual(list[0].staffIds, [staffIds[0]]);
  await o.addOrgCost(db, "og-1", id, { name: "Ses ve ışık", category: "ekipman", amountTl: 40000 }, "x");
  await o.addOrgCost(db, "og-1", id, { name: "Yemek", category: "yemek", amountTl: 60000 }, "x");
  d = await o.getOrgEvent(db, "og-1", id);
  await o.setOrgCostPaid(db, "og-1", d.costs[0].id, true, "x");
  list = await o.listOrgEvents(db, "og-1");
  assert.equal(list[0].costTotal, 100000);
  assert.equal(list[0].costPaid, 40000);
  await expectAppError(o.addOrgCost(db, "og-1", id, { name: "Hatalı", amountTl: "" }), 422, "validation");
  await o.deleteOrgEvent(db, "og-1", id, "x");
  assert.equal((await o.listOrgEvents(db, "og-1")).length, 0);
  await expectAppError(o.listOrgEvents(db, "og-2"), 404, "not_found");
});

test("bridal files: created with status, validated, status changes persist, only hair and makeup sector", async () => {
  const b = await import("../src/lib/bridal");
  await seedBookable("br-1", 0, true);
  await setSector("br-1", "sac-makyaj");
  await seedBookable("br-2", 0, true);
  await setSector("br-2", "dugun-salonu");
  await b.saveBridalFile(db, "br-1", null, { brideName: "Elif Demir", phone: "0533 000 11 22", weddingDate: "2027-06-12", trialDate: "2027-05-02", package: "Gelin + nişan" }, "x");
  await expectAppError(b.saveBridalFile(db, "br-1", null, { brideName: "A" }), 422, "validation");
  await expectAppError(b.saveBridalFile(db, "br-1", null, { brideName: "Tarih", weddingDate: "2027-02-31" }), 422, "validation");
  let list = await b.listBridalFiles(db, "br-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "planlandi");
  assert.equal(list[0].phone, "05330001122");
  await b.saveBridalFile(db, "br-1", list[0].id, { status: "deneme_yapildi" }, "x");
  list = await b.listBridalFiles(db, "br-1");
  assert.equal(list[0].status, "deneme_yapildi");
  assert.equal(list[0].weddingDate, "2027-06-12", "kısmi güncelleme tarihi silmemeli");
  await expectAppError(b.listBridalFiles(db, "br-2"), 404, "not_found");
  await b.deleteBridalFile(db, "br-1", list[0].id, "x");
  assert.equal((await b.listBridalFiles(db, "br-1")).length, 0);
});

test("admin: only admins reach the console; disabled accounts cannot sign in; admins cannot demote or disable themselves", async () => {
  const adm = await import("../src/lib/admin");
  const { login: doLogin } = await import("../src/lib/auth");
  const adminId = await createUser(db, "root-admin@example.com", "yönetici-şifre-1");
  await db.transaction((tx) => tx.query("UPDATE users SET is_admin = true WHERE id = $1", [adminId]));
  const plainId = await createUser(db, "plain-user@example.com", "kullanici-şifre-1");
  const a = await doLogin(db, "root-admin@example.com", "yönetici-şifre-1");
  const u = await doLogin(db, "plain-user@example.com", "kullanici-şifre-1");
  assert.equal((await adm.requireAdmin(db, a.token)).id, adminId);
  await expectAppError(adm.requireAdmin(db, u.token), 403, "forbidden");
  await expectAppError(adm.requireAdmin(db, null), 401, "unauthenticated");
  await expectAppError(adm.setAdminUserFlags(db, adminId, adminId, { isAdmin: false }), 422, "validation");
  await adm.setAdminUserFlags(db, adminId, plainId, { disabled: true });
  assert.equal(await currentUser(db, u.token), null, "devre dışı kullanıcının oturumu kapanır");
  await expectAppError(doLogin(db, "plain-user@example.com", "kullanici-şifre-1"), 403, "account_disabled");
  await adm.setAdminUserFlags(db, adminId, plainId, { disabled: false });
  assert.ok((await adm.listAdminUsers(db)).some((x) => x.id === plainId));
});

test("admin packages and module flags: unknown modules rejected; a globally disabled module is off for every tenant", async () => {
  const adm = await import("../src/lib/admin");
  const { getModules } = await import("../src/lib/modules");
  await seedBookable("ad-1", 0, true);
  await setSector("ad-1", "fotografci");
  await expectAppError(adm.saveAdminPackage(db, "pro", { name: "Pro", priceTl: 100, modules: ["olmayan_modul"] }), 422, "validation");
  await adm.saveAdminPackage(db, "pro", { name: "Profesyonel", priceTl: 990, modules: ["stats", "ledger"], active: true });
  const pk = (await adm.listAdminPackages(db)).find((x) => x.id === "pro")!;
  assert.deepEqual(pk.modules, ["stats", "ledger"]);
  await setPlanAndRestore("ad-1", "pro", async () => {
    const m = await getModules(db, "ad-1");
    assert.equal(m.stats, true);
    assert.equal(m.photo_delivery, false, "paket kapsamı dışındaki modül kapalı");
  });
  await adm.saveAdminPackage(db, "pro", { name: "Profesyonel", priceTl: 990, modules: ["stats", "ledger", "photo_delivery"] });
  await adm.setAdminModule(db, "stats", { enabled: false });
  assert.equal((await getModules(db, "ad-1")).stats, false, "global kapatma tüm firmalarda geçerli");
  await adm.setAdminModule(db, "stats", { enabled: true });
  assert.equal((await getModules(db, "ad-1")).stats, true);
});

async function setPlanAndRestore(tenantId: string, plan: string, fn: () => Promise<void>) {
  await db.transaction((tx) => tx.query("UPDATE tenants SET plan = $2 WHERE id = $1", [tenantId, plan]));
  try { await fn(); } finally { await db.transaction((tx) => tx.query("UPDATE tenants SET plan = 'starter' WHERE id = $1", [tenantId])); }
}

test("site settings: valid content is stored, unsafe colors and links are rejected, a corrupt stored value falls back to defaults", async () => {
  const site = await import("../src/lib/site");
  const { DEFAULTS } = await import("../src/lib/site-defaults");
  const before = await site.getSiteSettings(db);
  assert.equal(before.home.heroTitle, DEFAULTS.home.heroTitle);
  const theme = { ...DEFAULTS.theme, light: { ...DEFAULTS.theme.light, primary: "#0a4d5c" }, buttonRadius: "square", defaultMode: "dark" };
  await site.saveSiteSetting(db, "theme", theme);
  const after = await site.getSiteSettings(db);
  assert.equal(after.theme.light.primary, "#0a4d5c");
  assert.equal(after.theme.defaultMode, "dark");
  await expectAppError(site.saveSiteSetting(db, "theme", { ...theme, light: { ...theme.light, primary: "red; background:url(x)" } }), 422, "validation");
  await expectAppError(site.saveSiteSetting(db, "theme", { ...theme, displayFont: "Comic Sans" }), 422, "validation");
  await expectAppError(site.saveSiteSetting(db, "footer", { text: "x", credit: "", links: [{ label: "Kötü", href: "javascript:alert(1)" }] }), 422, "validation");
  await expectAppError(site.saveSiteSetting(db, "nope", {}), 404, "not_found");
  await db.transaction((tx) => tx.query("UPDATE site_settings SET value = '{\"light\": 5}'::jsonb WHERE key = 'theme'"));
  assert.equal((await site.getSiteSettings(db)).theme.light.primary, DEFAULTS.theme.light.primary, "bozuk kayıt varsayılana döner");
});

async function main() {
  await setup();
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${name}\n    ${(err as Error).message.split("\n").slice(0, 4).join("\n    ")}`);
    }
  }
  await pg.close();
  console.log(`\n${tests.length - failed}/${tests.length} test geçti`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecordManager } from "@/components/RecordManager";
import { MembersManager } from "./MembersManager";
import { PasswordForm } from "./PasswordForm";
import { ModuleToggles } from "./ModuleToggles";
import { ThemeChooser } from "./ThemeChooser";

interface Props {
  tenantId: string;
  sector: string | null;
  publicSrc: string;
  isOwner: boolean;
  profile: { description: string; phone: string; email: string; address: string; published: boolean };
  days: Array<{ on: boolean; opensAt: string; closesAt: string }>;
  members: Array<{ userId: string; email: string; role: string }>;
  modules: Record<string, boolean>;
  currentUserId: string;
  audit: Array<{ id: string; action: string; target: string | null; actorId: string | null; createdAt: string }>;
}

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit", width: "100%" } as const;
const label = { display: "grid", gap: 4, fontSize: ".85rem", color: "var(--muted)" } as const;

const AUDIT_LABELS: Record<string, string> = {
  "appointment.create": "Randevu oluşturuldu",
  "appointment.cancel": "Randevu iptal edildi",
  "appointment.tamamlandi": "Randevu tamamlandı",
  "appointment.gelmedi": "Müşteri gelmedi",
  "service.add": "Hizmet eklendi", "service.update": "Hizmet güncellendi", "service.delete": "Hizmet silindi",
  "staff.add": "Personel eklendi", "staff.update": "Personel güncellendi", "staff.delete": "Personel silindi",
  "profile.save": "Profil kaydedildi",
  "reminder.sent": "Hatırlatma gönderildi", "reminder.cancelled": "Hatırlatma iptal edildi",
  "member.invite": "Ekip üyesi davet edildi", "member.remove": "Ekip üyesi çıkarıldı",
};
const DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export function SettingsManager({ tenantId, sector, publicSrc, isOwner, profile, days, members, currentUserId, audit, modules }: Props) {
  return (
    <div style={{ display: "grid", gap: 32 }}>
      <ThemeChooser />
      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Profil ve yayın</h2>
        <p className="muted" style={{ margin: 0 }}>Profil yayındayken işletmeniz sektör sayfasında ve randevu sayfasında görünür.</p>
        <ProfileForm tenantId={tenantId} values={profile} days={days} isOwner={isOwner} />
      </section>

      {isOwner && (
        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>İşlem kayıtları</h2>
          <p className="muted" style={{ margin: 0 }}>Son 50 işlem. Kayıtlar değiştirilemez ve silinemez.</p>
          {audit.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Henüz kayıt yok.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4, fontSize: ".9rem" }}>
              {audit.map((a) => {
                const actor = members.find((m) => m.userId === a.actorId)?.email ?? "Sistem / müşteri";
                return (
                  <li key={a.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--muted)", minWidth: 120 }}>{DATE_FMT.format(new Date(a.createdAt))}</span>
                    <span>{AUDIT_LABELS[a.action] ?? a.action}</span>
                    <span style={{ color: "var(--muted)" }}>· {actor}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Ekip</h2>
        <p className="muted" style={{ margin: 0 }}>Ekip üyeleri işletmenin randevularını ve ayarlarını yönetebilir. Yeni üye e-postadaki bağlantıyla parolasını belirler.</p>
        <MembersManager tenantId={tenantId} members={members} currentUserId={currentUserId} isOwner={isOwner} />
      </section>


      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Hesap</h2>
        <PasswordForm />
      </section>

      {isOwner && (
        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Özellikler</h2>
          <p className="muted" style={{ margin: 0 }}>İşletmenize ihtiyaç duymadığınız alanları kapatın. Kapatılan alanlar gizlenir; kayıtlar silinmez.</p>
          <ModuleToggles tenantId={tenantId} modules={modules as never} sector={sector} />
        </section>
      )}

    </div>
  );
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function ProfileForm({ tenantId, values, days, isOwner }: { tenantId: string; values: Props["profile"]; days: Props["days"]; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setOk(false);
    const res = await fetch(`/api/tenants/${tenantId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: f.get("description"),
        phone: f.get("phone"),
        address: f.get("address"),
        published: f.get("published") === "on",
        dayHours: days.map((_, i) => ({
          on: f.get(`on${i}`) === "on",
          opensAt: f.get(`open${i}`),
          closesAt: f.get(`close${i}`),
        })),
        email: values.email,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { fields?: string[] };
      setError(body.fields?.length ? `Hatalı alan: ${body.fields.join(", ")}` : "Kaydedilemedi.");
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <label style={{ ...label, gridColumn: "1 / -1" }}>Kısa tanıtım
        <textarea name="description" rows={3} defaultValue={values.description} style={{ ...input, resize: "vertical" }} disabled={!isOwner} />
      </label>
      <label style={label}>Telefon<input name="phone" defaultValue={values.phone} style={input} disabled={!isOwner} /></label>
      <label style={label}>Adres<input name="address" defaultValue={values.address} style={input} disabled={!isOwner} /></label>
      <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
        <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>Çalışma saatleri (gün bazlı)</span>
        {days.map((d, i) => (
          <div key={i} style={{ display: "grid", gap: 8, gridTemplateColumns: "120px auto 1fr 1fr", alignItems: "center" }}>
            <span>{DAY_NAMES[i]}</span>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name={`on${i}`} defaultChecked={d.on} disabled={!isOwner} /> Açık
            </label>
            <input name={`open${i}`} type="time" step={1800} defaultValue={d.opensAt} style={input} disabled={!isOwner} aria-label={`${DAY_NAMES[i]} açılış`} />
            <input name={`close${i}`} type="time" step={1800} defaultValue={d.closesAt} style={input} disabled={!isOwner} aria-label={`${DAY_NAMES[i]} kapanış`} />
          </div>
        ))}
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", gridColumn: "1 / -1" }}>
        <input type="checkbox" name="published" defaultChecked={values.published} disabled={!isOwner} /> Profili yayınla (sektör sayfasında ve randevu sayfasında görünsün)
      </label>
      {isOwner && (
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer" }}>
            {busy ? "Kaydediliyor…" : "Profili kaydet"}
          </button>
          {ok && <small style={{ color: "#067647" }}>Kaydedildi</small>}
          {error && <small style={{ color: "#b42318" }}>{error}</small>}
        </div>
      )}
    </form>
  );
}

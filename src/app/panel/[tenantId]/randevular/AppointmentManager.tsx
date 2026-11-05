"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Item {
  id: string;
  serviceName: string;
  staffId: string | null;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: "onaylandi" | "tamamlandi" | "gelmedi" | "iptal";
}

interface Props {
  tenantId: string;
  initialPhone?: string;
  initialName?: string;
  hours: { open: number; close: number } | null;
  day: string;
  items: Item[];
  services: Array<{ id: string; name: string; durationMin: number }>;
  staff: Array<{ id: string; name: string }>;
}


const TIME_FMT = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

const FIELD_LABELS: Record<string, string> = {
  serviceId: "hizmet", date: "tarih", time: "saat", customerName: "müşteri adı", customerPhone: "telefon", staffId: "personel",
};

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit", width: "100%" } as const;
const label = { display: "grid", gap: 4, fontSize: ".85rem", color: "var(--muted)" } as const;

export function AppointmentManager({ tenantId, initialPhone = "", initialName = "", hours, day, items, services, staff }: Props) {
  const router = useRouter();
  const TIME_OPTIONS: string[] = [];
  for (let m = hours?.open ?? 0; hours && m < hours.close; m += 30) {
    TIME_OPTIONS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("");
  const [time, setTime] = useState(TIME_OPTIONS[0] ?? "09:00");
  const [name, setName] = useState(initialName);
  const [reschedId, setReschedId] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState(day);
  const [reschedTime, setReschedTime] = useState(TIME_OPTIONS[0] ?? "09:00");
  const [phone, setPhone] = useState(initialPhone);
  const base = `/api/tenants/${tenantId}/appointments`;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, staffId: staffId || null, date: day, time, customerName: name, customerPhone: phone }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setPhone("");
      router.refresh();
      return;
    }
    setError(await readError(res));
  }

  async function setOutcome(id: string, status: "tamamlandi" | "gelmedi") {
    setBusy(true);
    setError(null);
    const res = await fetch(`${base}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(await readError(res));
  }

  async function reschedule(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`${base}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: reschedDate, time: reschedTime }),
    });
    setBusy(false);
    if (res.ok) { setReschedId(null); router.refresh(); }
    else setError(await readError(res));
  }

  async function cancel(id: string) {
    if (!window.confirm("Bu randevu iptal edilsin mi? Saat yeniden boşalır.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`${base}/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(await readError(res));
  }

  const active = items.filter((i) => i.status === "onaylandi");
  const count = (s: Item["status"]) => items.filter((i) => i.status === s).length;
  const STATUS_TEXT: Record<Item["status"], string> = { onaylandi: "", tamamlandi: " · Tamamlandı", gelmedi: " · Gelmedi", iptal: " · İptal edildi" };
  const staffName = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name ?? "Personel" : "—");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Gün programı ({active.length})</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: ".9rem" }}>
          Toplam {items.length} · Onaylı {active.length} · Tamamlandı {count("tamamlandi")} · Gelmedi {count("gelmedi")} · İptal {count("iptal")}
        </p>
        {items.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Bu gün için randevu yok.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {items.map((a) => (
              <li key={a.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, border: "1px solid var(--border)", opacity: a.status === "iptal" ? 0.5 : 1 }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <strong>{TIME_FMT.format(new Date(a.startsAt))} – {TIME_FMT.format(new Date(a.endsAt))} · {a.customerName}</strong>
                  <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                    {a.serviceName} · {staffName(a.staffId)} · {a.customerPhone}
                    {STATUS_TEXT[a.status]}
                  </span>
                </div>
                {a.status === "onaylandi" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" disabled={busy} onClick={() => setOutcome(a.id, "tamamlandi")} style={{ padding: "8px 12px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer" }}>
                      Tamamlandı
                    </button>
                    <button type="button" disabled={busy} onClick={() => setOutcome(a.id, "gelmedi")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>
                      Gelmedi
                    </button>
                    <button type="button" disabled={busy} onClick={() => { setReschedId(a.id); setReschedDate(day); setReschedTime(TIME_OPTIONS[0] ?? "09:00"); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>
                      Taşı
                    </button>
                    <button type="button" disabled={busy} onClick={() => cancel(a.id)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>
                      İptal et
                    </button>
                  </div>
                )}
                {reschedId === a.id && (
                  <div style={{ width: "100%", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input type="date" value={reschedDate} min={day} onChange={(e) => setReschedDate(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }} />
                    <select value={reschedTime} onChange={(e) => setReschedTime(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}>
                      {TIME_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <button type="button" disabled={busy} onClick={() => reschedule(a.id)} style={{ padding: "8px 12px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer" }}>Kaydet</button>
                    <button type="button" onClick={() => setReschedId(null)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>Vazgeç</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: "grid", gap: 12, padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Randevu ekle</h2>
        {hours === null ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Bu gün işletme kapalı. Bu güne randevu eklenemez.</p>
        ) : services.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Randevu eklemek için önce hizmet tanımlayın (Hizmet, personel ve profil sayfası).</p>
        ) : (
          <form onSubmit={add} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={label}>Hizmet
              <select style={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMin} dk</option>)}
              </select>
            </label>
            <label style={label}>Personel
              <select style={input} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Fark etmez</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={label}>Saat
              <select style={input} value={time} onChange={(e) => setTime(e.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={label}>Müşteri adı
              <input style={input} required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label style={label}>Telefon
              <input style={input} type="tel" required placeholder="05XX XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer", width: "100%" }}>
                {busy ? "Kaydediliyor…" : "Randevuyu ekle"}
              </button>
            </div>
          </form>
        )}
        {error && <p role="alert" style={{ color: "#b42318", margin: 0 }}>{error}</p>}
      </section>
    </div>
  );
}

async function readError(res: Response): Promise<string> {
  if (res.status === 409) return "Bu saat dolu. Başka bir saat ya da personel seçin.";
  if (res.status === 403) return "Bu işlem için yetkiniz yok.";
  const data = (await res.json().catch(() => ({}))) as { fields?: string[] };
  if (res.status === 422 && data.fields?.length) {
    return `Lütfen şu alanları kontrol edin: ${data.fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.`;
  }
  return "İşlem tamamlanamadı.";
}

"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  tenantId: string;
  services: Array<{ id: string; name: string; priceTl: number; durationMin: number }>;
  staff: Array<{ id: string; name: string; role: string }>;
}

interface Slot { time: string; available: boolean }

const FIELD_LABELS: Record<string, string> = {
  serviceId: "hizmet",
  date: "tarih",
  time: "saat",
  customerName: "ad soyad",
  customerPhone: "telefon numarası (5XX XXX XX XX)",
  staffId: "personel",
};

// Türkiye saatine göre bugünün tarihi (YYYY-MM-DD).
function todayIstanbul(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00+03:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
}

export function BookingForm({ tenantId, services, staff }: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayIstanbul());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);
  const today = useMemo(() => todayIstanbul(), []);

  async function loadSlots() {
    if (!serviceId || !date) return;
    setLoadingSlots(true);
    try {
      const qs = new URLSearchParams({ serviceId, date });
      if (staffId) qs.set("staffId", staffId);
      const res = await fetch(`/api/public/tenants/${encodeURIComponent(tenantId)}/slots?${qs.toString()}`);
      const body = await res.json();
      setSlots(res.ok ? (body.items as Slot[]) : []);
      if (!res.ok) setError("Saatler yüklenemedi. Lütfen tekrar deneyin.");
    } catch {
      setError("Bağlantı sorunu oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    setTime(null);
    setError(null);
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, staffId, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) return setError("Lütfen bir saat seçin.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/tenants/${encodeURIComponent(tenantId)}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId, staffId: staffId || null, date, time, customerName: name, customerPhone: phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setDone({ date, time });
        return;
      }
      if (res.status === 409) {
        setError("Bu saat az önce doldu. Lütfen başka bir saat seçin.");
        await loadSlots();
        return;
      }
      if (res.status === 429) {
        setError("Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.");
        return;
      }
      if (res.status === 422 && Array.isArray(body.fields)) {
        const names = body.fields.map((f: string) => FIELD_LABELS[f] ?? f).join(", ");
        setError(`Lütfen şu alanları kontrol edin: ${names}.`);
        return;
      }
      setError("Randevu alınamadı. Lütfen tekrar deneyin.");
    } catch {
      setError("Bağlantı sorunu oluştu. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ display: "grid", gap: 10 }} role="status">
        <h2 style={{ margin: 0 }}>Randevunuz alındı</h2>
        <p style={{ margin: 0 }}>{prettyDate(done.date)}, saat {done.time}.</p>
        <p className="muted" style={{ margin: 0 }}>İşletme sizinle iletişime geçebilir.</p>
      </div>
    );
  }

  const available = slots.filter((s) => s.available);

  return (
    <form className="card" onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Randevu al</h2>

      {services.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Bu işletmenin henüz tanımlı hizmeti yok.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="svc">Hizmet</label>
            <select id="svc" className="select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.durationMin} dk{s.priceTl > 0 ? ` · ${s.priceTl} TL` : ""}</option>
              ))}
            </select>
          </div>

          {staff.length > 0 && (
            <div className="field">
              <label htmlFor="stf">Personel</label>
              <select id="stf" className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Fark etmez</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="dt">Tarih</label>
            <input id="dt" type="date" className="input" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <p className="label" style={{ margin: "0 0 8px", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" }}>
              Boş saatler {loadingSlots ? "· yükleniyor…" : ""}
            </p>
            {!loadingSlots && available.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Bu gün için boş saat yok. Başka bir tarih deneyin.</p>
            ) : (
              <div className="chips" role="group" aria-label="Boş saatler">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    className="chip"
                    disabled={!s.available}
                    aria-pressed={time === s.time}
                    onClick={() => setTime(s.time)}
                    style={!s.available ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="nm">Ad soyad</label>
            <input id="nm" className="input" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="tl">Telefon</label>
            <input id="tl" className="input" type="tel" required autoComplete="tel" placeholder="05XX XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {error && <p role="alert" style={{ color: "var(--danger, #b42318)", margin: 0 }}>{error}</p>}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy || !time}>
            {busy ? "Gönderiliyor…" : "Randevuyu onayla"}
          </button>
        </>
      )}
    </form>
  );
}

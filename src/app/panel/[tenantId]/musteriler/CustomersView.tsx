"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomerModal } from "./CustomerModal";
import { fmtDate, initial, phoneLabel } from "./format";

export interface CustomerCard { phone: string; name: string; email: string; photo: string | null; total: number; lastStartsAt: string | null; nextStartsAt: string | null }

const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)" } as const;

// Müşteri listesi: özet kartları, arama, müşteri kartları ve detay penceresi.
export function CustomersView({ tenantId, customers, staffNames, isOwner, notes }: {
  tenantId: string; customers: CustomerCard[]; staffNames: Record<string, string>; isOwner: boolean; notes: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr-TR");
    if (!s) return customers;
    return customers.filter((c) => c.name.toLocaleLowerCase("tr-TR").includes(s) || c.phone.includes(s.replace(/\D/g, "") || "#"));
  }, [q, customers]);

  const withAppointments = customers.filter((c) => c.total > 0).length;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/customers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), phone: f.get("phone") }),
    });
    setBusy(false);
    if (!res.ok) { setError("Müşteri eklenemedi. Ad ve telefonu kontrol edin."); return; }
    setAdding(false);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Stat label="Toplam müşteri" value={`${customers.length} kişi`} />
        <Stat label="Randevusu olan müşteriler" value={`${withAppointments} kişi`} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya telefon ara…" aria-label="Müşteri ara" style={{ ...input, flex: "1 1 260px", maxWidth: 420 }} />
        <button type="button" onClick={() => setAdding((v) => !v)} style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
          {adding ? "Vazgeç" : "+ Müşteri ekle"}
        </button>
      </div>

      {adding && (
        <form onSubmit={add} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "end", padding: 16, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
          <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" }}>Ad soyad<input name="name" required minLength={2} style={input} /></label>
          <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" }}>Telefon<input name="phone" type="tel" required placeholder="05XX XXX XX XX" style={input} /></label>
          <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>{busy ? "Ekleniyor…" : "Kaydet"}</button>
          {error && <p role="alert" style={{ margin: 0, color: "#b42318", gridColumn: "1 / -1" }}>{error}</p>}
        </form>
      )}

      {filtered.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>{customers.length === 0 ? "Henüz müşteri yok. İlk randevu alındığında ya da müşteri eklendiğinde burada görünür." : "Aramanızla eşleşen müşteri yok."}</p>
      ) : (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((c) => (
            <article key={c.phone} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 18, display: "grid", gap: 14 }}>
              <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, var(--plum-700), var(--accent))", flexShrink: 0 }}>{initial(c.name || "M")}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "İsimsiz müşteri"}</strong>
                  <span style={{ color: "var(--muted)", fontSize: ".86rem" }}>{phoneLabel(c.phone)}</span>
                </div>
              </header>
              <div style={{ display: "grid", gap: 0, borderRadius: 14, background: "var(--subtle)", overflow: "hidden", fontSize: ".9rem" }}>
                <Row l="Toplam randevu" v={`${c.total} randevu`} />
                <Row l="Son randevu" v={fmtDate(c.lastStartsAt)} />
                <Row l="Sonraki randevu" v={fmtDate(c.nextStartsAt)} />
              </div>
              <footer style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setOpenPhone(c.phone)} style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700 }}>Detayları gör</button>
                <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer" aria-label={`${c.name} WhatsApp`} style={{ width: 44, height: 44, borderRadius: 12, background: "#25d366", color: "#fff", display: "grid", placeItems: "center", textDecoration: "none", fontWeight: 800 }}>W</a>
              </footer>
            </article>
          ))}
        </div>
      )}

      {openPhone && (
        <CustomerModal tenantId={tenantId} phone={openPhone} isOwner={isOwner} staffNames={staffNames} notes={notes} onClose={() => setOpenPhone(null)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)", display: "grid", gap: 6 }}>
      <span style={{ color: "var(--muted)", fontSize: ".78rem", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
      <strong style={{ fontSize: "1.7rem" }}>{value}</strong>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--muted)" }}>{l}</span>
      <span>{v}</span>
    </div>
  );
}

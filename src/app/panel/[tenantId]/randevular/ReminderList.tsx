"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Item { id: string; customerName: string; startsAt: string; to: string; body: string; link: string }

const TIME_FMT = new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

// Sağlayıcı yok: mesaj WhatsApp'ta açılır, işletme gönderir ve burada "Gönderildi" işaretler.
export function ReminderList({ tenantId, items }: { tenantId: string; items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark(id: string, status: "sent" | "cancelled") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError("Kaydedilemedi. Lütfen tekrar deneyin.");
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Hatırlatmalar ({items.length})</h2>
      {items.length === 0 ? (
        <p style={{ color: "var(--muted)", margin: 0 }}>Önümüzdeki 24 saat için bekleyen hatırlatma yok.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {items.map((r) => (
            <li key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gap: 2 }}>
                <strong>{r.customerName}</strong>
                <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{TIME_FMT.format(new Date(r.startsAt))} · {r.to}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 12px", borderRadius: 10, background: "#25d366", color: "#fff", textDecoration: "none" }}>
                  WhatsApp&apos;ta aç
                </a>
                <button type="button" disabled={busy} onClick={() => mark(r.id, "sent")} style={{ padding: "8px 12px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer" }}>
                  Gönderildi
                </button>
                <button type="button" disabled={busy} onClick={() => mark(r.id, "cancelled")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>
                  Vazgeç
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" style={{ color: "#b42318", margin: 0 }}>{error}</p>}
    </section>
  );
}

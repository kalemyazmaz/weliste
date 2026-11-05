"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Item { key: string; title: string; description: string; count: number; href: string }

// Bildirim zili: açıldığında işlemleri kart listesi olarak aşağı açar; her kart ilgili panel sayfasına gider.
export function NotificationBell({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/notifications`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch { /* ağ hatasında zil sessizce boş kalır */ }
  }

  useEffect(() => { load(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label={total > 0 ? `Bildirimler (${total} yeni)` : "Bildirimler"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative", width: 36, height: 36, borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", display: "grid", placeItems: "center", cursor: "pointer" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {total > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#EC806E", color: "#fff", fontSize: ".7rem", fontWeight: 800, display: "grid", placeItems: "center" }}>{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: 44, zIndex: 50, width: "min(340px, calc(100vw - 32px))", padding: 10, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 12px 32px rgba(11,31,51,.14)", display: "grid", gap: 8 }}>
          <strong style={{ padding: "4px 6px" }}>Bildirimler</strong>
          {items === null ? (
            <p style={{ margin: 0, padding: 8, color: "var(--muted)" }}>Yükleniyor…</p>
          ) : (
            items.map((i) => (
              <Link key={i.key} href={i.href} onClick={() => setOpen(false)} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, border: "1px solid var(--line)", background: i.count > 0 ? "var(--bg)" : "transparent", color: "var(--text)", textDecoration: "none" }}>
                <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: ".92rem" }}>{i.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>{i.description}</span>
                </span>
                <span style={{ minWidth: 30, padding: "3px 9px", borderRadius: 999, textAlign: "center", fontWeight: 800, background: i.count > 0 ? "var(--accent)" : "var(--line)", color: i.count > 0 ? "var(--text)" : "var(--muted)" }}>{i.count}</span>
              </Link>
            ))
          )}
          <Link href={`/panel/${tenantId}/randevular`} onClick={() => setOpen(false)} style={{ padding: "8px 6px", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>Randevulara git →</Link>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlanRow } from "@/lib/payroll";

const input = { padding: "8px 10px", borderRadius: 10, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;

// Maaş ve prim planları: her personel için aylık maaş, prim yüzdesi, ödeme günü ve durum.
export function PayrollPlans({ tenantId, plans }: { tenantId: string; plans: PlanRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>, staffId: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(staffId); setError(null); setOk(null);
    const res = await fetch(`/api/tenants/${tenantId}/payroll/${staffId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlySalaryTl: f.get("salary"), primPercent: f.get("prim"), paymentDay: f.get("day"), active: f.get("active") === "on",
      }),
    });
    setBusy(null);
    if (res.ok) { setOk("Plan kaydedildi."); router.refresh(); } else setError("Plan kaydedilemedi. Değerleri kontrol edin.");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: ".9rem" }}>
        Maaş, ödeme gününde o ayın tutarı olarak kasaya gider yazılır. Prim, ödeme gününde önceki ayın personele bağlı gelirinin yüzdesi olarak yazılır.
      </p>
      {plans.map((p) => (
        <form key={p.staffId} onSubmit={(e) => save(e, p.staffId)} style={{ display: "grid", gap: 10, gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr auto auto", alignItems: "end", padding: 12, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
          <strong style={{ alignSelf: "center" }}>{p.name}</strong>
          <label style={{ display: "grid", gap: 4, fontSize: ".8rem", color: "var(--muted)" }}>Aylık maaş (TL)<input name="salary" type="number" min={0} step="0.01" defaultValue={p.monthlySalaryTl} style={input} /></label>
          <label style={{ display: "grid", gap: 4, fontSize: ".8rem", color: "var(--muted)" }}>Prim (%)<input name="prim" type="number" min={0} max={100} step="0.01" defaultValue={p.primPercent} style={input} /></label>
          <label style={{ display: "grid", gap: 4, fontSize: ".8rem", color: "var(--muted)" }}>Ödeme günü
            <select name="day" defaultValue={p.paymentDay} style={input}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: ".85rem", paddingBottom: 8 }}>
            <input type="checkbox" name="active" defaultChecked={p.active} /> Aktif
          </label>
          <button type="submit" disabled={busy === p.staffId} style={{ padding: "9px 14px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>{busy === p.staffId ? "…" : "Kaydet"}</button>
        </form>
      ))}
      {ok && <p role="status" style={{ margin: 0, color: "#067647" }}>{ok}</p>}
      {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}
    </div>
  );
}

import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Yönetim özeti: kullanıcı, işletme, yayındaki firma ve devre dışı hesap sayıları.
export default async function AdminHome() {
  const r = await getDb().transaction((tx) =>
    tx.query<{ users: number; tenants: number; listed: number; disabled: number }>(
      `SELECT (SELECT count(*)::int FROM users) AS users,
              (SELECT count(*)::int FROM tenants) AS tenants,
              (SELECT count(*)::int FROM booking_listings WHERE published) AS listed,
              (SELECT count(*)::int FROM users WHERE disabled) AS disabled`,
    ),
  );
  const s = r.rows[0];
  const cards = [["Kullanıcı", s.users], ["İşletme", s.tenants], ["Yayında firma", s.listed], ["Devre dışı hesap", s.disabled]] as const;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h1 style={{ margin: 0 }}>Özet</h1>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {cards.map(([label, value]) => (
          <div key={label} style={{ display: "grid", gap: 6, padding: 18, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{label}</span>
            <strong style={{ fontSize: "1.8rem" }}>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

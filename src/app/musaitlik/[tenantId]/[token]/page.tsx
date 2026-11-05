import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSharedAvailability } from "@/lib/venue";
import { AppError } from "@/lib/errors";
import { Availability } from "./Availability";

export const dynamic = "force-dynamic";

// Paylaşılan müsaitlik sayfası: oturumsuz, kişi bilgisi yok, yalnızca dolu / boş durumu.
export default async function AvailabilityPage({ params }: { params: Promise<{ tenantId: string; token: string }> }) {
  const { tenantId, token } = await params;
  const now = new Date();
  const from = `${now.toISOString().slice(0, 7)}-01`;
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const to = `${now.toISOString().slice(0, 7)}-${String(last).padStart(2, "0")}`;
  let data;
  try {
    data = await getSharedAvailability(getDb(), tenantId, token, from, to);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <strong>Weliste</strong> <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>· Müsaitlik takvimi</span>
      </header>
      <Availability tenantId={tenantId} token={token} initialFrom={from} initialTo={to} initial={data} />
    </main>
  );
}

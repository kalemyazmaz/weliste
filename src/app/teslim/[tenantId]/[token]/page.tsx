import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicDelivery } from "@/lib/delivery";
import { AppError } from "@/lib/errors";
import { DeliveryClient } from "./DeliveryClient";

export const dynamic = "force-dynamic";

// Müşteri teslim sayfası: hesap gerektirmez; yalnızca işletmenin verdiği link çalışır.
export default async function DeliveryPublicPage({ params }: { params: Promise<{ tenantId: string; token: string }> }) {
  const { tenantId, token } = await params;
  let data;
  try {
    data = await getPublicDelivery(getDb(), tenantId, token);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <strong>Weliste</strong> <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>· Fotoğraf seçimi</span>
      </header>
      <DeliveryClient tenantId={tenantId} token={token} data={data} />
    </main>
  );
}

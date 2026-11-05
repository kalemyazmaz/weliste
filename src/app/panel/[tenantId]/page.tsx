import { redirect } from "next/navigation";

// Eski panel adresi: işletme paneli randevu ekranıdır.
export default async function Panel({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  redirect(`/panel/${tenantId}/randevular`);
}

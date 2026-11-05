import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site";
import { ContentEditor } from "./ContentEditor";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const s = await getSiteSettings(getDb());
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Ön sayfa, header ve footer</h1>
      <p style={{ margin: 0, color: "var(--muted)" }}>Ana sayfanın metinleri, üst menü ve alt bilgi burada düzenlenir. Her bölüm ayrı kaydedilir.</p>
      <ContentEditor home={s.home} header={s.header} footer={s.footer} />
    </div>
  );
}

import { LIGHT_PAGE } from "@/components/light-page";
import Link from "next/link";
import { RandevuHeader } from "@/components/randevu-shell";

// Yasal sayfaların ortak düzeni. Metinler taslaktır; yayın öncesi hukuki inceleme gerekir.
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <RandevuHeader />
      <main id="icerik" style={LIGHT_PAGE}>
        <article className="section" style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 18 }}>
          <div className="container" style={{ display: "grid", gap: 18 }}>
            <p role="note" style={{ margin: 0, padding: 12, borderRadius: 12, background: "var(--gold-100)", color: "var(--text)", fontSize: ".9rem" }}>
              Bu metin taslaktır. Yayına almadan önce hukuki inceleme yapılmalıdır.
            </p>
            <h1 style={{ margin: 0 }}>{title}</h1>
            {children}
            <p style={{ margin: 0 }}><Link href="/randevu">← Randevu sayfasına dön</Link></p>
          </div>
        </article>
      </main>
    </>
  );
}

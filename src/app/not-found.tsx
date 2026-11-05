import Link from "next/link";
import { RandevuHeader } from "@/components/randevu-shell";

export default function NotFound() {
  return (
    <>
      <RandevuHeader />
      <main id="icerik">
        <section className="section" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
          <div className="container">
            <span className="eyebrow">404</span>
            <h1>Aradığınız sayfa bulunamadı</h1>
            <p className="lead" style={{ margin: "0 auto 24px" }}>Bağlantı taşınmış ya da silinmiş olabilir.</p>
            <div className="hero__ctas" style={{ justifyContent: "center" }}>
              <Link className="btn btn--primary" href="/randevu">Sektörlere bak</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

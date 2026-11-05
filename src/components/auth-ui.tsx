import { BrandMark } from "@/components/brand-mark";
// Ortak giriş/kayıt görünümü: tasarım sistemiyle (design.css) uyumlu.
import Link from "next/link";
import { LIGHT_PAGE } from "@/components/light-page";

export function AuthPage({ eyebrow, title, lead, children, footer }: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/"><BrandMark />Weliste</Link>
      </div>
    </header>
    <main className="section" style={{ paddingTop: "clamp(40px, 7vw, 80px)", ...LIGHT_PAGE, minHeight: "100svh" }}>
      <div className="container">
        <div className="auth">
          <div className="section__head section__head--center" style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.3rem)", margin: 0 }}>{title}</h1>
            {lead && <p className="muted" style={{ margin: 0 }}>{lead}</p>}
          </div>
          {children}
          {footer && <div className="muted center" style={{ marginTop: 22, fontSize: ".95rem" }}>{footer}</div>}
        </div>
      </div>
    </main>
    </>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label>
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

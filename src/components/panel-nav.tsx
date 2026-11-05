"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { PanelIcon } from "@/components/panel-icons";

export interface NavItem { key: string; label: string; href: string; icon: string; external?: boolean }
export interface NavGroup { title: string; items: NavItem[] }

// Mobil alt gezinme çubuğu ve tüm menünün açıldığı alt sayfa (sheet).
export function PanelNav({ groups, current, quick }: { groups: NavGroup[]; current: string; quick: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="pn-bottom" aria-label="Panel hızlı menü">
        {quick.map((q) => (
          <Link key={q.key} href={q.href} aria-current={current === q.key ? "page" : undefined}>
            <PanelIcon name={q.icon} />
            <span>{q.label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <PanelIcon name="menu" />
          <span>Menü</span>
        </button>
      </nav>
      {open && (
        <div className="pn-sheet" role="dialog" aria-modal="true" aria-label="Menü" onClick={() => setOpen(false)}>
          <div className="pn-sheet-body" onClick={(e) => e.stopPropagation()}>
            {groups.map((g) => (
              <section key={g.title} style={{ marginBottom: 14 }}>
                <p className="pn-group-title">{g.title}</p>
                {g.items.map((i) => (
                  <Link key={i.key} href={i.href} className="pn-link" aria-current={current === i.key ? "page" : undefined} onClick={() => setOpen(false)}>
                    <PanelIcon name={i.icon} />
                    <span>{i.label}</span>
                  </Link>
                ))}
              </section>
            ))}
            <div style={{ marginTop: 8 }}><LogoutButton /></div>
            <button type="button" onClick={() => setOpen(false)} style={{ marginTop: 10, width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Kapat</button>
          </div>
        </div>
      )}
    </>
  );
}

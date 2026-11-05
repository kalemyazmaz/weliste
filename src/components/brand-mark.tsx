// Weliste sembolü: iki harfli W. Tek renk, mevcut metin rengini alır (currentColor).
// Kaynak: Weliste Marka Kimliği, ana sembol. Resmi SVG dosyası gelene kadar bu çizim kullanılır.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={{ flexShrink: 0, color: "inherit" }}>
      <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="14,30 30,84 50,46" />
        <polyline points="62,18 62,84 86,36" />
      </g>
    </svg>
  );
}

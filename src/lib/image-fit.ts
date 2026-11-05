import type { CSSProperties } from "react";

// Logo ve kapak görselinin kırpma ayarı: yakınlaştırma (boyut) ve odak noktası (konum, yüzde).
// Bu dosya veritabanı içermez; hem sunucu hem istemci tarafından kullanılır.
export interface ImageFit { zoom: number; x: number; y: number }

export const DEFAULT_FIT: ImageFit = { zoom: 1, x: 50, y: 50 };

export function parseFit(v: unknown): ImageFit | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  const zoom = Number(f.zoom), x = Number(f.x), y = Number(f.y);
  if (![zoom, x, y].every(Number.isFinite)) return null;
  if (zoom < 1 || zoom > 3 || x < 0 || x > 100 || y < 0 || y > 100) return null;
  return { zoom: Math.round(zoom * 100) / 100, x: Math.round(x), y: Math.round(y) };
}

// Görseli kutuya doldurur (cover), seçilen odak noktası etrafında yakınlaştırır.
export function fitStyle(fit: ImageFit | null): CSSProperties {
  const f = fit ?? DEFAULT_FIT;
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${f.x}% ${f.y}%`,
    transform: `scale(${f.zoom})`,
    transformOrigin: `${f.x}% ${f.y}%`,
    display: "block",
  };
}

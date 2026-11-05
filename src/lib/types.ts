// Ortak tipler. Randevu ürününün tenant modeli.
export interface Tenant {
  id: string;
  name: string;
  city: string;
  plan: "starter" | "pro" | "enterprise";
  sector: string | null;
}

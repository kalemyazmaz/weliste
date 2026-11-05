import { AppError } from "./errors";

// Rol bazlı yetkiler. Sahip (owner) her işlemi yapar. Üye (staff) randevu ve müşteri işlemlerini yapar;
// hizmet, personel, profil, ekip ve denetim kayıtlarına erişemez.
export type Role = "owner" | "staff";
export type Action = "manage_catalog" | "manage_profile" | "manage_members" | "view_audit" | "manage_appointments" | "manage_customers" | "manage_customer_records" | "view_ledger";

const ALL: Action[] = ["manage_catalog", "manage_profile", "manage_members", "view_audit", "manage_appointments", "manage_customers", "manage_customer_records", "view_ledger"];
const MATRIX: Record<Role, Action[]> = {
  owner: ALL,
  staff: ["manage_appointments", "manage_customers"],
};

export function can(role: string, action: Action): boolean {
  return (MATRIX[role as Role] ?? []).includes(action);
}

export function assertCan(role: string, action: Action): void {
  if (!can(role, action)) throw new AppError(403, "forbidden");
}

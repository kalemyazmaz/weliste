import { getDb } from "@/lib/db";
import { listAdminUsers } from "@/lib/admin";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await listAdminUsers(getDb());
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Kullanıcılar</h1>
      <p style={{ margin: 0, color: "var(--muted)" }}>Hesapları yönetici yapabilir ya da devre dışı bırakabilirsiniz. Devre dışı hesaplar giriş yapamaz ve açık oturumları kapanır.</p>
      <UsersTable users={users} />
    </div>
  );
}

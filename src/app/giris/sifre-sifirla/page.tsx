import Link from "next/link";
import { AuthPage } from "@/components/auth-ui";
import { ResetConfirmForm } from "@/components/auth-forms";

export default async function SifreSifirlaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthPage eyebrow="Yeni şifre" title="Şifrenizi belirleyin" footer={<Link href="/giris">Girişe dön</Link>}>
      {token ? <ResetConfirmForm token={token} /> : <div className="notice">Bağlantı eksik. Yeni bir sıfırlama isteyin.</div>}
    </AuthPage>
  );
}

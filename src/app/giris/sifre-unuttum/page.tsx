import Link from "next/link";
import { AuthPage } from "@/components/auth-ui";
import { ResetRequestForm } from "@/components/auth-forms";

export default function SifreUnuttumPage() {
  return (
    <AuthPage
      eyebrow="Şifre sıfırlama"
      title="Şifremi unuttum"
      lead="E-posta adresinizi girin; sıfırlama bağlantısını gönderelim."
      footer={<Link href="/giris">Girişe dön</Link>}
    >
      <ResetRequestForm />
    </AuthPage>
  );
}

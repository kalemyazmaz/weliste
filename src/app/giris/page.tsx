import Link from "next/link";
import { AuthPage } from "@/components/auth-ui";
import { LoginForm } from "./LoginForm";

export default function GirisPage() {
  return (
    <AuthPage
      eyebrow="İşletme girişi"
      title="Hesabınıza giriş yapın"
      lead="Panelinize erişmek için e-posta ve şifrenizi girin."
      footer={
        <>
          <Link href="/giris/sifre-unuttum">Şifremi unuttum</Link>
          {" · "}
          <Link href="/kayit">Hesap oluştur</Link>
        </>
      }
    >
      <LoginForm />
    </AuthPage>
  );
}

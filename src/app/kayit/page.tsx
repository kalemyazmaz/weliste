import Link from "next/link";
import { AuthPage } from "@/components/auth-ui";
import { SignupForm } from "@/components/auth-forms";

export default function KayitPage() {
  return (
    <AuthPage
      eyebrow="Ücretsiz başlayın"
      title="Hesap oluşturun"
      lead="İşletmeniz için birkaç dakikada panel açın."
      footer={<>Zaten hesabınız var mı? <Link href="/giris"><b>Giriş yapın</b></Link></>}
    >
      <SignupForm />
    </AuthPage>
  );
}

import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Gizlilik politikası — Weliste" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Gizlilik politikası">
      <p>Weliste olarak gizliliğinize önem veriyoruz. Bu politika, sitemizi ve randevu hizmetimizi kullanırken hangi bilgilerin toplandığını ve nasıl korunduğunu açıklar.</p>
      <h2>Toplanan bilgiler</h2>
      <p>Randevu formunda girdiğiniz ad soyad ve telefon numarası ile seçtiğiniz randevu bilgileri.</p>
      <h2>Çerezler</h2>
      <p>İşletme panelinde oturumunuzu sürdürmek için zorunlu bir oturum çerezi kullanılır. Bu çerez yalnızca oturum açıkken tutulur.</p>
      <h2>Güvenlik</h2>
      <p>Parolalar güvenli biçimde özetlenerek saklanır. Veriler her işletmenin kendi alanında ayrı tutulur.</p>
      <h2>Değişiklikler</h2>
      <p>Bu politika güncellenebilir; güncel sürüm bu sayfada yayımlanır.</p>
    </LegalPage>
  );
}

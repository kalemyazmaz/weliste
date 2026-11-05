import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "KVKK aydınlatma metni — Weliste" };

export default function KvkkPage() {
  return (
    <LegalPage title="KVKK aydınlatma metni">
      <p>Weliste, randevu almanız ve işletmenizin randevularını yönetebilmeniz için aşağıdaki kişisel verileri işler.</p>
      <h2>İşlenen veriler</h2>
      <ul>
        <li>Ad soyad ve telefon numarası</li>
        <li>Seçilen hizmet, personel, tarih ve saat bilgileri</li>
        <li>Hatırlatma mesajlarının gönderim durumu</li>
      </ul>
      <h2>İşleme amaçları</h2>
      <ul>
        <li>Randevu oluşturma, değiştirme ve iptal işlemlerinin yürütülmesi</li>
        <li>Randevu hatırlatmalarının işletme tarafından gönderilmesi</li>
        <li>Güvenlik ve denetim kayıtlarının tutulması</li>
      </ul>
      <h2>Hukuki sebep</h2>
      <p>Randevu hizmetinin ifası ve hukuki yükümlülüklerin yerine getirilmesi.</p>
      <h2>Aktarım</h2>
      <p>Verileriniz randevu aldığınız işletme ile paylaşılır. Verileriniz üçüncü kişilere satılmaz.</p>
      <h2>Saklama</h2>
      <p>Veriler, hizmetin gerektirdiği süre boyunca ve yasal saklama süreleri dolana kadar tutulur.</p>
      <h2>Haklarınız</h2>
      <p>KVKK&apos;nın 11. maddesi kapsamında verilerinizin silinmesini, düzeltilmesini ve işlenip işlenmediğini öğrenmeyi talep edebilirsiniz. Talep yöntemi için <a href="/yasal/veri-silme">veri silme sayfasına</a> bakın.</p>
      <h2>Veri sorumlusu ve iletişim</h2>
      <p>[Şirket unvanı, adres ve iletişim e-postası yayın öncesi eklenecek.]</p>
    </LegalPage>
  );
}

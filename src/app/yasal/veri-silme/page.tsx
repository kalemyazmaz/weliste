import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Veri silme talebi — Weliste" };

export default function DataDeletionPage() {
  return (
    <LegalPage title="Veri silme talebi">
      <p>Randevu kaydınızdaki kişisel verilerin silinmesini istiyorsanız aşağıdaki adımları izleyin.</p>
      <ol>
        <li>Talebinizi, randevu aldığınız işletmeye veya aşağıdaki iletişim adresine yazın.</li>
        <li>Talebinizde ad soyad ve randevu sırasında kullandığınız telefon numarasını belirtin.</li>
        <li>Kimliğinizi doğrulamamız için gerekli olabilecek bilgileri paylaşın.</li>
      </ol>
      <p>Talepler en geç 30 gün içinde sonuçlandırılır. Silinen randevu kayıtları yasal saklama yükümlülükleri dışında kalıcı olarak kaldırılır.</p>
      <p><strong>İletişim:</strong> [Talep e-postası yayın öncesi eklenecek.]</p>
    </LegalPage>
  );
}

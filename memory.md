# Proje Hafızası

Son güncelleme: 2026-11-04

Bu dosya yalnızca kesinleşmiş ve tekrar kullanılacak bilgileri içerir. Geçici konuşmalar, reddedilen seçenekler ve doğrulanmamış varsayımlar buraya yazılmaz. Parola, erişim anahtarı ve gereksiz kişisel veri kaydedilmez.

## Proje kimliği

- Ürün: düğün ve etkinlik odaklı randevu, teklif ve yönetim platformu. Marka adı: **Weliste** (kurumsal kimlik kılavuzu, 2026-11-04). Marka tescili ve alan adı henüz doğrulanmadı.
- Sektörler (`src/lib/sectors.ts`, 2026-11-04): dugun-salonu, fotografci, organizasyon, sac-makyaj. Eski dört sektör (guzellik-salonu, kuafor, danisman, fizyoterapist) ürün listesinden çıkarıldı; veritabanı kısıtı bunları hâlâ kabul eder, çünkü geliştirme veritabanında bu sektörlerde işletmeler var (bkz. açık kararlar).
- Teknoloji: Next.js 15, TypeScript, PostgreSQL. Dil: Türkçe. Kaynak: `README.md`.
- Çok kiracılı; kiracı izolasyonu PostgreSQL RLS ile. Uygulama `organiza_app` rolüyle bağlanır (tablo sahibi değil).

## Karar kaydı

- 2026-11-03: Ürün yönü genel sektör randevu. Kullanıcı önerinin tamamını onayladı.
- 2026-11-04: Ürün yeniden düğün odaklı kuruldu (kullanıcı onayı). Yalnızca dört düğün sektörü; sektöre özel modüller `src/lib/module-catalog.ts` içinde sektör alanıyla tanımlı.
- 2026-11-04: Yönetim paneli (`/admin`, yalnız `users.is_admin`) kuruldu: kullanıcılar, paketler, modül bayrakları, ön sayfa/header/footer içeriği ve site ayarları (renk, yazı tipi, düğme, varsayılan mod). Ayarlar doğrulanır; serbest CSS ve script kabul edilmez.
- 2026-11-04: Marka kimliği uygulandı (petrol, tebeşir, kömür; Fraunces başlık, Inter Tight arayüz). Açık ve koyu mod için tokenlar `src/app/design.css` sonunda.
- 2026-11-03: Düğün ürünü kod tabanından silindi (2026-11-04'te yeniden eklendi; önceki silme kaydı tarihsel olarak burada kalır). Silmeden önce tam bir yedek alındı: `scratchpad/backup-before-wedding-removal/organiza-saas-snapshot.tar` (proje kökü dışında). Proje git deposu değildi.
- 2026-11-03: Geliştirme veritabanından düğün verileri silindi: bookings, payments, event_sessions, halls, packages, venues, leads, outbox_messages tabloları; tenants.business_type ve tenant_profiles içindeki features, whatsapp_phone, contract_template sütunları; düğün işletmesi t-demo'nun hizmet, personel, profil, üyelik ve liste kayıtları. Kullanıcı onayıyla 2026-11-03'te t-demo tenant satırı ve 5 denetim kaydı da silindi (denetim tetikleyicisi yalnızca bu işlem için geçici kapatıldı, sonra açıldı). Geliştirmede düğüne ait veri kalmadı.
- `tenants.business_type` alanı kaldırıldı. Ürün ayrımı artık yalnızca `sector` alanıyla yapılır.

## Mevcut kapsam

- Kimlik: kayıt (sektör zorunlu), giriş (hız sınırlı), oturum (yalnızca token özeti saklanır), parola sıfırlama.
- İşletme ayarları: hizmetler (süre, fiyat), personel, profil ve yayın. Yayın açıksa `booking_listings` tablosu güncellenir.
- Müşteri akışı: `/randevu` → `/randevu/[sektor]` → `/randevu/[sektor]/[tenantId]` (hizmet, personel, tarih, saat, ad, telefon).
- Panel: `/panel/[id]/randevular` (günlük program, iptal, manuel ekleme), `/panel/[id]/ayarlar`. `/panel/[id]` randevu ekranına yönlendirir.
- Randevu kuralları: adım 30 dk, +03:00. Çalışma saatleri işletmeye özel (`tenant_profiles.opens_min/closes_min`, varsayılan 09:00–20:00), ayarlar sayfasından değiştirilir; slotlar, herkese açık API ve manuel saat seçenekleri bunu kullanır. Kiracı bazlı danışmanlık kilidi ile eşzamanlı çakışma engellenir. Personel seçilmezse boş olan ilk personel atanır; ekip yoksa tek kapasiteli kaynak. İptal kaydı silmez, durumu değiştirir. Denetim kaydında müşteri verisi yoktur.
- Yayın dışı işletmeler müşteri tarafında görünmez ve randevu alınamaz (test edildi).

## Doğrulama durumu (2026-11-03)

- `npm test`: 37/37 geçti. `npm run typecheck`: temiz. `npm run build`: başarılı, 28 rota.
- Tarayıcıda (Playwright) uçtan uca: kayıt → ayarlar (hizmet, personel, yayın) → müşteri randevusu → panelde görünme → iptal. Eski rotalar (`/mekanlar`, `/fiyatlandirma`, `/api/leads`, `/yonetim`) 404 döner; `/` → `/randevu`.
- Yerel geliştirme veritabanı: PostgreSQL 18 (`embedded-postgres`, `scratchpad/pgdev`), veritabanı `organiza`. Demo işletmeler: `t-demo-randevu` (seed), `t-be659bce` (fizyoterapist, geliştirme).

## Bilinen eksikler


## Hatırlatmalar (2026-11-03)

- Kanal kararı: WhatsApp, `wa.me` bağlantısıyla işletme tarafından manuel gönderim. Sağlayıcı entegrasyonu yok. E-posta kullanılmaz (müşteride e-posta kaydı yok).
- Tablo `reminder_messages` (randevu başına en fazla bir kayıt, RLS). Kuyruğa alma: panel açılırken 24 saat içindeki onaylı randevular için. `src/lib/reminders.ts`.
- Panel: `/panel/[id]/randevular` içinde "Hatırlatmalar" bölümü: WhatsApp'ta aç, Gönderildi, Vazgeç. Durum değişiklikleri denetim kaydına yazılır.
- Testler: 34/34. Tarayıcıda uçtan uca doğrulandı (randevu → hatırlatma listede → Gönderildi → listeden düştü).
- Kuyruğa alma: randevu oluşturulunca ve panel açılınca yapılır. Zaman geçerek 24 saat penceresine giren randevular için zamanlanmış görev yok; panel açılışı veya yeni randevu bunu tetikler.

## Yerel geliştirme (2026-11-03, kullanıcı kararı: hız için yerel)

- Yayın yok; herkese açık link verilemez. Uygulama: http://localhost:3100 (benim başlattığım süreç).
- Tohum: `npm run db:seed` çalıştırıldı; demo işletme `t-demo-randevu` (güzellik salonu) yayında. README'de yerel kurulum adımları var.
- Personel silme: gelecekteki onaylı randevusu olan personel silinemez (409 `staff_has_appointments`). Panelde Türkçe mesaj gösterilir. Testler 35/35.
- Ana sayfada "Nasıl çalışır?" bölümü eklendi.

## Marka kimliği (2026-11-03, kullanıcı kurumsal kimlik kılavuzunu sundu)

- Marka: FIARBU (her zaman büyük harf), açılım "Firma Ara Bul". Slogan: "İşletmeleri bul. Randevunu al. İşini yönet."
- Renkler: gece mavisi #0B1F33, kurumsal lacivert #102A43, keşif turkuazı #17B8A6 (vurgu), açık mint #D8F5F0, amber #F2B84B, mercan #EC806E (uyarı). Metin ve bağlantılarda kontrast için koyu turkuaz #0F9D8B kullanıldı.
- Yazı tipi: Inter (zaten yerel dosya olarak yüklü).
- Logo: F harfi + turkuaz nokta (kılavuz A seçeneği). Bileşen: `src/components/brand-mark.tsx`; uygulama simgesi `public/icon.svg`.
- Uygulandı: CSS belirteçleri, logo, simge, manifest, başlık/metadata, ana sayfa sloganı.
- Karanlık tema kılavuza göre uygulandı (gece mavisi zemin, turkuaz birincil düğme, açık metin). Tarayıcıda doğrulandı.
- Eksik: tescil, alan adı ve sosyal kullanıcı adı kontrolü kılavuzun yayın öncesi listesinde; yapılmadı.

## Panel markalaması (2026-11-03)

- Ortak panel çerçevesi `src/components/panel-shell.tsx`: FIARBU işareti, işletme adı, sekmeler (Randevular, Hizmet, personel ve profil), müşteri sayfası bağlantısı. Randevular ve ayarlar sayfaları bunu kullanıyor.
- Tarayıcıda doğrulandı (açık tema). Testler 37/37.
- Kalan: panel içi kartlar ve formlar satır içi stil kullanıyor; ortak sınıflara taşınması ileride yapılabilir.

## Müşteri sayfası önizlemesi (2026-11-03)

- Ayarlar sayfasının sonunda "Müşteri sayfası önizlemesi": müşterinin gördüğü randevu sayfasının iframe'i. Telefon / masaüstü genişlik geçişi, yeni sekmede aç. Profil yayında değilse uyarı gösterilir (müşteri sayfası o durumda 404).
- `src/app/panel/[tenantId]/ayarlar/PublicPreview.tsx`.
- Mobil düzeltme: üst gezinme tek satırda yatay kayabilir (randevu ve panel üst bölümleri).
- Testler 37/37. Tarayıcıda doğrulandı.

## Oturum çerezi düzeltmesi (2026-11-03)

- Sorun: Oturum çerezi üretim modunda her zaman `Secure` gönderiliyordu. http://localhost ve yerel ağ adresinde tarayıcılar bu çerezi kabul etmediği için giriş yapılıyor ama panel tekrar girişe yönlendiriyordu.
- Çözüm: `Secure` yalnızca istek HTTPS ise eklenir (`isHttpsRequest`, `x-forwarded-proto` dahil). `src/lib/http.ts`, giriş ve kayıt uçları.
- Doğrulama: localhost ve LAN adresinde giriş ve panel açılışı tarayıcıda test edildi.
- Sunucu şu an yalnızca 127.0.0.1 üzerinde dinliyor (geliştirme hesapları ağa açık kalmasın).

## Gün bazlı çalışma saatleri (2026-11-03)

- `tenant_profiles.day_hours` (jsonb, 7 eleman, 0 = Pazar; eleman null = kapalı gün). Boşsa `opens_min/closes_min` geçerli.
- Randevu mantığı tarihin gününe göre çözer (`weekdayOf`): kapalı günde slot yok, randevu 422. Panel randevu formu kapalı günde gizlenir.
- Ayarlar: 7 gün için "Açık" kutusu + açılış/kapanış. Tarayıcıda doğrulandı (pazar kapatıldı, slotlar boş).
- Testler 40/40.
- Geliştirme işletmesinin (t-be659bce) pazarı kapalı bırakıldı.

## Plan maddeleri: müşteri kartı ve yasal sayfalar (2026-11-03)

- Müşteriler: `/panel/[id]/musteriler`. Liste randevulardan türetilir (ayrı tablo yok; anahtar telefon). Seçilen müşterinin randevu geçmişi. `src/lib/customers.ts`. Testler 41/41.
- Yasal sayfalar (TASLAK): `/yasal/kvkk`, `/yasal/gizlilik`, `/yasal/veri-silme`. Her sayfada "taslak, hukuki inceleme gerekir" notu var. Şirket unvanı ve iletişim e-postası yer tutucu; yayın öncesi doldurulmalı.
- Plan (MVP-1) kapsamındaki yerel maddeler tamamlandı: sektörler, randevu akışı, işletme paneli, ekip ve müşteri, hatırlatma, yasal sayfalar.
- Açık: yayın (hosting, veritabanı, alan adı), hukuki metinlerin incelenmesi, iletişim bilgileri, sözleşme/abonelik modeli.

## Panel eksik işlevleri: ilk dalga (2026-11-03)

- Eklendi: çıkış düğmesi (panel üst bölümü), randevu sonucu (Tamamlandı / Gelmedi; yalnızca onaylı randevudan), gün özeti (toplam, onaylı, tamamlandı, gelmedi, iptal). Durum kısıtı şemada genişletildi.
- Testler 42/42. Tarayıcıda doğrulandı (özet, çıkış ve oturumun kapanması).
- Hâlâ eksik (öncelik bekleniyor): hizmet ve personel düzenleme (yalnızca ekle/sil var), ekip üyesi yönetimi (birden çok kullanıcı), denetim kaydı görünümü, istatistikler, randevu yeniden planlama (taşıma), müşteri notları, parola değiştirme.

## Panel eksikleri: sırayla tamamlandı (2026-11-03)

1. Hizmet ve personel düzenleme (PATCH + satır içi düzenleme).
2. Ekip üyeleri: sahip davet eder (yeni kullanıcıya rastgele parola + parola belirleme e-postası), üye çıkarır. `src/lib/members.ts`.
3. İşlem kayıtları (yalnızca sahip, son 50 işlem, Türkçe etiketler).
4. İstatistikler (`/panel/[id]/istatistikler`): son 30 gün, sonuçlar, gelmeme oranı, doluluk (gün bazlı çalışma saatlerine göre), en çok tercih edilen hizmetler, personel dağılımı.
5. Randevu taşıma (tarih/saat; çakışma kontrolü; eski hatırlatma yeniden kuyruğa alınır).
6. Müşteri notları (`customer_notes` tablosu, RLS).
7. Parola değiştirme (mevcut parola doğrulanır, diğer oturumlar kapanır).
- Testler 48/48. Derleme başarılı. Tarayıcıda bölümlerin göründüğü doğrulandı.
- Not: ekip üyeleri aynı yetkilere sahip; rol bazlı kısıtlama (personel yalnızca kendi randevularını görsün gibi) henüz yok. Davet e-postası yerelde dev-mail olarak sunucu günlüğüne düşer.

## Rol bazlı yetkiler (2026-11-03)

- Roller: owner (sahip) ve staff (üye). Matris: `src/lib/permissions.ts`.
- Sahip: her işlem (hizmet, personel, profil, ekip, denetim, randevu, müşteri).
- Üye: randevu oluşturma, durum, taşıma, iptal, hatırlatma ve müşteri notları; hizmet/personel/profil/ekip/denetim yok.
- Her yazma API ucunda `assertCan` çağrılır. Okuma uçları üyelik ister.
- Doğrulama: testler 50/50; canlı API'de üye hizmet ekleyemez (403), profil değiştiremez (403), denetim göremez (403), randevu oluşturabilir (201).
- Henüz yok: üyenin yalnızca kendi randevularını görmesi (personel-bağlı kapsam). Bunun için kullanıcı ile personel kaydını eşleştirmek gerekir.
- Geliştirme test üyesi: uye-test@example.test (t-be659bce, staff).

## Kişisel kapsam (2026-11-03)

- Personel kaydı (`staff.user_id`) bir ekip hesabına bağlanır. Sahip, ayarlarda "Personel hesapları" bölümünden bağlar (`PATCH /api/tenants/[id]/staff/[sid]` ile `userId`; üye olmayan ya da başka personele bağlı hesap reddedilir).
- Kapsam: `src/lib/scope.ts`. Sahip: hepsi. Bağlı üye: yalnızca kendi personel kaydına atanmış randevular; randevu oluşturma kendi kaydına zorlanır; müşteri listesi, geçmiş, not ve hatırlatmalar da kapsamlı. Bağlı değilse hiçbir şey görmez.
- İstatistik sayfası yalnızca sahibe açık; üyelerde sekme gizlenir.
- Testler 52/52. Canlı API ile doğrulandı: üye başkasının randevusunu göremez (0) ve değiştiremez (404); kendi adına oluşturduğu randevu kendi personeline atanır.
- Dev veri: t-be659bce'de ikinci personel "Derya Öz" ve 2030-07-01 tarihli test randevuları var.

## Hizmet ve personel ayrımı, kart tasarımı (2026-11-03)

- Sekmeler: Randevular, Müşteriler, Hizmetler, Personel, İstatistikler, Ayarlar.
- `/panel/[id]/hizmetler`: hizmet kartları (süre, fiyat), düzenleme, ekleme, silme.
- `/panel/[id]/personel`: personel kartları (avatar, unvan, aktif/pasif anahtarı, hesap bağlantısı, düzenleme, silme).
- `/panel/[id]/ayarlar`: yalnızca profil ve yayın, çalışma saatleri, ekip, hesap, müşteri önizlemesi.
- Pasif personel (`staff.active`) randevu atamasında dikkate alınmaz (test var, 53/53).
- Güncelleme kısmi: yalnızca gönderilen alanlar değişir.

## Müşterilerim yeniden tasarım (2026-11-03)

- Liste: özet kartları (toplam müşteri, randevusu olan müşteriler), arama (isim/telefon), müşteri kartları (baş harf veya fotoğraf, toplam/son/sonraki randevu, detay ve WhatsApp), "+ Müşteri ekle".
- Detay penceresi: sol taraf profil (fotoğraf, ad, e-posta, doğum tarihi, cinsiyet, WhatsApp, düzenleme) ve not; sağ taraf randevu geçmişi (durum rozetleri, personel) ve "+ Yeni randevu" (randevular ekranına gider; müşteri bilgisi otomatik doldurulmaz).
- Veri: `customer_profiles` tablosu (ad, e-posta, doğum tarihi, cinsiyet, fotoğraf). Fotoğraf 256 px JPEG data URL olarak DB'de tutulur (yerel için; yayında dosya depolama önerilir).
- Kapsam: üye yalnızca kendi randevularında geçen müşterileri görür ve düzenler; sahip ayrıca randevusuz kayıtlı müşterileri görür.
- Testler 53/53. Tarayıcıda liste ve detay penceresi doğrulandı.

## Müşteri silme, birleştirme, randevu ön doldurma (2026-11-03)

- Profili sil (yalnızca sahip): profil bilgileri ve not silinir; randevu geçmişi korunur. Denetim kaydı yazılır.
- Birleştir (yalnızca sahip): kaynak müşterinin randevuları, hatırlatmaları ve profil/not bilgileri hedef telefona taşınır; kaynak kaydı kalkar. Denetim kaydı yazılır. Yetki: `manage_customer_records`.
- "Yeni randevu": müşteri adı ve telefonu randevu formuna önceden yazılır (`?ad=&tel=`).
- Testler 54/54. Tarayıcıda düğmeler ve ön doldurma doğrulandı.

## Kasa (2026-11-03)

- `/panel/[id]/kasa` (yalnızca sahip; `view_ledger` yetkisi). Sekmeler: Tümü, Gelirler, Giderler, Personel. Dönem (bugün/bu hafta/bu ay/tüm zamanlar), kategori, arama, özet kartları (toplam gelir/gider, kâr marjı, net), işlem listesi, manuel gelir/gider ekleme.
- Tamamlanan randevu (fiyatı > 0) gelir olarak otomatik yazılır; randevu başına bir kez (`ledger_income_per_appointment`). Fiş no `SS-0001` biçiminde, kiracı başına sıralı.
- Kayıtlar değiştirilemez ve silinemez; düzeltme için ters kayıt girilir (arayüzde ayrı "düzeltme" işlemi henüz yok).
- Testler 56/56. Canlı akış doğrulandı (randevu tamamlandı → 400 TL gelir, SS-0001).
- Dev veri: t-be659bce'de "Fizyoterapi seansı" fiyatı 200 → 400 TL olarak değiştirildi.

## Kasa: yeni gelir/gider penceresi (2026-11-03)

- Gelir/gider seçimi; kalemler: "Hizmet" (hizmet listesinden, fiyat önerilir) ve "+ Diğer" (serbest ad ve tutar). Ürün kataloğu henüz yok.
- Müşteri arama (isteğe bağlı, telefon kaydedilir), ödeme yöntemi (nakit/kart/havale), tarih (geçmiş tarih dahil, gelecek yok), personel (isteğe bağlı), toplam.
- Çok kalemli kayıt tek fiş numarası altında yazılır. `ledger_entries.customer_phone` eklendi (ALTER ile geliştirme veritabanına da uygulandı).
- Testler 57/57. Pencere tarayıcıda açılıp doğrulandı.
- Eksik: ürün kalemleri (ürün kataloğu gerekir), kalem düzenleme, kayıt düzeltme (ters kayıt arayüzü).


- Yayın: ücretlendirme ve abonelik modeli (`PLANS` şu an kullanılmıyor; eski fiyatlandırma sayfası silindi).
- Otomatik gönderim için WhatsApp Business sağlayıcısı (ileride, maliyetli ve onay gerektirir).

## Herkese açık işletme sayfası (2026-11-03)

- Sayfa: /randevu/[sektor]/[tenantId]. Kapak ve logo üstte; ad, sektör, şehir, puan; "İşletme hakkında"; hizmetler (süre, fiyat); fotoğraf galerisi; konum ("Yol tarifi al" Google Maps arama bağlantısı); yorumlar ve yorum formu; sağda (masaüstü ≥980px, yapışkan) randevu kartı: açık/kapalı durumu, bugünkü saatler, telefon ve BookingForm.
- Sayfa yalnızca tenant_profiles.published ve sektör eşleşirse açılır; aksi halde 404.
- Yorumlar reviews tablosuna pending olarak düşer; işletme isletme-profili ekranında "Yayınla" ile gösterir. Puan ve listede yalnızca shown yorumlar sayılır. reviews_status_check 'pending' değerini içerir (dev veritabanına uygulandı).
- API: POST /api/public/tenants/[tenantId]/reviews (IP hız sınırı, aynı origin kontrolü).
- Testler 62/62. Masaüstü ve mobil (390px, yatay kaydırma yok) tarayıcıda doğrulandı; yorum gönderimi çalıştı.
- Mobilde randevu kartı yorumlardan sonra gelir (masaüstünde sağda).
- Eksik: harita sağlayıcısı (şu an arama bağlantısı), video bölümü, kapak/galeri dosya depolaması (veri URL'si olarak DB'de).

## Müşteri sayfası düzeni v2 (2026-11-03)

- Yorumlar sayfanın en altına, tam genişlikte taşındı: solda puan ortalaması ve yıldız dağılımı (5→1), sağda yorum listesi ve yorum formu.
- Konum bir kart oldu (şehir, adres, "Yol tarifi al").
- İşletme profilinde "Müşteri sayfasında göster" anahtarları: hizmet listesi ve fiyatlar (tenant_profiles.show_services / show_prices, varsayılan açık). Fiyat anahtarı hizmetler kapalıyken pasif. Randevu formu hizmetleri her zaman kullanır; anahtarlar yalnızca halka açık listeyi etkiler.
- Testler 63/63.
- Sağdaki panel için kullanıcının gönderdiği örnek görsel bu oturumda alınamadı; bekleniyor.

## Panel hesap menüsü (2026-11-03)

- Panelin sağ üstünde hesap düğmesi (e-posta baş harfi): hesap e-postası, İşletme profili (yalnızca sahip), İşletme ayarları, Şifre değiştir (ayarlar#sifre), Çıkış yap.
- Masaüstünde üst çubuk görünür hale geldi; logo yalnızca mobilde (`.pn-m-only`).
- "İşletme Profili Oluştur" (firmago'daki gibi ikinci işletme) eklenmedi; çoklu işletme akışı onaylanınca eklenecek.
- Geliştirme veritabanında test hesabı: menu-test@example.local (t-demo-randevu sahibi). Gerekirse silinmeli.

## Bildirimler, tema, ön sayfa hesap alanı (2026-11-03)

- Panel üst çubuğunda bildirim zili (src/components/notification-bell.tsx) ve hesap menüsü. Zil, GET /api/tenants/[tenantId]/notifications çıktısını açılır kart listesi olarak gösterir: yeni randevular (24 saat), bugünkü randevular, bekleyen hatırlatmalar ve sahip için onay bekleyen yorumlar. Personel yalnızca kendi randevularını sayar (src/lib/notifications.ts).
- Ön sayfa (RandevuHeader): oturum yoksa "Kayıt ol" ve "Giriş yap"; oturum varsa hesap menüsü ve "Panelime git" bağlantısı.
- Tema: ayarlar sayfasının başında Açık / Karanlık / Sistem seçimi (ThemeChooser). Tercih yalnızca tarayıcıda (localStorage "fiarbu-theme") tutulur; layout betiği sayfa boyanmadan uygular. Karanlık için color-scheme: dark eklendi.
- Testler 64/64.

## İşletme profili: görünüm düzenleme ve önizleme (2026-11-03)

- Logo ve kapak için boyut (yakınlaştırma %100–300) ve konum (yatay/dikey odak) ayarı: tenant_profiles.logo_fit / cover_fit (jsonb). Model ve CSS yardımcısı src/lib/image-fit.ts (fitStyle). Yeni görsel yüklenince kırpma sıfırlanır.
- Düzenleyici: isletme-profili/ImageFitEditor.tsx; "Görünümü kaydet" ile yayınlanır.
- "Müşteri sayfası önizlemesi" ayarlardan işletme profili sayfasının altına taşındı (modules.preview ile gizlenebilir).
- "İşlem kaynakları" ifadesi için kodda karşılık bulunamadı; kullanıcıya soruldu.
- Testler 65/65.

## Görsel kartı: Düzenle / Ekle / Sil (2026-11-03)

- Logo ve kapak kartlarında Düzenle (sürükleyerek kaydırma + boyut kaydırıcısı; Kaydet / İptal / Sıfırla), Ekle (yeni görsel, kırpma sıfırlanır), Sil (onay ile).
- Bileşen: isletme-profili/ImageCard.tsx. Eski ImageFitEditor kaldırıldı.

## Sektöre özel modüller ve fotoğraf teslimi (2026-11-04)

- Beş sektör korunur. Modüller sektöre bağlıdır: module-catalog.ts her modülün `sectors` alanını taşır; modulesForSector ve moduleAppliesTo ile filtrelenir. Modül açmak sektörde olmayan bir modül için 422 döner. Sektör değişince eski modül kayıtları silinmez.
- Panel menüsünde "Sektör araçları" grubu: yalnızca sektöre uygun ve açık modüller. Fotoğrafçıda "Fotoğraf teslimi".
- Teslim modülü: delivery_sessions ve delivery_photos (RLS + organiza_app GRANT). İş kuralları src/lib/delivery.ts: link tokenı (24 bayt), süre (varsayılan 30 gün), seçim limiti (varsayılan 10, en fazla 200), tek seferlik seçim, oturum kapatma, modül kapalıysa 404.
- Panel: /panel/[tenantId]/teslim. Müşteri: /teslim/[tenantId]/[token] (hesapsız). Önizleme boyutu 1400px JPEG, veritabanında veri URL'si (yerel geliştirme; dosya depolama hosting aşamasında).
- Testler 67/67. Mobil müşteri akışı ve panel tarafı tarayıcıda denendi (seçim gönderimi çalıştı).
- Fotoğrafçı test işletmesi (Siyah Stüdyo, t-a0bd1d68) için menu-test hesabına sahip üyeliği eklendi.

## Düğün salonu sektörü (2026-11-04)

- Altıncı sektör: dugun-salonu (sectors.ts, tenants_sector_check her uygulamada yeniden kurulur, kayıt formu seçeneği eklendi).
- Modüller: venue_calendar ("Seanslı takvim") ve venue_inquiries ("Teklif talepleri"); yalnızca düğün salonunda görünür.
- Seans modeli: venue_sessions; gün + seans (gunduz/gece) için tek aktif kayıt (kısmi benzersiz indeks, çakışma 409 slot_taken). Fiyat ve kapora elle girilir; kapora kasa defterine otomatik yazılmaz (karar bekliyor).
- Teklif: venue_inquiries; müşteri /randevu/dugun-salonu/[tenantId] sayfasından oturumsuz gönderir (yalnızca yayındaki işletme, hız sınırlı). Durum: yeni / teklif verildi / kapandı.
- Yayındaki düğün salonu sayfasında slot tabanlı randevu yerine teklif formu gösterilir.
- Takvim şu an yalnızca aylık görünüm. Çoklu salon, ortak takvim, tedarikçi, olanak listesi, paylaşım linkleri ve kapora kasa entegrasyonu sonraki adımlar.
- Testler 69/69. Takvim ve teklif akışı tarayıcıda uçtan uca denendi.
- Test işletmesi: t-dugun-test (Kristal Balo Salonu).

## Düğün salonu: kapora kasa entegrasyonu ve olanaklar (2026-11-04)

- Seans kaporası (deposit_tl > 0) kasa defterinde "Kapora" kategorisinde gelir olarak yazılır; seans başına tek kayıt (ledger_entries.venue_session_id, benzersiz indeks). Kapora değişince kayıt güncellenir; sıfır olursa silinir.
- Seans iptal edilince kapora kaydı defterde kalır (finansal kayıt silinmez). İade gerekiyorsa gider olarak elle girilir.
- Olanaklar: tenant_profiles.amenities (en fazla 20 etiket, 40 karakter). İşletme profili formunda virgülle girilir, müşteri sayfasında etiket olarak görünür.
- Testler 70/70.
- Henüz yok: çoklu salon, haftalık/günlük görünüm, ortak takvim, tedarikçiler, paylaşım linkleri.

## Düğün salonu: çoklu salon, görünümler, ortak takvim, tedarikçi, paylaşım (2026-11-04)

- Salonlar: venue_halls. İlk salon yoksa "Ana salon" otomatik oluşur ve salonsuz eski seanslar ona bağlanır. Seans kaydında hallId; aynı gün/seans farklı salonlarda serbest, aynı salonda çakışma 409.
- Takvim: Ay / Hafta / Gün görünümü, salon seçici, salon ekleme. Ortak takvim: tüm salonların salt okunur tablosu (tanım: ekip ve salon genel bakışı).
- Tedarikçiler: venue_suppliers (müzik, fotoğraf, çiçek, yemek, süsleme, diğer), modül venue_suppliers. Panel: /tedarikci.
- Paylaşım linkleri: venue_share_links; link yalnızca dolu/boş müsaitliği gösterir (kişi, telefon, fiyat yok). Panel: /paylasim; müşteri: /musaitlik/[tenantId]/[token]. İptal ve süre desteği var.
- Testler 71/71. Paylaşım sayfası ve salon/tedarikçi API'leri tarayıcıda doğrulandı.

## Organizasyon firması modülleri (2026-11-04)

- Yedinci sektör: organizasyon (sectors.ts, schema kısıtı, kayıt formu). Modüller: org_events (Etkinlik projeleri), org_tasks (Görev listesi), org_budget (Etkinlik bütçesi; yalnızca sahip).
- Tablolar: org_events, org_event_staff (yalnızca işletme personeli atanabilir), org_tasks, org_costs. RLS ve organiza_app izinleri eklendi.
- Teklif talepleri (venue_inquiries) organizasyonda da açık; müşteri sayfasında düğün salonu gibi teklif formu görünür.
- Sabitler istemci için src/lib/org-catalog.ts (veritabanı içermez); org.ts içinde yeniden dışa aktarılır.
- Bütçe giderleri kasa defterine otomatik yazılmaz (karar bekliyor).
- Testler 73/73. Etkinlik listesi, detay, ekip, görev ve gider akışı tarayıcıda ve API ile doğrulandı. Test işletmesi: t-org-test (Lale Organizasyon).

## Ürün sektörleri: düğün odaklı dört sektör (2026-11-04)

- Aktif sektörler: dugun-salonu (Düğün salonu), fotografci (Fotoğrafçı), organizasyon (Organizasyon), sac-makyaj (Saç ve makyaj).
- Kaldırılan ürün sektörleri: guzellik-salonu, kuafor, danisman, fizyoterapist. Veritabanı kısıtı bunları hâlâ kabul ediyor (mevcut kayıtlar silinmesin diye); geliştirme veritabanında bu sektörlerde 4 işletme var. Silinip silinmeyeceği kullanıcı kararı.
- Saç ve makyaj modülü: bridal_files ("Gelin dosyaları"): düğün tarihi, deneme tarihi, paket, durum (planlandı → deneme yapıldı → gelin günü → tamamlandı / iptal). Sayfa: /gelin. Standart randevu motoru (slot, personel) aynen çalışır.
- Testler 74/74. Test işletmesi: t-sac-test (Işıl Gelin Stüdyo).

## Sektör listesi kartları (2026-11-04)

- /randevu/[sektor]: firma kartları (kapak, logo, konum, hizmet etiketleri, en düşük fiyat), "Hizmetler" (firma sayfasının hizmetler bölümüne) ve "Firmayı İncele" düğmeleri.
- Veri: listSectorCards (booking-public.ts), logo/kapak/hizmetler kiracı bağlamında okunur.
- Hareket sınıfları (fb-*) artık design.css içinde; ana sayfa ve kartlar bunu kullanır.

## Ortak firma kartı ve genel sayfa dili (2026-11-04)

- Firma kartı: src/components/firm-card.tsx (ana sayfa "Yeni firmalar" / "Öne çıkan" ve sektör listesi aynı kartı kullanır). Veri: toSectorCards (booking-public.ts).
- Genel sayfalar açık zemin (src/components/light-page.ts): ana sayfa, sektör listesi, firma sayfası, giriş/kayıt, yasal sayfalar. Panel kapsam dışı.
- Sektör görselleri: src/lib/sector-photos.ts (ana sayfa ve sektör kapağı aynı kaynak).
- Kapı kontrolü: ana sayfa 0 FAIL. Sektör listesinde kalan uyarılar: içerik kaynaklı görsel sayısı (iki test firması), video yok, ölçüm farkı (sağ/sol 20/58px telefonda görsel olarak eşit).

## Weliste marka kimliği (2026-11-04)

- Marka adı FIARBU → Weliste (kod, metinler, manifest). "Firma Ara Bul" tagline'ı duruyor.
- Sembol: src/components/brand-mark.tsx (kılavuzdaki W; resmi SVG gelene kadar yeniden çizim, currentColor). public/icon.svg güncel.
- Renkler: design.css sonunda token blokları (açık / koyu / sistem). Petrol #134455 birincil, tebeşir #E9E8E3 zemin, kömür #252829 mürekkep, pirinç #8A6428 yalnız grafik vurgu. Hard-coded renkler tokenlara çevrildi.
- Yazı: Fraunces (pazarlama başlığı, inline), Inter Tight (arayüz). public/fonts içinde latin ve latin-ext woff2 dosyaları.
- Uygulanmayanlar: kartvizit, e-posta imzası, sözleşme/fatura şablonu, sosyal avatar.

## Açık kararlar (2026-11-04)

- Geliştirme veritabanındaki eski sektörlü dört işletme (guzellik-salonu: 2, kuafor: 1, fizyoterapist: 1): silinsin mi, yoksa düğün sektörlerinden birine mi taşınsın? Silme geri alınamaz; onay bekleniyor.
- Git ve GitHub: proje git deposu değil. Xcode lisansı kabul edilmediği için `git` komutları çalışmıyor (`sudo xcodebuild -license` gerekli). Uzak depo adresi ve kimlik bilgisi de yok; `gh` yüklü değil. Push için depo adresi ve yetki gerekli.
- Öne çıkan firmalar: `booking_listings.featured` yalnızca veritabanından işaretleniyor; yönetim ekranı ve ücretlendirme kuralı yok.
- Kapora iadesi: iptalde kapora kasada kalır; iade gider olarak elle girilir. Otomatik iade kuralı yok.
- Fotoğraf depolama: teslim ve galeri görselleri veritabanında veri URL'si olarak tutuluyor; hosting kararıyla birlikte dosya depolamaya taşınacak.
- Yönetici ilk atama: `users.is_admin` yalnızca veritabanından atanabilir; kurulum ekranı yok.
- Tenant planı ve ödeme: firma paketini değiştiren ekran ve faturalama yok.
- Marka: kılavuzdaki sembol resmi SVG yerine yeniden çizildi; resmi dosya bekleniyor. "Firma Ara Bul" tagline'ı kılavuzda yok; kaldırılıp kaldırılmayacağı açık.
- Hosting, alan adı, veritabanı barındırma: onay bekleniyor; yayın yapılmadı.
- Test hesapları (yalnız geliştirme): `menu-test@example.local` ve `admin-test@example.local` yönetici. Parolalar kaydedilmez; bu hesaplar yayına alınmadan silinmeli.

## Yedek ve geri yükleme (2026-11-04)

- Geri yükleme betiği: `scripts/restore-db.ts`. Yedek dökümü `veritabani/*.jsonl` + `_manifest.json`. Boş veritabanına yükleme ve satır sayısı doğrulaması test edildi (37 tablo, 440 satır, içerik farkı yok).
- Yedek konumu: masaüstünde `weliste-yedek-20261104-0555` klasörü ve `weliste-tam-yedek-20261104-0555.zip` (betikten önce alındı; betik yedek dosyasında yoktu).

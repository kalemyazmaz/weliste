# Weliste — düğün ve etkinlik randevu, teklif ve yönetim platformu

Next.js 15 + TypeScript + PostgreSQL. Düğün salonu, fotoğrafçı, organizasyon ve saç-makyaj işletmeleri için randevu, teklif ve yönetim. Çok kiracılı (multi-tenant) yapı; kiracı izolasyonu PostgreSQL satır düzeyinde güvenlik (RLS) ile sağlanır.

## Geliştirme

```bash
npm install
npm test          # entegrasyon testleri (PGlite, gerçek Postgres motoru, kısıtlı uygulama rolü)
npm run typecheck
npm run build
```

## Yerel çalıştırma

Yerel PostgreSQL gerekir (sunucu sürümü 14+). Veritabanı ve uygulama rolünü oluşturun, şemayı uygulayın, tohum verisi ekleyin:

```bash
createdb organiza
psql -d organiza -c "CREATE ROLE organiza_app NOLOGIN;"
export DATABASE_URL=postgres://localhost:5432/organiza
export DATABASE_APP_ROLE=organiza_app
SEED_OWNER_EMAIL=gelistirme@example.test SEED_OWNER_PASSWORD='en-az-10-karakter' npm run db:seed
npm run build && npx next start -p 3100
```

Tohum işletmesi `t-demo-randevu` eski (ürün listesinden çıkarılan) bir sektörde kayıtlıdır; sektör kararı bekleniyor. Yönetim paneli: http://localhost:3100/admin (yönetici hesabı gerekir).

## Kurulum (üretim)

Rolleri `scripts/roles.sql` ile oluşturun (parolalar komut satırından verilir, dosyaya yazılmaz), sonra şemayı sahip rolüyle uygulayın:

```bash
psql -v owner_pw="$OWNER_PW" -v conn_pw="$CONN_PW" -d postgres -f scripts/roles.sql
DATABASE_URL="postgres://organiza_owner:$OWNER_PW@HOST:5432/organiza" npm run db:seed   # yalnızca geliştirme tohumu
```

Yalnızca `organiza_owner` şemayı değiştirebilir; uygulama `organiza_conn` ile bağlanır.

```bash
export DATABASE_URL=postgres://KULLANICI:SIFRE@HOST:5432/VERITABANI
export DATABASE_APP_ROLE=organiza_app   # tablo sahibi OLMAYAN kısıtlı rol (zorunlu)
export TRUST_PROXY=1                    # yalnızca bir proxy arkasındaysanız (IP tabanlı hız sınırı için)
export NODE_ENV=production
npm run build && npm start
```

Şema `src/db/schema.sql` ile idempotent uygulanır. Uygulama rolü şunları almalıdır:

```sql
CREATE ROLE organiza_app NOLOGIN;
GRANT USAGE ON SCHEMA public TO organiza_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO organiza_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO organiza_app;
-- Yeni tablolar eklendiğinde bu GRANT'ları yeniden çalıştırın.
-- audit_events için tetikleyici güncelleme/silmeyi zaten engeller.
```

Geliştirme tohumu için `SEED_OWNER_EMAIL` ve `SEED_OWNER_PASSWORD` ortam değişkenleri gerekir; parola depoda tutulmaz.

## Sayfalar

| Yol | Açıklama |
|---|---|
| `/randevu` | Sektör seçimi |
| `/randevu/[sektor]` | Sektördeki yayındaki işletmeler |
| `/randevu/[sektor]/[tenantId]` | İşletme randevu sayfası: hizmet, personel, tarih, saat, ad, telefon |
| `/kayit`, `/giris` | Kayıt (sektör seçimi zorunlu) ve giriş |
| `/panel/[tenantId]/randevular` | Günlük randevu programı, iptal, manuel randevu |
| `/panel/[tenantId]/ayarlar` | Hizmetler, personel ve profil/yayın |

## API

| Alan | Yöntem | Yol | Açıklama |
|---|---|---|---|
| Kimlik | POST | `/api/auth/signup` | İşletme + sahip hesabı (sektör zorunlu); oturum açar |
| Kimlik | POST | `/api/auth/login` | Hız sınırlı; başarıda HttpOnly çerez |
| Kimlik | POST | `/api/auth/logout` | Oturumu iptal eder |
| Kimlik | POST | `/api/auth/password-reset/request` | Her zaman 202; var olan e-postaya bağlantı kuyruğa girer |
| Kimlik | POST | `/api/auth/password-reset/confirm` | Tek kullanımlık jeton; tüm oturumları iptal eder |
| Hizmet | GET/POST | `/api/tenants/:t/services` | Liste / ekleme |
| Hizmet | DELETE | `/api/tenants/:t/services/:id` | Silme |
| Personel | GET/POST | `/api/tenants/:t/staff` | Liste / ekleme |
| Personel | DELETE | `/api/tenants/:t/staff/:id` | Silme |
| Profil | PUT | `/api/tenants/:t/profile` | Tanıtım, iletişim, yayın |
| Randevu | GET/POST | `/api/tenants/:t/appointments` | Gün listesi (`?date=`) / işletme tarafından ekleme |
| Randevu | DELETE | `/api/tenants/:t/appointments/:id` | İptal (silme yok; slot yeniden boşalır) |
| Denetim | GET | `/api/tenants/:t/audit` | Yalnızca sahibin görebildiği, değiştirilemez kayıt |
| Herkese açık | GET | `/api/public/tenants/:t/slots?serviceId&date[&staffId]` | Boş saatler (yalnızca yayındaki işletme) |
| Herkese açık | POST | `/api/public/tenants/:t/appointments` | Randevu alma (IP sınırlı, CSRF kontrollü) |

Her tenant uç noktası önce oturumu ve üyeliği doğrular (401/403), CSRF kontrolünü yapar (JSON zorunlu, Origin eşleşmeli), sonra kiracı bağlamında çalışır.

## İş kuralları

- Randevu çalışma saatleri 09:00–20:00, adım 30 dakika, saat dilimi +03:00.
- Çakışma kontrolü kiracı bazlı kilitle yapılır; personel seçilmezse boş olan ilk personel atanır, ekip yoksa tek kapasiteli kaynak kullanılır.
- Randevu iptali kaydı silmez; durumu `iptal` olur.
- Denetim kaydı müşteri adı ve telefonu içermez.

## Veritabanı yedeği ve geri yükleme

Yedekten geri yükleme: `DATABASE_URL=postgres://postgres@localhost:5432/hedef npx tsx scripts/restore-db.ts <yedek>/veritabani` (süper kullanıcı ile, `DATABASE_APP_ROLE` tanımlamadan). Betik şemayı kurar, tabloları boşaltır ve satır sayılarını doğrular.

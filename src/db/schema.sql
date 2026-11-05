-- Randevu ürünü veritabanı şeması (yeniden çalıştırılabilir).
--
-- Kiracıya ait tablolar (services, staff, tenant_profiles, appointments, audit_events)
-- satır düzeyinde güvenlik (RLS) ile korunur: bir sorgu yalnızca `app.tenant_id` oturum
-- değişkeninin gösterdiği kiracının satırlarını görebilir ve yazabilir.
-- Değişken ayarlanmamışsa hiçbir satır dönmez (fail-closed).
--
-- Üretimde uygulama, tablo sahibi OLMAYAN bir rolle bağlanmalıdır; sahip ve
-- süper kullanıcılar RLS'i atlayabilir. FORCE ile tablo sahibi de kapsanır.

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Randevu sektörü. Anahtarlar src/lib/sectors.ts ile aynı olmalıdır.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sector text;
-- Her uygulamada yeniden kurulur: yeni sektör eklendiğinde mevcut veritabanı da güncellenir.
DO $$ BEGIN
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_sector_check;
  ALTER TABLE tenants ADD CONSTRAINT tenants_sector_check
    CHECK (sector IS NULL OR sector IN ('guzellik-salonu', 'kuafor', 'danisman', 'fizyoterapist', 'fotografci', 'dugun-salonu', 'organizasyon', 'sac-makyaj', 'guzellik-salonu', 'kuafor', 'danisman', 'fizyoterapist'));
-- Not: eski dört sektör (güzellik, kuaför, danışman, fizyoterapist) ürün listesinden çıkarıldı; mevcut kayıtlar silinmeden kısıt geçerli kalır.
END $$;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'staff')),
  PRIMARY KEY (tenant_id, user_id)
);

-- Oturum tokeni düz metin saklanmaz; yalnızca SHA-256 özeti tutulur.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

-- Hizmetler (süre ve fiyat). Randevu alınırken müşteri buradan seçer.
CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  price_tl numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price_tl >= 0),
  duration_min integer NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Personel. Randevular personele atanır; atanmazsa boş olan ilk personel seçilir.
-- user_id: personel kaydının bağlı olduğu kullanıcı hesabı (kişisel kapsam için).
CREATE TABLE IF NOT EXISTS staff (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  role text NOT NULL DEFAULT '' CHECK (char_length(role) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS tenant_profiles (
  tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- İşletmenin çalışma saatleri (dakika cinsinden gün içi; 540 = 09:00, 1200 = 20:00).
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS opens_min integer NOT NULL DEFAULT 540;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS closes_min integer NOT NULL DEFAULT 1200;
-- Gün bazlı çalışma saatleri: 7 elemanlı dizi (0 = Pazar). Eleman null ise o gün kapalı. Boşsa opens/closes geçerlidir.
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS day_hours jsonb;
-- İsteğe bağlı özellikler (anahtar -> açık/kapalı). Boş ise tüm varsayılanlar geçerlidir.
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS modules jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_profiles_hours_check') THEN
    ALTER TABLE tenant_profiles ADD CONSTRAINT tenant_profiles_hours_check
      CHECK (opens_min >= 0 AND closes_min <= 1440 AND closes_min > opens_min);
  END IF;
END $$;

-- Randevular. Hizmet ve personel adı/süresi kayıtta kopyalanır; hizmet veya personel
-- silinse de geçmiş randevu korunur.
CREATE TABLE IF NOT EXISTS appointments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id text REFERENCES services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  staff_id text REFERENCES staff(id) ON DELETE SET NULL,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  customer_phone text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'onaylandi' CHECK (status IN ('onaylandi', 'iptal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS appointments_tenant_time ON appointments (tenant_id, starts_at);
-- Durumlar: onaylandi (aktif), tamamlandi, gelmedi, iptal. Eski veritabanlarında kısıt yeniden kurulur.
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('onaylandi', 'tamamlandi', 'gelmedi', 'iptal'));

-- Sektör sayfaları için ortak liste (kiracıya bağlı değil; profil kaydında senkronize edilir).
CREATE TABLE IF NOT EXISTS booking_listings (
  tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  sector text NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  description text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_listings_sector ON booking_listings (sector, published);

-- Müşteri notları (işletmenin kendi notları; kiracı bazlı, müşteri anahtarı telefon).
CREATE TABLE IF NOT EXISTS customer_notes (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, customer_phone)
);
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_notes;
CREATE POLICY tenant_isolation ON customer_notes
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Müşteri profilleri: ad, e-posta, doğum tarihi, cinsiyet ve profil fotoğrafı (küçük bir data URL).
CREATE TABLE IF NOT EXISTS customer_profiles (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 120),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 254),
  birth_date date,
  gender text NOT NULL DEFAULT '' CHECK (gender IN ('', 'kadin', 'erkek', 'belirtilmemis')),
  photo text CHECK (photo IS NULL OR char_length(photo) <= 200000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, customer_phone)
);
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_profiles;
CREATE POLICY tenant_isolation ON customer_profiles
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Ürünler (kasada gelir kalemi olarak satılabilir).
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  price_tl numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price_tl >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON products;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Kasa: gelir ve gider kayıtları (yalnızca sahip görür). Randevu tamamlandığında hizmet bedeli gelir olarak yazılır.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gelir', 'gider')),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  amount_tl numeric(12, 2) NOT NULL CHECK (amount_tl > 0),
  method text NOT NULL DEFAULT 'nakit' CHECK (method IN ('nakit', 'kart', 'havale')),
  staff_id text REFERENCES staff(id) ON DELETE SET NULL,
  appointment_id text REFERENCES appointments(id) ON DELETE SET NULL,
  customer_phone text,
  receipt_no text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS customer_phone text;
-- Bir randevunun geliri yalnızca bir kez yazılır.
DROP INDEX IF EXISTS ledger_income_per_appointment;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_income_per_appointment ON ledger_entries (appointment_id) WHERE kind = 'gelir';
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ledger_entries;
CREATE POLICY tenant_isolation ON ledger_entries
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Personel maaş ve prim planları (kişi başına bir plan).
CREATE TABLE IF NOT EXISTS payroll_plans (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  monthly_salary_tl numeric(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_salary_tl >= 0),
  prim_percent numeric(5, 2) NOT NULL DEFAULT 0 CHECK (prim_percent >= 0 AND prim_percent <= 100),
  payment_day integer NOT NULL DEFAULT 1 CHECK (payment_day BETWEEN 1 AND 28),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, staff_id)
);
-- Her plan ve dönem için bir kez üretilen ödeme (tekrar üretimi engeller).
CREATE TABLE IF NOT EXISTS payroll_runs (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  kind text NOT NULL CHECK (kind IN ('maas', 'prim')),
  amount_tl numeric(12, 2) NOT NULL DEFAULT 0,
  ledger_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, staff_id, period, kind)
);
ALTER TABLE payroll_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payroll_plans;
CREATE POLICY tenant_isolation ON payroll_plans USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payroll_runs;
CREATE POLICY tenant_isolation ON payroll_runs USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- İşletme profili görselleri ve yorumları (kiracıya özel).
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS logo text;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cover text;
-- Herkese açık sayfada hizmet listesi ve fiyatların görünürlüğü (varsayılan: açık).
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS show_services boolean NOT NULL DEFAULT true;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS show_prices boolean NOT NULL DEFAULT true;
-- Logo ve kapak kırpma ayarı (yakınlaştırma ve odak noktası). Boşsa varsayılan.
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS logo_fit jsonb;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cover_fit jsonb;
CREATE TABLE IF NOT EXISTS profile_photos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reviews (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shown', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('pending', 'shown', 'hidden'));
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON profile_photos;
CREATE POLICY tenant_isolation ON profile_photos USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON reviews;
CREATE POLICY tenant_isolation ON reviews USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Hatırlatma kuyruğu. Sağlayıcı yoksa mesaj işletme tarafından wa.me bağlantısıyla gönderilir.
-- Her randevu için en fazla bir hatırlatma (appointment_id benzersiz).
CREATE TABLE IF NOT EXISTS reminder_messages (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id text NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  to_phone text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE reminder_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON reminder_messages;
CREATE POLICY tenant_isolation ON reminder_messages
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Giriş denemesi sayacı (anahtar: e-posta ve IP'nin özetleri; düz metin yok)
CREATE TABLE IF NOT EXISTS login_attempts (
  key text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

-- Parola sıfırlama jetonları: yalnızca özet saklanır, tek kullanımlık, kısa ömürlü
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

-- Gönderilmiş e-postalar (sistem düzeyi; kiracıya bağlı değil)
CREATE TABLE IF NOT EXISTS email_outbox (
  id text PRIMARY KEY,
  to_address text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kiracıya ait denetim kaydı: yalnızca eklenir, uygulama güncelleme/silme yapmaz
CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  actor_user_id text,
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kiracı izolasyonu (RLS)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services', 'staff', 'tenant_profiles', 'appointments', 'audit_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
END $$;

-- Denetim kaydı yalnızca eklenebilir. Tetikleyici, tablo sahibi ve süper kullanıcı dahil
-- her güncelleme ve silmeyi reddeder (REVOKE yalnızca uygulama rolünü kapsar).
CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;
DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

-- Supabase: varsayılan olarak anon ve authenticated API rolleri public tablolara
-- tam yetkiyle erişebilir. Bu uygulama kendi kimliğini kullanır; API rolleri hiçbir tabloyu görmemeli.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
  END IF;
END $$;

-- Kiracı dışı tablolar (kullanıcılar, oturumlar, üyelikler, ...): RLS açık; yalnızca
-- uygulama rolü (organiza_app) erişebilir. Rol yoksa politika oluşturulmaz (yerel kurulum).
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    FOREACH t IN ARRAY ARRAY['tenants', 'users', 'memberships', 'sessions', 'login_attempts', 'password_resets', 'email_outbox', 'booking_listings']
    LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS app_only ON %I', t);
      EXECUTE format('CREATE POLICY app_only ON %I TO organiza_app USING (true) WITH CHECK (true)', t);
    END LOOP;
  END IF;
END $$;

-- Uygulama rolüne yetkiler (rol varsa). Yeni tablo eklendiğinde bu blok yeniden çalıştırılır.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    GRANT USAGE ON SCHEMA public TO organiza_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO organiza_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO organiza_app;
  END IF;
END $$;

-- Fotoğraf teslim ve seçimi (fotoğrafçı modülü). Müşteri, işletmenin verdiği tokenli linkle hesapsız seçer.
CREATE TABLE IF NOT EXISTS delivery_sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  client_name text NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 120),
  token text NOT NULL UNIQUE,
  photo_limit integer NOT NULL DEFAULT 10 CHECK (photo_limit BETWEEN 1 AND 200),
  expires_at timestamptz NOT NULL,
  closed boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS delivery_photos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES delivery_sessions(id) ON DELETE CASCADE,
  data text NOT NULL CHECK (char_length(data) <= 600000),
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_photos_session ON delivery_photos (session_id, created_at);
ALTER TABLE delivery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON delivery_sessions;
CREATE POLICY tenant_isolation ON delivery_sessions USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
ALTER TABLE delivery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_photos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON delivery_photos;
CREATE POLICY tenant_isolation ON delivery_photos USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_sessions, delivery_photos TO organiza_app;
  END IF;
END $$;

-- Düğün salonu: gün ve seans bazlı rezervasyon (gündüz / gece). Bir gün ve seans için tek aktif kayıt.
CREATE TABLE IF NOT EXISTS venue_sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('gunduz', 'gece')),
  couple_name text NOT NULL CHECK (char_length(couple_name) BETWEEN 2 AND 120),
  phone text NOT NULL DEFAULT '',
  guest_count integer CHECK (guest_count IS NULL OR guest_count BETWEEN 1 AND 5000),
  price_tl numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_tl >= 0),
  deposit_tl numeric(12,2) NOT NULL DEFAULT 0 CHECK (deposit_tl >= 0),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'iptal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS venue_sessions_active_slot ON venue_sessions (tenant_id, session_date, slot) WHERE status = 'aktif';
CREATE TABLE IF NOT EXISTS venue_inquiries (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 30),
  event_date date,
  guest_count integer CHECK (guest_count IS NULL OR guest_count BETWEEN 1 AND 5000),
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'yeni' CHECK (status IN ('yeni', 'teklif_verildi', 'kapandi')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON venue_sessions;
CREATE POLICY tenant_isolation ON venue_sessions USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
ALTER TABLE venue_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_inquiries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON venue_inquiries;
CREATE POLICY tenant_isolation ON venue_inquiries USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON venue_sessions, venue_inquiries TO organiza_app;
  END IF;
END $$;

-- Düğün salonu kaporası: her seans için defterde en fazla bir kapora geliri.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS venue_session_id text REFERENCES venue_sessions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_deposit_per_session ON ledger_entries (venue_session_id) WHERE venue_session_id IS NOT NULL;
-- Olanaklar (işletme profili): kısa etiket listesi.
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Düğün salonu: birden fazla salon, tedarikçiler ve paylaşım linkleri.
CREATE TABLE IF NOT EXISTS venue_halls (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  capacity integer CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 5000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venue_sessions ADD COLUMN IF NOT EXISTS hall_id text REFERENCES venue_halls(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS venue_sessions_active_slot;
CREATE UNIQUE INDEX IF NOT EXISTS venue_sessions_active_slot ON venue_sessions (tenant_id, COALESCE(hall_id, ''), session_date, slot) WHERE status = 'aktif';
CREATE TABLE IF NOT EXISTS venue_suppliers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  category text NOT NULL DEFAULT 'diger' CHECK (category IN ('muzik', 'fotograf', 'cicek', 'yemek', 'susleme', 'diger')),
  phone text NOT NULL DEFAULT '',
  cost_tl numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_tl >= 0),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS venue_share_links (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 120),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN RETURN; END IF;
  GRANT SELECT, INSERT, UPDATE, DELETE ON venue_halls, venue_suppliers, venue_share_links TO organiza_app;
END $$;
ALTER TABLE venue_halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_halls FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON venue_halls;
CREATE POLICY tenant_isolation ON venue_halls USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
ALTER TABLE venue_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_suppliers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON venue_suppliers;
CREATE POLICY tenant_isolation ON venue_suppliers USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
ALTER TABLE venue_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_share_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON venue_share_links;
CREATE POLICY tenant_isolation ON venue_share_links USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Düğün salonu hizmetleri: kişi sayısı ve menü seçeneği (süre yerine). Diğer sektörlerde boş kalır.
ALTER TABLE services ADD COLUMN IF NOT EXISTS guest_count integer CHECK (guest_count IS NULL OR guest_count BETWEEN 1 AND 5000);
ALTER TABLE services ADD COLUMN IF NOT EXISTS menu text;
DO $$ BEGIN
  ALTER TABLE services DROP CONSTRAINT IF EXISTS services_menu_check;
  ALTER TABLE services ADD CONSTRAINT services_menu_check CHECK (menu IS NULL OR menu IN ('yemeksiz', 'etli', 'tavuklu', 'balikli', 'vejetaryen', 'karisik'));
END $$;

-- Organizasyon firması: etkinlik projeleri, ekip ataması, görevler ve bütçe giderleri.
CREATE TABLE IF NOT EXISTS org_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  client_name text NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 120),
  client_phone text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
  guest_count integer CHECK (guest_count IS NULL OR guest_count BETWEEN 1 AND 50000),
  budget_tl numeric(12,2) NOT NULL DEFAULT 0 CHECK (budget_tl >= 0),
  status text NOT NULL DEFAULT 'taslak' CHECK (status IN ('taslak', 'onaylandi', 'tamamlandi', 'iptal')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_events_date ON org_events (tenant_id, event_date);
CREATE TABLE IF NOT EXISTS org_event_staff (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, staff_id)
);
CREATE TABLE IF NOT EXISTS org_tasks (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  due_date date,
  done boolean NOT NULL DEFAULT false,
  assignee_id text REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS org_costs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  category text NOT NULL DEFAULT 'diger' CHECK (category IN ('tedarikci', 'ekipman', 'ulasim', 'yemek', 'diger')),
  amount_tl numeric(12,2) NOT NULL CHECK (amount_tl >= 0),
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['org_events', 'org_event_staff', 'org_tasks', 'org_costs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON org_events, org_event_staff, org_tasks, org_costs TO organiza_app;
  END IF;
END $$;

-- Saç ve makyaj: gelin dosyaları (düğün tarihi, deneme, paket ve durum).
CREATE TABLE IF NOT EXISTS bridal_files (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bride_name text NOT NULL CHECK (char_length(bride_name) BETWEEN 2 AND 120),
  phone text NOT NULL DEFAULT '',
  wedding_date date,
  trial_date date,
  package text NOT NULL DEFAULT '' CHECK (char_length(package) <= 120),
  status text NOT NULL DEFAULT 'planlandi' CHECK (status IN ('planlandi', 'deneme_yapildi', 'gelin_gunu', 'tamamlandi', 'iptal')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bridal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_files FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON bridal_files;
CREATE POLICY tenant_isolation ON bridal_files USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON bridal_files TO organiza_app;
  END IF;
END $$;

-- Ana sayfa: öne çıkan firmalar (operatör tarafından işaretlenir; sahip panelinden değiştirilemez).
ALTER TABLE booking_listings ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- Platform yönetimi: yönetici ve devre dışı kullanıcılar.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
-- Paketler: ad, fiyat, dahil modüller. Kiracının planı (tenants.plan) paket kimliğidir.
CREATE TABLE IF NOT EXISTS packages (
  id text PRIMARY KEY CHECK (id IN ('starter', 'pro', 'enterprise')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  price_tl numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_tl >= 0),
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);
-- Global modül açma/kapama (yalnız platform yöneticisi değiştirir). Kayıt yoksa açık kabul edilir.
CREATE TABLE IF NOT EXISTS module_flags (key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT true);
-- Site içeriği ve ayarları (anahtar -> değer). Anahtarlar: home, header, footer, theme.
CREATE TABLE IF NOT EXISTS site_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO packages (id, name, price_tl, modules, active, sort) VALUES
  ('starter', 'Başlangıç', 0, '["stats","ledger","products","payroll","notes","reminders","preview","venue_calendar","venue_inquiries","venue_suppliers","venue_share","org_events","org_tasks","org_budget","photo_delivery","bridal_files"]', true, 1),
  ('pro', 'Profesyonel', 0, '["stats","ledger","products","payroll","notes","reminders","preview","venue_calendar","venue_inquiries","venue_suppliers","venue_share","org_events","org_tasks","org_budget","photo_delivery","bridal_files"]', true, 2),
  ('enterprise', 'Kurumsal', 0, '["stats","ledger","products","payroll","notes","reminders","preview","venue_calendar","venue_inquiries","venue_suppliers","venue_share","org_events","org_tasks","org_budget","photo_delivery","bridal_files"]', true, 3)
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON packages, module_flags, site_settings TO organiza_app;
  END IF;
END $$;

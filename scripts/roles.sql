-- Üretim rol kurulumu. Parolaları bu dosyaya YAZMAYIN; psql değişkenleriyle verin:
--   psql -v owner_pw="..." -v conn_pw="..." -d postgres -f scripts/roles.sql
--
-- organiza_owner : şemayı uygular ve tabloların sahibidir (migrasyon için; uygulama kullanmaz)
-- organiza_app   : tablo sahibi değil; RLS'e tabi; her işlemde SET LOCAL ROLE ile geçilir
-- organiza_conn  : uygulamanın bağlandığı kullanıcı; yalnızca organiza_app rolüne geçebilir

CREATE ROLE organiza_owner LOGIN PASSWORD :'owner_pw';
CREATE ROLE organiza_app NOLOGIN;
CREATE ROLE organiza_conn LOGIN PASSWORD :'conn_pw';
GRANT organiza_app TO organiza_conn;
CREATE DATABASE organiza OWNER organiza_owner;
\c organiza
GRANT CONNECT ON DATABASE organiza TO organiza_app, organiza_conn;
-- Şema uygulandıktan sonra (npm run db:seed, owner olarak):
GRANT USAGE ON SCHEMA public TO organiza_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO organiza_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO organiza_app;

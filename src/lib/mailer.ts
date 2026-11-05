import { randomUUID } from "node:crypto";
import { Db } from "./db";

// E-posta kuyruğa yazılır (kalıcı). Gerçek gönderim, bir e-posta sağlayıcısı
// (SMTP ya da API) bağlandığında bu kuyruğu işleyen bir worker ile yapılır.
// Geliştirmede içerik konsola yazılır; üretimde jeton/bağlantı asla günlüğe yazılmaz.
export async function queueEmail(db: Db, to: string, subject: string, body: string): Promise<void> {
  await db.transaction((tx) =>
    tx.query("INSERT INTO email_outbox (id, to_address, subject, body) VALUES ($1, $2, $3, $4)", [
      randomUUID(),
      to,
      subject,
      body,
    ]),
  );
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev-mail] to=${to} subject=${subject}\n${body}`);
  }
}

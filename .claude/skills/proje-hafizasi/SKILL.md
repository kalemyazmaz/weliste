---
name: proje-hafizasi
description: Organiza projesinin kalıcı hafızasını (memory.md), bağlam haritasını (context/README.md) ve kaynak indeksini (context/kaynaklar/kaynak-indeksi.md) güncelleme ve denetleme. Kullanıcı "hafızayı güncelle", "bağlamı denetle" veya "kaynakları denetle" dediğinde kullan.
---

# Proje Hafızası

Bu beceri projenin kalıcı bağlamını doğru ve güncel tutar. Kapsamı üç dosyadır:

- `memory.md` (proje kökü): kesinleşmiş kararlar, kurallar, iş kuralları, açık kararlar.
- `context/README.md`: bağlam haritası. Her bağlam dosyasına buradan ulaşılabilmeli.
- `context/kaynaklar/kaynak-indeksi.md`: dayanak kaynaklarının listesi.

## Ne zaman kaydedilir

- Kullanıcı açıkça bir karar, kural, kapsam veya tercih belirttiyse kaydet.
- Bilgi geçici mi kalıcı mı belli değilse kaydetmeden önce kullanıcıya sor.
- Geçici konuşmaları, reddedilen seçenekleri, doğrulanmamış varsayımları ve sohbetin tamamını kaydetme.
- Parola, erişim anahtarı, kimlik bilgisi veya gereksiz kişisel veri kaydetme.

## Güncelleme adımları

1. `memory.md` dosyasını oku ve aynı konuya ait bir bölüm var mı kontrol et. Varsa o bölümü güncelle, yenisini ekleme.
2. Kodla doğrulanabilen bilgiler için (komut, dosya yolu, modül, kural) kaynağı kontrol et. Doğrulanamıyorsa "doğrulanmadı" olarak işaretle.
3. Açık kararlar bölümünde karar verilen maddeyi kesinleşmiş kurallara taşı ve tarihini yaz.
4. `Son güncelleme` tarihini bugünün tarihiyle değiştir.
5. Yeni bir bağlam dosyası eklendiyse `context/README.md` haritasını aynı işlemde güncelle.
6. Yeni bir kaynak eklendiyse `context/kaynaklar/kaynak-indeksi.md` dosyasına kayıt ekle. Ajan çıktılarını ham kaynak olarak kaydetme.

## Denetim adımları

- `context/README.md` içindeki her bağlam dosyasının var olduğunu kontrol et. Eksik veya kırık bağlantıyı düzelt.
- Haritada olmayan bir bağlam dosyası varsa amacına göre haritaya ekle; belirsizse kullanıcıya sor.
- `memory.md` ile `README.md`, `package.json` ve `src/db/schema.sql` arasında çelişki varsa sessizce seçim yapma; kullanıcıya bildir.
- Kaynak indeksindeki her kaydın dosyasının gerçekten var olduğunu kontrol et.
- Denetim sonucunu kısa bir liste olarak raporla: ne kontrol edildi, ne düzeltildi, neyin kullanıcı kararı beklediği.

## Kurallar

- Kaynakların orijinal içeriğini açıkça istenmedikçe değiştirme.
- Görev kapsamı dışındaki dosyaları değiştirme.
- Güncelleme sonrası dosyanın bir kez daha okunup biçiminin bozulmadığını kontrol et.

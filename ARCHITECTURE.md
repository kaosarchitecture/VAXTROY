# Vaxtroy mimarisi

İlk dilim tek salonlu bir adisyon çekirdeğidir. Tarayıcı HTTP ile API’ye gider. API iş kurallarını `packages/domain` üzerinden uygular ve satırları diskteki bir SQLite dosyasına yazar.

```
apps/web                         Türkçe, dokunmatik salon ve adisyon
   |  GET/POST /api
apps/api                         Hono + Zod
   |  Ticket / Table / Product / Money
packages/domain                  saf fonksiyonlar, G/Ç yok
   |
node:sqlite DatabaseSync         data/vaxtroy.sqlite

packages/ai                      STUB arayüz. API bunu çağırmaz.
```

## Neden dosya

`openDatabase` `:memory:` ve `mode=memory` yollarını reddeder. `DatabaseSync` verilen patikayı açar, `journal_mode=WAL` kullanır ve her yazma işleminden sonra `wal_checkpoint(TRUNCATE)` çalıştırır. Böylece süreç ölünce kayıt hem WAL hem ana dosyada kalır. `npm run happy-path` API sürecini SIGTERM ile kapatıp aynı dosyayı yeni bir süreçte okur.

Şema `schema_migrations` ile uygulanır. `venues` boşsa tohum atılır: 1 salon (`Vaxtroy`), 12 masa, 15 Türkçe menü ürünü. Açık adisyon, `tickets(table_id) WHERE status = 'open'` benzersiz indeksiyle masa başına tektir.

## Para

Tutarlar kuruş cinsinden tam sayıdır (`Money.kurus`). Satır toplamı ve adisyon toplamı yalnızca domain fonksiyonlarından gelir. API cevabındaki `totalKurus` ve `totalLabel` bu hesaptır. Yuvarlama için kayan nokta kullanılmaz.

Fiyat, satır eklenirken `ticket_lines.unit_price_kurus` alanına kopyalanır. Aynı ürün aynı adisyona tekrar eklenirse adet birleşir; birim fiyat ilk eklenen fiyatta kalır.

## HTTP

| Metod | Yol | İş |
| --- | --- | --- |
| GET | `/api/health` | Dosya veritabanı ayakta mı |
| GET | `/api/floor` | Salon ve masalar. Dolu/boş, açık adisyondan türetilir |
| GET | `/api/products` | Aktif menü |
| POST | `/api/tables/:tableId/tickets` | Adisyon aç |
| GET | `/api/tickets/:ticketId` | Adisyon ve toplam |
| POST | `/api/tickets/:ticketId/lines` | Ürün ekle (`productId`, `quantity`) |
| PATCH | `/api/tickets/:ticketId/lines/:lineId` | Adet. 0 satırı siler |
| POST | `/api/tickets/:ticketId/kitchen` | STUB mutfak kaydı |
| POST | `/api/tickets/:ticketId/close` | STUB kapanış. Gövde: `{ "paymentMethod": "nakit" \| "kart" }` |

Hata gövdesi `{ "error": "..." }` şeklindedir. İş kuralı 409, doğrulama 400, bulunamayan 404.

## STUB sınırları

- `packages/ai` içindeki `StubAiAssistant` model çağırmaz. Etiketi `STUB`.
- Mutfak uç noktası yalnızca `kitchen_sent_at` yazar ve `implementation: "STUB"` döner.
- Kapanış uç noktası ödeme yöntemini kaydeder, tahsilat yapmaz, `implementation: "STUB"` döner.

## Çalışma zamanı

`npm run dev` iki süreci kaldırır: API (`tsx watch`) ve Vite. Vite `/api` isteklerini `127.0.0.1:3001` adresine proxyler. Arayüz toplamı sunucunun yazdığı `totalLabel` ile gösterir; menü fiyatını da aynı kuruş değerinden domain `formatTry` ile basar.

Testler geçici bir dizinde gerçek `.sqlite` dosyası açar. Bellek içi sürücü yoktur.

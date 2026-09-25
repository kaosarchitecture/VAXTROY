# Vaxtroy

Restoran adisyon / POS çekirdeği. Masa açılır, ürün eklenir, toplam hesaplanır, adisyon kapanır. Kayıtlar süreç yeniden başlasa da duran bir SQLite dosyasındadır.

Kimlik doğrulama, yazar kasa, banka ve mutfak yazıcısı bu dilimde yok.

## Gereksinimler

- Node.js 22.14 veya daha yeni (`node:sqlite` içindeki `DatabaseSync`)
- npm 10

## Clone ve çalıştırma

```bash
git clone https://github.com/kaosarchitecture/VAXTROY.git
cd VAXTROY
npm install
npm test
npm run dev
```

- Arayüz: http://127.0.0.1:5173
- API: http://127.0.0.1:3001
- Veritabanı dosyası: `data/vaxtroy.sqlite` (çalışınca oluşur, git’e girmez)

Salon ekranında bir masaya dokunun. Adisyon açılır. Menüden ürün ekleyin. Toplam sunucudan gelir. **Mutfağa gönder** satırı kaydeder. **Hesabı kapat** nakit veya kart yöntemini kaydeder.

## Tek komutla canlı adisyon

API’yi elle açmadan, betik kendi sürecini başlatır, masayı açar, satır ekler, süreci öldürür, aynı dosyadan adisyonu okur, kapatır, bir kez daha yeniden başlatır:

```bash
npm run happy-path
```

Dosya: `data/vaxtroy-happy.sqlite`.

```bash
ls -la data/vaxtroy-happy.sqlite
```

## Ortam

Örnekler `.env.example` içindedir. Gizli anahtar yoktur.

| Değişken | Varsayılan | Anlamı |
| --- | --- | --- |
| `PORT` | `3001` | API portu |
| `VAXTROY_DB_PATH` | `data/vaxtroy.sqlite` | SQLite dosyası. Göreli yol depo köküne göre çözülür. `:memory:` reddedilir. |

## Test

```bash
npm test
npm run typecheck
```

Vitest, domain para hesabını ve API’yi gerçek bir sqlite dosyasında koşar. Bağlantı kapanıp aynı dosya açılınca adisyon duruyor mu, ona da bakar.

## STUB

`packages/ai` bir modele bağlanmaz. `StubAiAssistant.implementation` değeri `STUB` dur ve `suggestAdditions` çağrılırsa hata fırlatır. API bu paketi çağırmaz; sahte öneri üretmez.

Mutfağa gönderme ve hesap kapatma da cihaz entegrasyonu değildir. İkisi de `stub: true` döner:

- Mutfak: `kitchen_sent_at` yazılır. Yazıcı veya KDS yok.
- Ödeme: `payment_method` olarak `nakit` veya `kart` yazılır. Banka veya yazar kasa yok.

## Bilerek olmayanlar

- Kullanıcı girişi
- Çok şubeli yetki
- KDV kırılımı (fiyatlar KDV dahil kabul edilir, kuruş tam sayıdır)
- Gerçek tahsilat veya mutfak bileti basımı

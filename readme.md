# halodawg

**halodawg** adalah aplikasi web konsultasi dokter online yang menjaga isi percakapan tetap rahasia
dengan **enkripsi RSA yang ditulis sendiri dari nol**. Pasien dan dokter dapat berkonsultasi lewat chat,
sementara server hanya menyimpan data acak (ciphertext) yang tidak bisa dibaca tanpa kunci privat
milik pengguna. Proyek ini dibuat untuk tugas mata kuliah **Kriptografi**.

## Latar belakang

Konsultasi medis berisi data yang sangat sensitif: keluhan, riwayat penyakit, hingga resep.
Pada aplikasi chat biasa, isi pesan tersimpan sebagai teks biasa di server, sehingga jika database
bocor atau administrator berniat buruk, seluruh percakapan bisa dibaca.

halodawg memecahkan masalah itu dengan pendekatan *end-to-end encryption*: pesan dienkripsi di
browser pengirim dengan kunci publik penerima, dan hanya bisa didekripsi di browser penerima dengan
kunci privatnya. Server hanya berperan sebagai kurir dan penyimpan data terenkripsi.

Tugas ini juga mensyaratkan bahwa algoritma kripto tidak boleh memakai library eksternal, sehingga
semua komponen intinya (RSA, uji bilangan prima, padding, dan fungsi hash SHA-256) diimplementasikan
sendiri.

## Fitur

- **Registrasi dan login** untuk dua peran: pasien dan dokter
- **Pembuatan kunci RSA di browser** saat registrasi (kunci privat tidak pernah dikirim ke server)
- **Daftar dokter** beserta spesialisasi, dan pembuatan konsultasi
- **Chat terenkripsi RSA** antara pasien dan dokter
- **Tanda tangan digital** pada setiap pesan; penerima melihat status "✓ tanda tangan valid" atau
  "⚠ tanda tangan TIDAK valid"
- **Opsi menampilkan ciphertext** langsung di chat untuk melihat bentuk data yang tersimpan
- **Halaman demo RSA** (`/demo.html`) yang menampilkan p, q, n, φ(n), e, d, padding, enkripsi, dan
  dekripsi langkah demi langkah
- **Ekspor dan impor kunci privat** (file JSON) agar bisa login dari perangkat lain

## Cara kerja

### Gambaran umum

```
 Pasien (browser)                    Server                    Dokter (browser)
 ───────────────                  ───────────                  ────────────────
 kunci privat: ada di sini        hanya menyimpan:             kunci privat: ada di sini
 kunci publik: dikirim  ────────► kunci publik,  ◄──────────── kunci publik: dikirim
                                  ciphertext,
 tulis pesan                      tanda tangan
 ├ enkripsi (kunci publik dokter) ───────────────► simpan ───► ambil ciphertext
 ├ enkripsi (kunci publik sendiri)                              ├ dekripsi (kunci privat dokter)
 └ tanda tangan (kunci privat)                                  └ verifikasi (kunci publik pasien)
```

### 1. Pembuatan kunci (saat registrasi)

Dilakukan di browser, di dalam Web Worker agar tampilan tidak membeku:

1. Bangkitkan dua bilangan prima acak `p` dan `q` (masing-masing 512 bit), diuji dengan Miller-Rabin.
2. Hitung `n = p × q` dan `φ(n) = (p − 1)(q − 1)`.
3. Pilih `e = 65537`.
4. Hitung `d = e⁻¹ mod φ(n)` dengan algoritma Euclid yang diperluas.
5. Kunci publik `(n, e)` dikirim ke server. Kunci privat `(n, d)` disimpan di browser dan
   ditawarkan untuk diunduh sebagai file cadangan.

### 2. Enkripsi dan dekripsi pesan

1. Pesan diubah menjadi byte (UTF-8), sehingga huruf non-Latin dan emoji aman.
2. Setiap blok diberi **padding acak** gaya PKCS#1 v1.5: `00 02 [byte acak] 00 [pesan]`.
   Padding membuat pesan yang sama selalu menghasilkan ciphertext yang berbeda.
3. Pesan yang panjang dipecah per blok (dengan kunci 1024 bit, tiap blok memuat hingga 117 byte).
4. Tiap blok dienkripsi dengan `c = mᵉ mod n` dan didekripsi dengan `m = cᵈ mod n`.

Setiap pesan dienkripsi **dua kali**: dengan kunci publik penerima (supaya penerima bisa membaca)
dan dengan kunci publik pengirim (supaya pengirim tetap bisa membaca riwayat chatnya sendiri).
Server menyimpan keduanya sebagai ciphertext.

### 3. Tanda tangan digital

1. Pengirim menghitung hash `h = SHA-256(pesan)`.
2. Hash dibungkus menjadi blok `00 01 FF…FF 00 ‖ DigestInfo ‖ h`.
3. Blok itu "dienkripsi" dengan kunci privat pengirim: `s = EMᵈ mod n`.
4. Penerima menghitung `sᵉ mod n` dengan kunci publik pengirim, lalu membandingkannya dengan blok
   yang dihitung ulang dari pesan yang berhasil didekripsi.

Jika pesan atau tanda tangan diubah sedikit saja, verifikasi gagal. Ini menjamin **keaslian**
(benar dari pengirimnya) dan **integritas** (isi tidak berubah).

### 4. Apa yang diketahui server

| Data | Server tahu? |
|---|---|
| Nama, email, peran, spesialisasi | Ya |
| Hash password (scrypt) | Ya |
| Kunci publik pengguna | Ya |
| Ciphertext dan tanda tangan pesan | Ya |
| Siapa berkonsultasi dengan siapa, dan kapan | Ya (metadata tidak dienkripsi) |
| **Isi pesan (plaintext)** | **Tidak** |
| **Kunci privat** | **Tidak** |

## Komponen yang dibuat sendiri

| Komponen | File | Keterangan |
|---|---|---|
| Aritmetika modular | `public/rsa.js` | `modPow` (square-and-multiply), `egcd`, `modInv` |
| Uji bilangan prima | `public/rsa.js` | Miller-Rabin, 24 putaran |
| Pembangkit kunci | `public/rsa.js` | `generateKeyPair(bits)` |
| Padding dan pemecahan blok | `public/rsa.js` | Padding acak, enkripsi dan dekripsi per blok |
| Tanda tangan digital | `public/rsa.js` | `sign` dan `verify` |
| Fungsi hash | `public/sha256.js` | SHA-256 (FIPS 180-4); konstanta dihitung dari akar bilangan prima |

Aritmetika bilangan besar memakai `BigInt`, fitur bawaan bahasa JavaScript (bukan library).

Fungsi bawaan yang dipakai untuk keperluan **di luar algoritma RSA**: sumber acak
`crypto.getRandomValues` (browser) untuk bahan bilangan acak, serta `scrypt` dan pembangkit token
acak dari modul `crypto` Node.js untuk hash password dan token sesi. Modul `crypto` Node.js juga
dipakai di `test.js` hanya sebagai pembanding hasil SHA-256.

## Teknologi

- **Frontend:** HTML, CSS, JavaScript (tanpa framework)
- **Backend:** Node.js 18+ dan Express
- **Database:** SQLite (`better-sqlite3`)
- **Komunikasi chat:** REST API dengan polling tiap 3 detik

## Menjalankan

Butuh **Node.js 18 atau lebih baru**.

```bash
npm install
npm test        # tes RSA, SHA-256, dan tanda tangan digital
npm start       # buka http://localhost:3000
```

Untuk mencoba chat, buka dua browser berbeda (atau satu jendela biasa dan satu incognito):
daftar sebagai dokter di satu sisi, dan sebagai pasien di sisi lain.

## Panduan penggunaan

1. **Daftar:** pilih peran, isi data, lalu klik "Daftar & buat kunci RSA". Tunggu beberapa detik
   selama kunci dibuat.
2. **Simpan kunci privat:** klik "Unduh kunci privat" dan simpan filenya baik-baik. Jika file ini
   hilang dan data browser terhapus, riwayat chat tidak bisa dibuka lagi.
3. **Pasien:** pilih dokter di dashboard, klik "Konsultasi", lalu mulai chat.
4. **Dokter:** buka konsultasi dari daftar "Konsultasi saya", lalu balas pesan.
5. **Lihat ciphertext:** centang "Tampilkan ciphertext RSA" di halaman chat.
6. **Login di perangkat lain:** masuk, lalu impor file kunci privat yang tadi diunduh.

## API

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek server |
| POST | `/api/auth/register` | Daftar akun beserta kunci publik |
| POST | `/api/auth/login` | Login, mengembalikan token |
| GET | `/api/auth/me` | Data pengguna yang login |
| POST | `/api/auth/logout` | Keluar |
| GET | `/api/doctors` | Daftar dokter |
| POST | `/api/consultations` | Mulai konsultasi (pasien) |
| GET | `/api/consultations` | Daftar konsultasi milik pengguna |
| GET | `/api/consultations/:id` | Detail konsultasi dan kunci publik lawan bicara |
| GET | `/api/consultations/:id/messages` | Ambil pesan (ciphertext) |
| POST | `/api/consultations/:id/messages` | Kirim pesan (ciphertext dan tanda tangan) |

Semua endpoint kecuali `health`, `register`, dan `login` membutuhkan header
`Authorization: Bearer <token>`.

## Struktur proyek

```
halodawg/
├── server.js                  # titik masuk Express
├── test.js                    # tes RSA, SHA-256, tanda tangan
├── server/
│   ├── db.js                  # SQLite dan skema tabel
│   ├── middleware/auth.js     # sesi login (token di memori)
│   └── routes/
│       ├── auth.js            # register, login, me, logout
│       ├── doctors.js         # daftar dokter
│       └── consultations.js   # konsultasi dan pesan (ciphertext)
├── public/
│   ├── rsa.js                 # RSA buatan sendiri
│   ├── sha256.js              # SHA-256 buatan sendiri
│   ├── rsa-worker.js          # pembuatan kunci di Web Worker
│   ├── index.html             # login dan registrasi
│   ├── dashboard.html         # daftar dokter dan konsultasi
│   ├── chat.html              # ruang chat terenkripsi
│   ├── demo.html              # demo langkah demi langkah RSA
│   ├── css/style.css
│   └── js/                    # api.js, keystore.js, auth.js, chat.js, demo.js
└── db/                        # file SQLite (dibuat otomatis, tidak di-commit)
```

## Database

Empat tabel: `users`, `consultations`, `messages`, `prescriptions`. Kolom isi pesan hanya berisi
ciphertext (blok heksadesimal). Untuk membuktikannya:

```bash
node -e "const db=require('./server/db');console.log(db.prepare('SELECT id,substr(ciphertext,1,120) AS ct FROM messages').all())"
```

## Pengujian

`npm test` memeriksa:

- pembangkitan kunci dan enkripsi-dekripsi (termasuk pesan panjang, emoji, dan pesan kosong)
- ciphertext berbeda untuk pesan yang sama (padding acak berfungsi)
- Miller-Rabin pada bilangan prima dan komposit
- SHA-256 buatan sendiri cocok dengan implementasi bawaan Node pada berbagai panjang input
- tanda tangan valid untuk pesan asli, dan ditolak untuk pesan yang diubah, kunci publik yang salah,
  serta tanda tangan yang dirusak

## Keterbatasan

Proyek ini ditujukan untuk edukasi, bukan untuk produksi.

- Implementasi buatan sendiri tidak dirancang tahan serangan side-channel (waktu eksekusi tidak konstan).
- Kunci 1024 bit di bawah rekomendasi saat ini (2048 bit atau lebih). Ukuran ini dipilih agar
  pembuatan kunci di browser cepat.
- Padding PKCS#1 v1.5 lebih lemah daripada OAEP (enkripsi) dan PSS (tanda tangan).
- RSA langsung per blok kurang efisien dibandingkan skema hibrida (AES untuk isi pesan, RSA untuk kunci sesi).
- Kunci privat disimpan di `localStorage`, sehingga rentan jika ada celah XSS atau perangkat dipakai bersama.
- Tidak ada *forward secrecy*: kunci privat yang bocor membuka seluruh riwayat chat.
- Sesi login disimpan di memori server (hilang saat server restart), dan mode pengembangan belum memakai HTTPS.
- Metadata (siapa berkonsultasi dengan siapa, dan waktunya) tidak dienkripsi.
- Chat memakai polling, bukan WebSocket.

## Pengembangan selanjutnya

- Resep digital yang ditandatangani dokter (tabel `prescriptions` sudah disiapkan)
- Kunci 2048 bit, OAEP dan PSS
- Skema hibrida AES + RSA
- Penyimpanan kunci privat terenkripsi passphrase
- WebSocket untuk chat real-time dan HTTPS

## Status

- [x] Modul RSA (pembangkitan kunci, Miller-Rabin, padding, enkripsi per blok)
- [x] SHA-256 dan tanda tangan digital
- [x] Registrasi, login, dan pembuatan kunci di browser
- [x] Daftar dokter, konsultasi, dan chat terenkripsi
- [x] Halaman demo kripto
- [x] Antarmuka minimalis bertema biru
- [ ] Resep digital bertanda tangan dokter

## Pembuat
| Nama                        | NRP        |
| --------------------------- | ---------- |
| Hansen Chang                | 5027241028 |
| Ivan Syarifuddin            | 5027241045 |
| Hafiz Ramadhan              | 5027241096 |

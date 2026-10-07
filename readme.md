# SecureConsult

Aplikasi web konsultasi dokter online dengan enkripsi **RSA yang diimplementasikan sendiri**.
Dibuat untuk tugas mata kuliah Kriptografi.

- **Kerahasiaan:** pesan dienkripsi dengan kunci publik penerima, jadi server hanya menyimpan ciphertext.
- **Keaslian dan integritas:** setiap pesan ditandatangani dengan kunci privat pengirim (RSA + SHA-256).
- **Tanpa library kripto:** RSA, Miller-Rabin, padding, dan SHA-256 ditulis sendiri.
  Aritmetika bilangan besar memakai `BigInt` bawaan JavaScript.

## Fitur
- Registrasi dan login (pasien / dokter); kunci RSA dibuat di browser saat registrasi
- Daftar dokter dan pembuatan konsultasi
- Chat terenkripsi RSA dengan verifikasi tanda tangan digital pada tiap pesan
- Opsi menampilkan ciphertext pada chat
- Halaman demo (`/demo.html`) yang menampilkan p, q, n, φ(n), e, d, padding, enkripsi, dan dekripsi
- Ekspor dan impor kunci privat (file JSON)

## Menjalankan
Butuh **Node.js 18+**.

```bash
npm install
npm test        # tes RSA, SHA-256, dan tanda tangan digital
npm start       # buka http://localhost:3000
```

Untuk mencoba chat, buka dua browser berbeda (atau satu jendela biasa dan satu incognito):
daftar sebagai dokter di satu sisi, sebagai pasien di sisi lain.

## Struktur proyek
```
secureconsult/
├── server.js                  # titik masuk Express
├── test.js                    # tes RSA, SHA-256, tanda tangan
├── server/
│   ├── db.js                  # SQLite + skema tabel
│   ├── middleware/auth.js     # sesi login (token di memori)
│   └── routes/
│       ├── auth.js            # register, login, me, logout
│       ├── doctors.js         # daftar dokter
│       └── consultations.js   # konsultasi dan pesan (ciphertext)
├── public/
│   ├── rsa.js                 # RSA buatan sendiri (keygen, enkripsi, tanda tangan)
│   ├── sha256.js              # SHA-256 buatan sendiri
│   ├── rsa-worker.js          # pembuatan kunci di Web Worker
│   ├── index.html             # login / registrasi
│   ├── dashboard.html         # daftar dokter dan konsultasi
│   ├── chat.html              # ruang chat terenkripsi
│   ├── demo.html              # demo langkah demi langkah RSA
│   ├── css/style.css
│   └── js/                    # api.js, keystore.js, auth.js, chat.js, demo.js
└── db/                        # file SQLite (dibuat otomatis, tidak di-commit)
```

## Cara kerja kriptografi

**Pembuatan kunci** (di browser): pilih dua prima acak `p` dan `q` (uji Miller-Rabin),
`n = p·q`, `φ(n) = (p−1)(q−1)`, `e = 65537`, `d = e⁻¹ mod φ(n)` (extended Euclidean).
Kunci publik `(n, e)` dikirim ke server; kunci privat tetap di browser.

**Enkripsi:** pesan di-encode UTF-8, diberi padding acak gaya PKCS#1 v1.5
(`00 02 [acak] 00 [pesan]`), dipecah per blok, lalu `c = m^e mod n` per blok.
Tiap pesan dienkripsi dua kali: dengan kunci publik penerima (untuk dibaca penerima)
dan dengan kunci publik pengirim (agar pengirim bisa membaca riwayatnya).

**Tanda tangan:** `h = SHA-256(pesan)`, dibungkus `00 01 FF…FF 00 ‖ DigestInfo ‖ h`,
lalu `s = EM^d mod n`. Penerima memverifikasi dengan `s^e mod n`.

**Yang diketahui server:** kunci publik, ciphertext, dan tanda tangan. Server tidak pernah menerima
kunci privat maupun plaintext pesan.

## Database
Tabel: `users`, `consultations`, `messages`, `prescriptions`.
Kolom isi pesan hanya berisi ciphertext (blok hex).
Untuk melihat buktinya:
```bash
node -e "const db=require('./server/db');console.log(db.prepare('SELECT id,substr(ciphertext,1,120) AS ct FROM messages').all())"
```

## Keterbatasan
Proyek ini untuk tujuan edukasi, bukan produksi.
- Implementasi buatan sendiri tidak dirancang tahan serangan side-channel (waktu eksekusi tidak konstan).
- Kunci 1024 bit di bawah rekomendasi saat ini (2048 bit atau lebih); dipilih agar pembuatan kunci di browser cepat.
- Kunci privat disimpan di `localStorage`, sehingga rentan jika ada celah XSS atau perangkat dipakai bersama.
- Tidak ada forward secrecy; kunci privat yang bocor membuka seluruh riwayat chat.
- Sesi login disimpan di memori server (hilang saat restart); belum memakai HTTPS di mode pengembangan.
- Metadata (siapa berkonsultasi dengan siapa, waktu pesan) tidak dienkripsi.

## Status
- [x] Modul RSA (keygen, Miller-Rabin, padding, enkripsi per blok)
- [x] SHA-256 dan tanda tangan digital
- [x] Registrasi, login, dan kunci di browser
- [x] Daftar dokter, konsultasi, dan chat terenkripsi
- [x] Halaman demo kripto
- [ ] Resep digital bertanda tangan dokter

## Pembuat
___________________________
|Hansen Chang | 5027241028|
|Ivan Syarifuddin | 5027241045|
|Hafiz Ramadhan | 5027241096 |
______________________________

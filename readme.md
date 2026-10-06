# SecureConsult

Aplikasi web konsultasi dokter online. Pesan dienkripsi dengan **RSA buatan sendiri** (`public/rsa.js`, tanpa library kripto, aritmetika memakai `BigInt` bawaan JavaScript). Kunci privat dibuat dan disimpan di browser; server hanya menyimpan ciphertext.

## Menjalankan
```bash
npm install
npm test        # tes modul RSA
npm start       # http://localhost:3000
```
Butuh Node.js 18+.

## Struktur
- `public/` : frontend + modul RSA (semua kripto di sini)
- `server/` : API Express, database SQLite (hanya ciphertext)
- `db/` : file database (otomatis, tidak di-commit)
- `docs/` : PRD dan bahan laporan

## Status
- [x] Modul RSA (keygen, Miller-Rabin, enkripsi/dekripsi per blok, padding)
- [x] Inisiasi proyek (server, skema database)
- [x] Auth (registrasi/login) + keygen di browser
- [ ] Chat terenkripsi
- [ ] Halaman demo kripto
- [ ] Tanda tangan digital (opsional)
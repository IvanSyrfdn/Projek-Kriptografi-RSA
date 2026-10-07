const RSA = require('./public/rsa.js');
let t = Date.now();
const { publicKey, privateKey } = RSA.generateKeyPair(1024);
console.log('Keygen 1024 bit:', Date.now() - t, 'ms');
const msg = 'Dok, sejak 3 hari saya demam dan batuk 🤒. ' + 'Apakah perlu ke rumah sakit? '.repeat(12);
const c1 = RSA.encrypt(msg, publicKey), c2 = RSA.encrypt(msg, publicKey);
console.log('Jumlah blok:', c1.length, '| ciphertext acak (c1 != c2):', c1[0] !== c2[0]);
console.log('Dekripsi benar:', RSA.decrypt(c1, privateKey) === msg);
console.log('Pesan kosong:', RSA.decrypt(RSA.encrypt('', publicKey), privateKey) === '');
console.log('Miller-Rabin:', RSA.isPrime(104729n), !RSA.isPrime(104731n * 3n));
// ---- Tes SHA-256 buatan sendiri vs. implementasi bawaan Node (hanya untuk pembanding) ----
const SHA = require('./public/sha256.js'), nodeCrypto = require('crypto');
let okHash = true;
for (const len of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 1000, 100000]) {
  const buf = nodeCrypto.randomBytes(len);
  const mine = Buffer.from(SHA.sha256(buf)).toString('hex');
  if (mine !== nodeCrypto.createHash('sha256').update(buf).digest('hex')) { okHash = false; console.log('SHA-256 beda untuk panjang', len); }
}
console.log('SHA-256 cocok:', okHash, '| "abc" =', SHA.sha256Hex('abc').slice(0, 16) + '…');

// ---- Tes tanda tangan digital ----
const pesan = 'Resep: Paracetamol 500 mg, 3x sehari';
const sig = RSA.sign(pesan, privateKey);
console.log('Verifikasi pesan asli:', RSA.verify(pesan, sig, publicKey));
console.log('Pesan diubah ditolak:', !RSA.verify(pesan.replace('500', '900'), sig, publicKey));
const lain = RSA.generateKeyPair(1024);
console.log('Kunci publik lain ditolak:', !RSA.verify(pesan, sig, lain.publicKey));
console.log('Tanda tangan diubah ditolak:', !RSA.verify(pesan, sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0'), publicKey));
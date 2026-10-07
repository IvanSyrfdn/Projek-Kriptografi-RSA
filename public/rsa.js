/* RSA buatan sendiri (tanpa library kripto). Aritmetika memakai BigInt bawaan JS.
   Berjalan di browser maupun Node.js. */
(function (root) {
  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues)
    ? globalThis.crypto : require('crypto').webcrypto;

  // ---------- Utilitas bilangan besar ----------
  function randomBytes(n) { const b = new Uint8Array(n); cryptoObj.getRandomValues(b); return b; }
  function bytesToBig(bytes) { let x = 0n; for (const b of bytes) x = (x << 8n) | BigInt(b); return x; }
  function bigToBytes(x, len) {
    const out = new Uint8Array(len);
    for (let i = len - 1; i >= 0; i--) { out[i] = Number(x & 0xffn); x >>= 8n; }
    return out;
  }
  function bitLength(x) { return x.toString(2).length; }
  const toHex = (x) => x.toString(16);
  const fromHex = (s) => BigInt('0x' + s);

  // a^b mod m dengan square-and-multiply
  function modPow(a, b, m) {
    let r = 1n; a %= m;
    while (b > 0n) { if (b & 1n) r = (r * a) % m; a = (a * a) % m; b >>= 1n; }
    return r;
  }
  // Extended Euclidean: kembalikan [g, x, y] dengan a*x + b*y = g
  function egcd(a, b) {
    let [or, r] = [a, b], [os, s] = [1n, 0n], [ot, t] = [0n, 1n];
    while (r !== 0n) {
      const q = or / r;
      [or, r] = [r, or - q * r]; [os, s] = [s, os - q * s]; [ot, t] = [t, ot - q * t];
    }
    return [or, os, ot];
  }
  function modInv(a, m) {
    const [g, x] = egcd(((a % m) + m) % m, m);
    if (g !== 1n) throw new Error('Invers modulo tidak ada');
    return ((x % m) + m) % m;
  }
  function randomBig(bits) { // acak tepat `bits` bit (bit teratas = 1)
    const len = Math.ceil(bits / 8), b = randomBytes(len);
    let x = bytesToBig(b) & ((1n << BigInt(bits)) - 1n);
    return x | (1n << BigInt(bits - 1));
  }
  function randomBelow(n) { // acak di [2, n-2]
    let x; do { x = bytesToBig(randomBytes(Math.ceil(bitLength(n) / 8))) % n; } while (x < 2n);
    return x;
  }

  // ---------- Bilangan prima ----------
  const SMALL = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n];
  function isPrime(n, rounds = 24) { // Miller-Rabin
    if (n < 2n) return false;
    for (const p of SMALL) { if (n === p) return true; if (n % p === 0n) return false; }
    let d = n - 1n, s = 0;
    while ((d & 1n) === 0n) { d >>= 1n; s++; }
    outer: for (let i = 0; i < rounds; i++) {
      let x = modPow(randomBelow(n - 1n), d, n);
      if (x === 1n || x === n - 1n) continue;
      for (let r = 1; r < s; r++) { x = (x * x) % n; if (x === n - 1n) continue outer; }
      return false;
    }
    return true;
  }
  function generatePrime(bits) {
    for (;;) {
      let c = randomBig(bits) | 1n | (1n << BigInt(bits - 2)); // ganjil, 2 bit teratas = 1
      if (isPrime(c)) return c;
    }
  }

  // ---------- Pembangkitan kunci ----------
  function generateKeyPair(bits = 1024, e = 65537n) {
    for (;;) {
      const p = generatePrime(bits / 2), q = generatePrime(bits / 2);
      if (p === q) continue;
      const n = p * q, phi = (p - 1n) * (q - 1n);
      if (bitLength(n) !== bits || egcd(e, phi)[0] !== 1n) continue;
      const d = modInv(e, phi);
      return {
        publicKey: { n: toHex(n), e: toHex(e) },
        privateKey: { n: toHex(n), d: toHex(d), p: toHex(p), q: toHex(q) },
      };
    }
  }

  // ---------- Padding acak (gaya PKCS#1 v1.5 tipe 2) ----------
  // Blok: 00 02 [PS acak, tanpa byte 0, min 8 byte] 00 [pesan]
  function pad(msg, k) {
    const psLen = k - msg.length - 3, ps = new Uint8Array(psLen);
    for (let i = 0; i < psLen; i++) { let b = 0; while (b === 0) b = randomBytes(1)[0]; ps[i] = b; }
    const out = new Uint8Array(k); out[1] = 2; out.set(ps, 2); out.set(msg, k - msg.length); return out;
  }
  function unpad(block) {
    if (block[0] !== 0 || block[1] !== 2) throw new Error('Padding tidak valid');
    let i = 2; while (i < block.length && block[i] !== 0) i++;
    if (i < 10 || i >= block.length) throw new Error('Padding tidak valid');
    return block.slice(i + 1);
  }

  // ---------- Enkripsi / dekripsi teks (per blok) ----------
  function keyBytes(nHex) { return Math.ceil(bitLength(fromHex(nHex)) / 8); }

  function encrypt(text, publicKey) {
    const n = fromHex(publicKey.n), e = fromHex(publicKey.e), k = keyBytes(publicKey.n);
    const data = new TextEncoder().encode(text), maxLen = k - 11, blocks = [];
    for (let i = 0; i < Math.max(data.length, 1); i += maxLen) {
      const m = bytesToBig(pad(data.slice(i, i + maxLen), k));
      blocks.push(toHex(modPow(m, e, n)).padStart(k * 2, '0'));
    }
    return blocks; // array string hex, satu per blok
  }

  function decrypt(blocks, privateKey) {
    const n = fromHex(privateKey.n), d = fromHex(privateKey.d), k = keyBytes(privateKey.n);
    const parts = blocks.map((c) => unpad(bigToBytes(modPow(fromHex(c), d, n), k)));
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
    return new TextDecoder().decode(out);
  }

    // ---------- Tanda tangan digital (hash SHA-256 buatan sendiri + RSA) ----------
  const sha = () => ((typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.SHA256);
  // Awalan DigestInfo SHA-256 (ASN.1), sama seperti PKCS#1 v1.5
  const DIGEST_PREFIX = Uint8Array.from([0x30,0x31,0x30,0x0d,0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01,0x05,0x00,0x04,0x20]);

  // Blok yang ditandatangani: 00 01 FF..FF 00 [DigestInfo || hash]
  function encodeForSign(text, k) {
    const hash = sha().sha256(new TextEncoder().encode(text));
    const t = new Uint8Array(DIGEST_PREFIX.length + hash.length); t.set(DIGEST_PREFIX); t.set(hash, DIGEST_PREFIX.length);
    if (k < t.length + 11) throw new Error('Kunci terlalu pendek untuk tanda tangan');
    const em = new Uint8Array(k).fill(0xff);
    em[0] = 0; em[1] = 1; em[k - t.length - 1] = 0; em.set(t, k - t.length);
    return em;
  }
  function sign(text, privateKey) { // s = EM^d mod n
    const n = fromHex(privateKey.n), d = fromHex(privateKey.d), k = keyBytes(privateKey.n);
    return toHex(modPow(bytesToBig(encodeForSign(text, k)), d, n)).padStart(k * 2, '0');
  }
  function verify(text, signatureHex, publicKey) { // EM' = s^e mod n, bandingkan dengan EM hasil hash ulang
    try {
      const n = fromHex(publicKey.n), e = fromHex(publicKey.e), k = keyBytes(publicKey.n);
      const s = fromHex(signatureHex);
      if (s >= n) return false;
      const got = bigToBytes(modPow(s, e, n), k), want = encodeForSign(text, k);
      let diff = 0; for (let i = 0; i < k; i++) diff |= got[i] ^ want[i];
      return diff === 0;
    } catch (err) { return false; }
  }

  const RSA = { generateKeyPair, encrypt, decrypt, sign, verify, isPrime, generatePrime, modPow, modInv, egcd,
                pad, unpad, bytesToBig, bigToBytes };
  
  if (typeof module !== 'undefined' && module.exports) module.exports = RSA; else root.RSA = RSA;
})(typeof self !== 'undefined' ? self : this);
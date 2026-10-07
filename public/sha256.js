/* SHA-256 buatan sendiri (FIPS 180-4), tanpa library. Berjalan di browser dan Node.js. */
(function (root) {
  // Konstanta dihitung dari akar bilangan prima, sesuai definisi standar:
  // H = 32 bit pecahan dari akar kuadrat 8 prima pertama, K = 32 bit pecahan dari akar kubik 64 prima pertama.
  const primes = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
  const frac32 = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const H0 = primes.slice(0, 8).map((p) => frac32(Math.sqrt(p)));
  const K = primes.map((p) => frac32(Math.cbrt(p)));

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(bytes) {
    const H = H0.slice();
    const l = bytes.length;
    // Padding: bit 1, nol-nol, lalu panjang pesan (64 bit) di akhir
    const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(bytes); padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(l / 0x20000000));
    dv.setUint32(padded.length - 4, (l << 3) >>> 0);

    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer);
    H.forEach((v, i) => odv.setUint32(i * 4, v));
    return out;
  }
  const sha256Hex = (text) => Array.from(sha256(new TextEncoder().encode(text)), (b) => b.toString(16).padStart(2, '0')).join('');

  const SHA256 = { sha256, sha256Hex };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHA256; else root.SHA256 = SHA256;
})(typeof self !== 'undefined' ? self : this);
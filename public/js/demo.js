const $ = (s) => document.querySelector(s);
const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
let keys = null;

function section(parent, title) {
  const s = document.createElement('section');
  const h = document.createElement('h3'); h.textContent = title;
  s.append(h); parent.append(s); return s;
}
function line(parent, label, value) {
  const d = document.createElement('div'); d.className = 'row';
  const l = document.createElement('b'); l.textContent = label;
  const c = document.createElement('code'); c.textContent = String(value);
  d.append(l, c); parent.append(d);
}
const big = (h) => BigInt('0x' + h);

$('#gen').onclick = () => {
  const bits = Number($('#bits').value);
  const out = $('#out'); out.textContent = ''; $('#out2').textContent = '';
  const t = Date.now();
  keys = RSA.generateKeyPair(bits);
  const ms = Date.now() - t;

  const p = big(keys.privateKey.p), q = big(keys.privateKey.q), n = big(keys.publicKey.n);
  const e = big(keys.publicKey.e), d = big(keys.privateKey.d);
  const phi = (p - 1n) * (q - 1n);

  const s = section(out, `Kunci ${bits} bit (${ms} ms)`);
  line(s, 'p', p);
  line(s, 'q', q);
  line(s, 'n = p × q', n);
  line(s, 'φ(n) = (p−1)(q−1)', phi);
  line(s, 'e (kunci publik)', e);
  line(s, 'd = e⁻¹ mod φ(n) (kunci privat)', d);
  line(s, 'Cek: e × d mod φ(n)', (e * d) % phi + '  (harus 1)');
  line(s, 'Miller-Rabin p dan q', RSA.isPrime(p) + ' dan ' + RSA.isPrime(q));
  $('#step2').hidden = false;
};

$('#enc').onclick = () => {
  if (!keys) return;
  const out = $('#out2'); out.textContent = '';
  const text = $('#plain').value;
  const n = big(keys.publicKey.n), e = big(keys.publicKey.e), d = big(keys.privateKey.d);
  const k = Math.ceil(n.toString(2).length / 8);          // ukuran blok (byte)
  const data = new TextEncoder().encode(text);
  const maxLen = k - 11;                                    // sisa 11 byte untuk padding
  const chunk = data.slice(0, maxLen);

  const a = section(out, 'Detail blok pertama');
  line(a, 'Plaintext', text);
  line(a, 'Byte UTF-8 (hex)', hex(data));
  line(a, 'Ukuran blok k', `${k} byte (maks. ${maxLen} byte pesan per blok), jumlah blok: ${Math.max(1, Math.ceil(data.length / maxLen))}`);
  const padded = RSA.pad(chunk, k);
  line(a, 'Setelah padding (00 02 acak 00 pesan)', hex(padded));
  const m = RSA.bytesToBig(padded);
  line(a, 'm (angka dari blok)', m);
  const c = RSA.modPow(m, e, n);
  line(a, 'Enkripsi: c = m^e mod n', c);
  const m2 = RSA.modPow(c, d, n);
  line(a, 'Dekripsi: m = c^d mod n', m2);
  line(a, 'm hasil dekripsi sama dengan m awal?', m2 === m);
  const back = RSA.unpad(RSA.bigToBytes(m2, k));
  line(a, 'Setelah padding dibuang', new TextDecoder().decode(back));

  const b = section(out, 'Seluruh pesan (semua blok)');
  const c1 = RSA.encrypt(text, keys.publicKey), c2 = RSA.encrypt(text, keys.publicKey);
  c1.forEach((blk, i) => line(b, `Ciphertext blok ${i + 1}`, blk));
  line(b, 'Dekripsi', RSA.decrypt(c1, keys.privateKey));
  line(b, 'Enkripsi kedua kali sama persis?', c1[0] === c2[0] ? 'ya' : 'tidak (padding acak membuat ciphertext selalu berbeda)');
};
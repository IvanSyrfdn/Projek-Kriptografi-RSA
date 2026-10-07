const $ = (s) => document.querySelector(s);
const cid = new URLSearchParams(location.search).get('id');
let me, other, priv, lastId = 0;

const status = (t) => ($('#status').textContent = t);

async function init() {
  me = (await API.call('/auth/me')).user;
  priv = KeyStore.load(me.email);
  if (!priv) { status('Kunci privat tidak ditemukan di browser ini. Impor lewat halaman login.'); $('#form-send').hidden = true; return; }
  other = (await API.call('/consultations/' + cid)).other;
  $('#title').textContent = 'Chat dengan ' + other.name;
  await poll();
  setInterval(poll, 3000);
}

async function poll() {
  const { messages } = await API.call(`/consultations/${cid}/messages?after=${lastId}`);
  messages.forEach((m) => { lastId = m.id; render(m); });
  if (messages.length) $('#messages').scrollTop = $('#messages').scrollHeight;
}

function render(m) {
  const mine = m.sender_id === me.id;
  const blocks = mine ? m.ciphertext.forSender : m.ciphertext.forRecipient;
  let text, valid = false;
  try { text = RSA.decrypt(blocks, priv); } catch (e) { text = '[gagal didekripsi]'; }

  const signerKey = mine ? me.publicKey : other.publicKey; // kunci publik pengirim
  const badge = document.createElement('small'); badge.className = 'badge';
  if (!m.signature) badge.textContent = 'tanpa tanda tangan';
  else if (RSA.verify(text, m.signature, signerKey)) { badge.textContent = '✓ tanda tangan valid'; valid = true; }
  else badge.textContent = '⚠ tanda tangan TIDAK valid';
  if (m.signature && !valid) badge.classList.add('bad');

  const div = document.createElement('div');
  div.className = 'msg' + (mine ? ' mine' : '');
  const p = document.createElement('div'); p.textContent = text;
  const c = document.createElement('small'); c.className = 'cipher';
  c.textContent = `${blocks.length} blok · ${blocks[0].slice(0, 48)}…`;
  div.append(p, badge, c);
  $('#messages').append(div);
}

$('#form-send').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;
  try {
      const ciphertext = {
      forRecipient: RSA.encrypt(text, other.publicKey),
      forSender: RSA.encrypt(text, me.publicKey),
    };
    const signature = RSA.sign(text, priv); // ditandatangani dengan kunci privat pengirim
    await API.call(`/consultations/${cid}/messages`, 'POST', { ciphertext, signature });
    $('#text').value = '';
    await poll();
  } catch (err) { status(err.message); }
};

$('#toggle-cipher').onchange = (e) => $('#messages').classList.toggle('show-cipher', e.target.checked);
init().catch(() => (location.href = 'index.html'));
const $ = (s) => document.querySelector(s);
const status = (t) => ($('#status').textContent = t);
const fl = $('#form-login'), fr = $('#form-register');

function showTab(login) {
  fl.hidden = !login; fr.hidden = login;
  $('#tab-login').classList.toggle('active', login); $('#tab-register').classList.toggle('active', !login); status('');
}
$('#tab-login').onclick = () => showTab(true);
$('#tab-register').onclick = () => showTab(false);
fr.role.onchange = () => (fr.specialty.hidden = fr.role.value !== 'doctor');

fr.onsubmit = async (e) => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(fr)); fr.querySelector('button').disabled = true;
  status('Membuat pasangan kunci RSA 1024 bit di browser…');
  const worker = new Worker('rsa-worker.js');
  worker.onmessage = async ({ data }) => {
    try {
      status(`Kunci jadi (${data.ms} ms). Mendaftarkan akun…`);
      const res = await API.call('/auth/register', 'POST', { ...f, publicKey: data.keys.publicKey });
      KeyStore.save(f.email, data.keys.privateKey);
      KeyStore.save(f.email, data.keys.privateKey);
      localStorage.setItem('sc_token', res.token);
      showBackup(f.email, data.keys.privateKey);
    } catch (err) { status(err.message); fr.querySelector('button').disabled = false; }
  };
  worker.postMessage({ bits: 1024 });
};

function showBackup(email, priv) {
  fl.hidden = true; fr.hidden = true;
  document.querySelector('.tabs').hidden = true;
  $('#backup').hidden = false;
  status('');
  $('#btn-download').onclick = () => { KeyStore.download(email, priv); $('#btn-continue').disabled = false; };
  $('#btn-continue').onclick = () => (location.href = 'dashboard.html');
}

fl.onsubmit = async (e) => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(fl));
  try {
    let priv = KeyStore.load(f.email);
    const file = $('#import-key').files[0];
    if (!priv && file) { priv = await KeyStore.importFile(file); KeyStore.save(f.email, priv); }
    if (!priv) { $('#import-wrap').hidden = false; return status('Impor file kunci privat dulu untuk login di perangkat ini.'); }
    const res = await API.call('/auth/login', 'POST', f);
    localStorage.setItem('sc_token', res.token); location.href = 'dashboard.html';
  } catch (err) { status(err.message); }
};
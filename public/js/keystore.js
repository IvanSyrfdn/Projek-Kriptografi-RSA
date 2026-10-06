const KeyStore = {
  save: (email, priv) => localStorage.setItem('sc_priv:' + email, JSON.stringify(priv)),
  load: (email) => { const s = localStorage.getItem('sc_priv:' + email); return s ? JSON.parse(s) : null; },
  download(email, priv) {
  const blob = new Blob([JSON.stringify(priv, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kunci-privat-${email}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
},
  async importFile(file) {
    const k = JSON.parse(await file.text());
    if (!k.n || !k.d) throw new Error('File kunci tidak valid');
    return k;
  },
};
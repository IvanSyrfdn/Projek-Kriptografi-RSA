const API = {
  token: () => localStorage.getItem('sc_token'),
  async call(path, method = 'GET', body) {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(API.token() ? { Authorization: 'Bearer ' + API.token() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
    return data;
  },
};
const express = require('express');
const path = require('path');
require('./server/db'); // inisialisasi database + tabel

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'HaloDawg' }));
app.use('/api/auth', require('./server/routes/auth'));

app.use('/api/doctors', require('./server/routes/doctors'));
app.use('/api/consultations', require('./server/routes/consultations'));

app.listen(PORT, () => console.log(`HaloDawg berjalan di http://localhost:${PORT}`));
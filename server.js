const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');

const app = express();

// --- Konfigurasi ---
const PORT = 31401; // Port tempat proxy ini berjalan
const TARGET_NODE = 'http://203.236.58.84:31401'; // Alamat server Horizon yang dituju

// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: true })); // Untuk menerima form data (x-www-form-urlencoded)
app.use(express.json()); // Untuk menerima JSON dari client

// --- Logic Reverse Proxy Utama ---
app.use(async (req, res) => {
  const targetUrl = TARGET_NODE + req.originalUrl;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`; // Misal: http://localhost:31401

  console.log(`[PROXY] Meneruskan ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  try {
    // 1. Menyiapkan dan meneruskan permintaan ke server target
    const headers = { ...req.headers };
    // Hapus header 'host' agar server target tidak bingung
    delete headers.host;

    let dataToSend;
    // Stellar Horizon API (untuk submit transaksi) menggunakan 'Content-Type': 'application/x-www-form-urlencoded'
    if (req.method === 'POST' && req.is('application/x-www-form-urlencoded')) {
        // Jika sudah form-urlencoded, teruskan saja
        dataToSend = qs.stringify(req.body); 
    } else {
        // Untuk GET, DELETE, atau JSON POST, teruskan body apa adanya
        dataToSend = req.body;
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: dataToSend,
      // Penting: Cegah axios dari parsing JSON secara otomatis agar kita bisa memanipulasi string mentahnya
      responseType: 'text',
      transformResponse: [(data) => data],
    });

    // 2. Memodifikasi respons sebelum mengirim ke klien
    let responseBody = response.data;
    const contentType = response.headers['content-type'];
    
    // Hanya modifikasi respons jika itu adalah JSON, untuk menghindari merusak file biner atau teks biasa
    if (responseBody && contentType && contentType.includes('application/json')) {
      // Ganti semua kemunculan URL target dengan URL proxy
      const targetRegex = new RegExp(TARGET_NODE, 'g');
      responseBody = responseBody.replace(targetRegex, proxyBaseUrl);
      console.log(`[PROXY] Menulis ulang URL di respons JSON.`);
    }

    // 3. Mengirimkan respons yang sudah dimodifikasi kembali ke klien
    // Salin semua header dari respons target (seperti Content-Type, dll)
    Object.keys(response.headers).forEach((key) => {
      res.setHeader(key, response.headers[key]);
    });
    
    // Kirim status dan body yang sudah final
    res.status(response.status).send(responseBody);

  } catch (err) {
    if (err.response) {
      // Kesalahan dari server target (misalnya 404, 400)
      console.error(`[PROXY ERROR] Target server merespons dengan status ${err.response.status}:`, err.response.data);
      res.status(err.response.status).send(err.response.data);
    } else if (err.request) {
      // Kesalahan koneksi ke server target
      console.error(`[PROXY ERROR] Tidak bisa terhubung ke ${targetUrl}:`, err.message);
      res.status(502).send({ error: 'Bad Gateway', message: `Tidak dapat terhubung ke server target di ${TARGET_NODE}` });
    } else {
      // Kesalahan lain
      console.error('[PROXY ERROR] Kesalahan internal:', err.message);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Reverse proxy berjalan di http://localhost:${PORT}`);
  console.log(`Meneruskan permintaan ke: ${TARGET_NODE}`);
});

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = 31401; 
const TARGET_NODE = 'http://81.240.60.124:31401'; 

// Telegram
const TELEGRAM_BOT_TOKEN = '7533580803:AAHzOk1fjnfwnwYwB-Gz63S-mYo1F5WoFk0';
const TELEGRAM_CHAT_ID = '7890743177';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// File simpan transaksi
const LOG_FILE = path.join(__dirname, 'transactions.json');

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // css jika ada

// Basic auth untuk admin panel
app.use('/admin', basicAuth({
    users: { 'admin': 'password123' }, // ganti username & password sesuai keinginan
    challenge: true,
}));

// Fungsi kirim Telegram
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await axios.post(TELEGRAM_API_URL, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2'
    });
    console.log('[TELEGRAM] Notifikasi berhasil dikirim.');
  } catch (err) {
    console.error('[TELEGRAM ERROR]', err.response ? err.response.data : err.message);
  }
}

// Simpan transaksi ke file
function saveTransactionLog(txData) {
  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { logs = []; }
  }
  logs.unshift(txData);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// Hapus transaksi berdasarkan hash
function deleteTransactionLog(hash) {
  if (!fs.existsSync(LOG_FILE)) return;
  let logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  logs = logs.filter(tx => tx.hash !== hash);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// Hapus semua transaksi
function clearTransactionLog() {
  fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}

// Admin Panel
app.get('/admin', (req, res) => {
  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { logs = []; }
  }

  let html = `
  <html>
  <head>
    <title>Admin Panel - Transaksi</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
      h2 { text-align: center; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { padding: 8px; text-align: center; border: 1px solid #ccc; }
      th { background: #333; color: #fff; }
      tr:nth-child(even) { background: #eee; }
      a.delete-btn, a.clear-btn { color: red; text-decoration: none; font-weight: bold; }
      a.delete-btn:hover, a.clear-btn:hover { text-decoration: underline; }
      .top-bar { margin-bottom: 10px; text-align: right; }
      .top-bar a { margin-left: 10px; }
    </style>
  </head>
  <body>
    <h2>Riwayat Transaksi</h2>
    <div class="top-bar">
      <a href="/admin/clear" class="clear-btn" onclick="return confirm('Yakin ingin hapus semua transaksi?')">Hapus Semua</a>
    </div>
    <table>
      <tr>
        <th>Hash</th>
        <th>Memo</th>
        <th>Source</th>
        <th>Ledger</th>
        <th>Fee</th>
        <th>Waktu</th>
        <th>Berhasil</th>
        <th>Aksi</th>
      </tr>`;

  logs.forEach(tx => {
    html += `
      <tr>
        <td><a href="https://blockexplorer.minepi.com/mainnet/transactions/${tx.hash}" target="_blank">${tx.hash}</a></td>
        <td>${tx.memo || '-'}</td>
        <td>${tx.source_account || '-'}</td>
        <td>${tx.ledger || '-'}</td>
        <td>${tx.fee_charged || '0'}</td>
        <td>${tx.created_at || '-'}</td>
        <td>${tx.successful ? '✅' : '❌'}</td>
        <td><a href="/admin/delete/${tx.hash}" class="delete-btn" onclick="return confirm('Yakin ingin hapus transaksi ini?')">Hapus</a></td>
      </tr>`;
  });

  html += `
    </table>
  </body>
  </html>`;
  res.send(html);
});

// Hapus transaksi
app.get('/admin/delete/:hash', (req, res) => {
  const hash = req.params.hash;
  deleteTransactionLog(hash);
  res.redirect('/admin');
});

// Hapus semua transaksi
app.get('/admin/clear', (req, res) => {
  clearTransactionLog();
  res.redirect('/admin');
});

// Reverse Proxy utama
app.use(async (req, res) => {
  const targetUrl = TARGET_NODE + req.originalUrl;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;
  console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  try {
    const headers = { ...req.headers };
    delete headers.host;

    let dataToSend = req.body;
    if (req.method === 'POST' && req.is('application/x-www-form-urlencoded')) {
      dataToSend = qs.stringify(req.body); 
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: dataToSend,
      responseType: 'text',
      transformResponse: [(data) => data]
    });

    // Parsing transaksi
    if (req.method === 'POST' && req.originalUrl === '/transactions') {
      try {
        const jsonResponse = JSON.parse(response.data);

        // Simpan semua transaksi
        saveTransactionLog(jsonResponse);

        // Kirim ke Telegram jika sukses
        if (jsonResponse.successful) {
          const hash = jsonResponse.hash || '-';
          const ledger = jsonResponse.ledger || '-';
          const memo = jsonResponse.memo || '(tidak ada)';
          const source = jsonResponse.source_account || '-';
          const fee = jsonResponse.fee_charged || '0';
          const createdAt = jsonResponse.created_at || '-';

          const telegramMessage =
            `✅ Berhasil\n\n` +
            `Transaksi Baru\n` +
            `Hash: [${hash}](https://blockexplorer.minepi.com/mainnet/transactions/${hash})\n` +
            `Ledger: ${ledger}\n` +
            `Memo: ${memo}\n` +
            `Source: ${source}\n` +
            `Fee: ${fee}\n` +
            `Waktu: ${createdAt}`;

          sendTelegramNotification(telegramMessage)
            .catch(err => console.error('[TELEGRAM] Error:', err.message));
        }
      } catch (e) {
        console.error('[PROXY] Gagal parsing response transaksi:', e.message);
      }
    }

    let responseBody = response.data;
    const contentType = response.headers['content-type'];
    if (responseBody && contentType && contentType.includes('application/json')) {
      const targetRegex = new RegExp(TARGET_NODE, 'g');
      responseBody = responseBody.replace(targetRegex, proxyBaseUrl);
    }

    Object.keys(response.headers).forEach(key => {
      res.setHeader(key, response.headers[key]);
    });
    
    res.status(response.status).send(responseBody);

  } catch (err) {
    if (err.response) {
      res.status(err.response.status).send(err.response.data);
    } else if (err.request) {
      res.status(502).send({ error: 'Bad Gateway', message: `Tidak dapat terhubung ke server target` });
    } else {
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Reverse proxy berjalan di http://localhost:${PORT}`);
  console.log(`Admin Panel di http://localhost:${PORT}/admin`);
});

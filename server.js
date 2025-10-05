const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');

const app = express();

// --- Konfigurasi ---
const PORT = 31401; 
const TARGET_NODE = 'http://194.35.14:31401'; 

// --- Konfigurasi Telegram ---
const TELEGRAM_BOT_TOKEN = '7533580803:AAHzOk1fjnfwnwYwB-Gz63S-mYo1F5WoFk0';
const TELEGRAM_CHAT_ID = '7890743177';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 

// --- Fungsi untuk mengirim notifikasi ke Telegram ---
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    await axios.post(TELEGRAM_API_URL, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2',
    });
    console.log('[TELEGRAM] Notifikasi berhasil dikirim.');
  } catch (error) {
    console.error('[TELEGRAM ERROR] Gagal mengirim notifikasi:', error.response ? error.response.data : error.message);
  }
}

// --- Reverse Proxy Utama ---
app.use(async (req, res) => {
  const targetUrl = TARGET_NODE + req.originalUrl;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;

  console.log(`[PROXY] Meneruskan ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  try {
    const headers = { ...req.headers };
    delete headers.host;

    let dataToSend = (req.method === 'POST' && req.is('application/x-www-form-urlencoded')) 
                      ? qs.stringify(req.body) 
                      : req.body;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: dataToSend,
      responseType: 'text',
      transformResponse: [(data) => data],
    });

    // --- Notifikasi Hanya Saat successful: true ---
    if (req.method === 'POST' && req.originalUrl === '/transactions') {
      try {
        const jsonResponse = JSON.parse(response.data);

        if (jsonResponse.successful) { // hanya jika sukses
          const hash = jsonResponse.hash || 'N/A';
          const ledger = jsonResponse.ledger || 'N/A';
          const memo = jsonResponse.memo || 'N/A';
          const createdAt = jsonResponse.created_at || new Date().toISOString();

          const successMessage = `*Transaksi Baru Berhasil* ✅\n\n` +
                                 `*Hash:* [${hash}](https://blockexplorer.minepi.com/mainnet/transactions/${hash})\n` +
                                 `*Ledger:* \`${ledger}\`\n` +
                                 `*Memo:* \`${memo}\`\n` +
                                 `*Timestamp:* \`${createdAt}\``;

          sendTelegramNotification(successMessage)
            .catch(err => console.error('[TELEGRAM] Error kirim hasil:', err.message));

        } else {
          console.log('[PROXY] Transaksi gagal (successful=false), Telegram dilewati.');
        }
      } catch (e) {
        console.error('[PROXY] Gagal mem-parsing JSON:', e.message);
      }
    }

    // --- Rewrite URL di JSON ---
    let responseBody = response.data;
    const contentType = response.headers['content-type'];
    if (responseBody && contentType && contentType.includes('application/json')) {
      const targetRegex = new RegExp(TARGET_NODE, 'g');
      responseBody = responseBody.replace(targetRegex, proxyBaseUrl);
      console.log(`[PROXY] Menulis ulang URL di respons JSON.`);
    }

    Object.keys(response.headers).forEach((key) => {
      res.setHeader(key, response.headers[key]);
    });

    res.status(response.status).send(responseBody);

  } catch (err) {
    if (err.response) {
      console.error(`[PROXY ERROR] Target server merespons status ${err.response.status}:`, err.response.data);
      res.status(err.response.status).send(err.response.data);
    } else if (err.request) {
      console.error(`[PROXY ERROR] Tidak bisa terhubung ke ${targetUrl}:`, err.message);
      res.status(502).send({ error: 'Bad Gateway', message: `Tidak dapat terhubung ke server target di ${TARGET_NODE}` });
    } else {
      console.error('[PROXY ERROR] Kesalahan internal:', err.message);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Reverse proxy berjalan di http://localhost:${PORT}`);
  console.log(`Meneruskan permintaan ke: ${TARGET_NODE}`);
});

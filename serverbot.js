const express = require('express');
const axios =require('axios');
const cors = require('cors');
const qs = require('qs');

const app = express();

// --- Konfigurasi ---
const PORT = 31401; // Port tempat proxy ini berjalan
const TARGET_NODE = 'http://221.144.51.60:31401'; // Alamat server Horizon yang dituju

// --- Konfigurasi Telegram ---
// PERHATIAN: Anda sudah memasang token dan ID Anda di sini.
// Sangat disarankan untuk mencabut token ini dan menggunakan yang baru dari @BotFather.
const TELEGRAM_BOT_TOKEN = '7533580803:AAHzOk1fjnfwnwYwB-Gz63S-mYo1F5WoFk0';
const TELEGRAM_CHAT_ID = '7890743177';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;


// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: true })); // Untuk menerima form data (x-www-form-urlencoded)
app.use(express.json()); // Untuk menerima JSON dari client

// --- Fungsi untuk mengirim notifikasi ke Telegram secara asinkron ---
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[TELEGRAM] Token atau Chat ID belum dikonfigurasi. Notifikasi dilewati.');
    return;
  }

  try {
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2',
    };
    
    await axios.post(TELEGRAM_API_URL, payload);
    console.log('[TELEGRAM] Notifikasi berhasil dikirim.');

  } catch (error) {
    console.error('[TELEGRAM ERROR] Gagal mengirim notifikasi:', error.response ? error.response.data : error.message);
  }
}

// --- Logic Reverse Proxy Utama ---
app.use(async (req, res) => {
  const targetUrl = TARGET_NODE + req.originalUrl;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;

  console.log(`[PROXY] Meneruskan ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  // --- Bagian Monitoring Transaksi ---
  if (req.method === 'POST' && req.originalUrl === '/transactions') {
    const transactionXDR = req.body.tx || 'Tidak ada XDR';
    
    const notificationMessage = `*Transaksi Baru Diterima* 🚀\n\n` +
                              `*Metode:* \`${req.method}\`\n` +
                              `*Endpoint:* \`${req.originalUrl}\`\n` +
                              `*Timestamp:* \`${new Date().toISOString()}\`\n\n` +
                              `Meneruskan ke Horizon Node\\.\\.\\.`;

    sendTelegramNotification(notificationMessage)
      .catch(err => console.error('[TELEGRAM] Error tidak tertangani:', err.message));
  }

  try {
    const headers = { ...req.headers };
    delete headers.host;

    let dataToSend;
    if (req.method === 'POST' && req.is('application/x-www-form-urlencoded')) {
      dataToSend = qs.stringify(req.body); 
    } else {
      dataToSend = req.body;
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: dataToSend,
      responseType: 'text',
      transformResponse: [(data) => data],
    });

    // --- Notifikasi Hasil Transaksi ---
    if (req.method === 'POST' && req.originalUrl === '/transactions') {
        let resultMessage = '';
        let statusEmoji = '';

        if (response.status >= 200 && response.status < 300) {
            statusEmoji = '✅ *Berhasil*';
            try {
                const jsonResponse = JSON.parse(response.data);
                resultMessage = `*Hash:* \`${jsonResponse.hash}\`\n*Ledger:* \`${jsonResponse.ledger}\``;
            } catch (e) {
                resultMessage = `Gagal mem\\-parsing respons JSON\\.`;
            }
        } else {
            statusEmoji = '❌ *Gagal*';
            resultMessage = `*Status:* \`${response.status}\`\n*Detail:* \`\`\`\n${response.data}\n\`\`\``;
        }

        const finalNotification = `${statusEmoji}\n\n${resultMessage}`;
        
        sendTelegramNotification(finalNotification)
            .catch(err => console.error('[TELEGRAM] Error tidak tertangani saat kirim hasil:', err.message));
    }
    
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
      console.error(`[PROXY ERROR] Target server merespons dengan status ${err.response.status}:`, err.response.data);
      
      if (req.method === 'POST' && req.originalUrl === '/transactions') {
        const errorNotification = `❌ *Gagal* saat meneruskan ke Horizon\n\n`+
                                  `*Status:* \`${err.response.status}\`\n`+
                                  `*Pesan:* \`\`\`\n${JSON.stringify(err.response.data, null, 2)}\n\`\`\``;
        sendTelegramNotification(errorNotification)
          .catch(e => console.error('[TELEGRAM] Error tidak tertangani saat kirim error:', e.message));
      }
      
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

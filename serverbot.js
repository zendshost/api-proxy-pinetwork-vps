const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');

const app = express();

// --- Konfigurasi ---
const PORT = 31401; // Port tempat proxy ini berjalan
const TARGET_NODE = 'http://203.236.58.84:31401'; // Alamat server Horizon yang dituju

// --- BARU: Konfigurasi Telegram ---
// Ganti dengan token bot Anda dari @BotFather
const TELEGRAM_BOT_TOKEN = '7533580803:AAHzOk1fjnfwnwYwB-Gz63S-mYo1F5WoFk0';
// Ganti dengan Chat ID Anda (bisa berupa ID user atau ID grup)
const TELEGRAM_CHAT_ID = '7890743177';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;


// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: true })); // Untuk menerima form data (x-www-form-urlencoded)
app.use(express.json()); // Untuk menerima JSON dari client

// --- BARU: Fungsi untuk mengirim notifikasi ke Telegram secara asinkron ---
async function sendTelegramNotification(message) {
  // Hanya kirim jika token dan chat ID sudah diisi
  if (TELEGRAM_BOT_TOKEN === '7533580803:AAHzOk1fjnfwnwYwB-Gz63S-mYo1F5WoFk0' || TELEGRAM_CHAT_ID === '7890743177') {
    console.warn('[TELEGRAM] Token atau Chat ID belum dikonfigurasi. Notifikasi dilewati.');
    return;
  }

  try {
    // Menggunakan MarkdownV2 untuk formatting teks
    // https://core.telegram.org/bots/api#markdownv2-style
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2',
    };
    
    // Kirim request ke API Telegram
    await axios.post(TELEGRAM_API_URL, payload);
    console.log('[TELEGRAM] Notifikasi berhasil dikirim.');

  } catch (error) {
    // Tangani jika ada error saat mengirim ke Telegram, tapi JANGAN sampai menghentikan aplikasi utama
    console.error('[TELEGRAM ERROR] Gagal mengirim notifikasi:', error.response ? error.response.data : error.message);
  }
}

// --- Logic Reverse Proxy Utama ---
app.use(async (req, res) => {
  const targetUrl = TARGET_NODE + req.originalUrl;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;

  console.log(`[PROXY] Meneruskan ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  // --- BARU: Bagian Monitoring Transaksi ---
  // Kita hanya monitor request untuk submit transaksi (POST ke /transactions)
  if (req.method === 'POST' && req.originalUrl === '/transactions') {
    // Ambil data transaksi (XDR) dari body request
    const transactionXDR = req.body.tx || 'Tidak ada XDR';
    
    // Buat pesan notifikasi awal
    const notificationMessage = `*Transaksi Baru Diterima* 🚀\n\n` +
                              `*Metode:* \`${req.method}\`\n` +
                              `*Endpoint:* \`${req.originalUrl}\`\n` +
                              `*Timestamp:* \`${new Date().toISOString()}\`\n\n` +
                              `Meneruskan ke Horizon Node\\.\\.\\.`;

    // Kirim notifikasi tanpa menunggu (fire-and-forget)
    // Ini adalah bagian terpenting: kita tidak menggunakan 'await' di sini.
    // Kita juga menambahkan .catch() agar jika ada error, aplikasi tidak crash.
    sendTelegramNotification(notificationMessage)
      .catch(err => console.error('[TELEGRAM] Error tidak tertangani:', err.message));
  }
  // --- Akhir Bagian Monitoring ---

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

    // --- BARU: Notifikasi Hasil Transaksi ---
    if (req.method === 'POST' && req.originalUrl === '/transactions') {
        let resultMessage = '';
        let statusEmoji = '';

        if (response.status >= 200 && response.status < 300) {
            statusEmoji = '✅ *Berhasil*';
            try {
                const jsonResponse = JSON.parse(response.data);
                resultMessage = `*Hash:* \`${jsonResponse.hash}\`\n*Ledger:* \`${jsonResponse.ledger}\``;
            } catch (e) {
                resultMessage = `Gagal mem-parsing respons JSON\\.`;
            }
        } else {
            statusEmoji = '❌ *Gagal*';
            resultMessage = `*Status:* \`${response.status}\`\n*Detail:* \`\`\`\n${response.data}\n\`\`\``;
        }

        const finalNotification = `${statusEmoji}\n\n${resultMessage}`;

        // Kirim notifikasi hasil juga secara fire-and-forget
        sendTelegramNotification(finalNotification)
            .catch(err => console.error('[TELEGRAM] Error tidak tertangani saat kirim hasil:', err.message));
    }
    // --- Akhir Notifikasi Hasil ---

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
    // ... (bagian error handling tetap sama) ...
    if (err.response) {
      console.error(`[PROXY ERROR] Target server merespons dengan status ${err.response.status}:`, err.response.data);
      
      // --- BARU: Notifikasi Error dari Target ---
      if (req.method === 'POST' && req.originalUrl === '/transactions') {
        const errorNotification = `❌ *Gagal* saat meneruskan ke Horizon\n\n`+
                                  `*Status:* \`${err.response.status}\`\n`+
                                  `*Pesan:* \`\`\`\n${err.response.data}\n\`\`\``;
        sendTelegramNotification(errorNotification)
          .catch(e => console.error('[TELEGRAM] Error tidak tertangani saat kirim error:', e.message));
      }
      // --- Akhir Notifikasi Error ---
      
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

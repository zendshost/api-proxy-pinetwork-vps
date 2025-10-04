const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const basicAuth = require('express-basic-auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 31401;
const TARGET_NODE = 'http://81.240.60.124:31401';
const TELEGRAM_BOT_TOKEN = '7533580803:AAHzOk1fjnfwnwYwB-Gz63S-mYo1F5WoFk0';
const TELEGRAM_CHAT_ID = '7890743177';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const LOG_FILE = path.join(__dirname, 'transactions.json');

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/admin', basicAuth({
  users: { 'admin': 'password123' },
  challenge: true,
}));

// Telegram notification
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await axios.post(TELEGRAM_API_URL, { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.error('[TELEGRAM ERROR]', err.response ? err.response.data : err.message);
  }
}

// Transaction log helpers
function saveTransactionLog(txData) {
  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { logs = []; }
  }
  logs.unshift(txData);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  io.emit('newTx', txData); // Kirim ke semua admin panel real-time
}

function deleteTransactionLog(hash) {
  if (!fs.existsSync(LOG_FILE)) return;
  let logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  logs = logs.filter(tx => tx.hash !== hash);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  io.emit('deleteTx', hash);
}

function clearTransactionLog() {
  fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
  io.emit('clearAll');
}

// Admin Panel
app.get('/admin', (req, res) => {
  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { logs = []; }
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Admin Panel - Real-Time</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css">
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="/socket.io/socket.io.js"></script>
  </head>
  <body class="bg-gray-900 text-gray-100">
    <div class="container mx-auto py-6">
      <h2 class="text-3xl font-bold mb-6 text-center">Admin Panel Transaksi Real-Time</h2>
      <div class="flex justify-end mb-4">
        <button id="clearAll" class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded">Hapus Semua</button>
      </div>
      <div class="overflow-x-auto">
        <table id="txTable" class="display stripe hover w-full text-gray-900 bg-gray-100">
          <thead>
            <tr class="bg-gray-800 text-gray-100">
              <th>Hash</th>
              <th>Memo</th>
              <th>Source</th>
              <th>Ledger</th>
              <th>Fee</th>
              <th>Waktu</th>
              <th>Berhasil</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(tx => {
              const statusClass = tx.successful ? 'text-green-500' : 'text-red-500';
              const statusText = tx.successful ? '✅' : '❌';
              return `<tr id="tx-${tx.hash}">
                <td><a href="https://blockexplorer.minepi.com/mainnet/transactions/${tx.hash}" target="_blank" class="underline text-blue-600">${tx.hash}</a></td>
                <td>${tx.memo || '-'}</td>
                <td>${tx.source_account || '-'}</td>
                <td>${tx.ledger || '-'}</td>
                <td>${tx.fee_charged || '0'}</td>
                <td>${tx.created_at || '-'}</td>
                <td class="${statusClass} font-bold">${statusText}</td>
                <td><button class="deleteBtn bg-red-600 hover:bg-red-500 px-2 py-1 rounded" data-hash="${tx.hash}">Hapus</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <script>
      const socket = io();
      $(document).ready(function() {
        const table = $('#txTable').DataTable({ pageLength: 10, lengthMenu: [5,10,20,50], order:[[5,'desc']] });

        // Hapus satu transaksi
        $('#txTable').on('click', '.deleteBtn', function(){
          const hash = $(this).data('hash');
          if(confirm('Yakin ingin hapus transaksi ini?')){
            window.location.href='/admin/delete/' + hash;
          }
        });

        // Hapus semua transaksi
        $('#clearAll').click(function(){
          if(confirm('Yakin ingin hapus semua transaksi?')){
            window.location.href='/admin/clear';
          }
        });

        // Socket.io - Tambah transaksi baru real-time
        socket.on('newTx', tx => {
          const statusClass = tx.successful ? 'text-green-500' : 'text-red-500';
          const statusText = tx.successful ? '✅' : '❌';
          const rowNode = table.row.add([
            \`<a href="https://blockexplorer.minepi.com/mainnet/transactions/\${tx.hash}" target="_blank" class="underline text-blue-600">\${tx.hash}</a>\`,
            tx.memo || '-',
            tx.source_account || '-',
            tx.ledger || '-',
            tx.fee_charged || '0',
            tx.created_at || '-',
            \`<span class="\${statusClass} font-bold">\${statusText}</span>\`,
            \`<button class="deleteBtn bg-red-600 hover:bg-red-500 px-2 py-1 rounded" data-hash="\${tx.hash}">Hapus</button>\`
          ]).draw().node();
          $(rowNode).attr('id', 'tx-' + tx.hash);
        });

        socket.on('deleteTx', hash => {
          table.row($('#tx-' + hash)).remove().draw();
        });

        socket.on('clearAll', () => {
          table.clear().draw();
        });
      });
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// Hapus transaksi
app.get('/admin/delete/:hash', (req, res) => {
  deleteTransactionLog(req.params.hash);
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
  try {
    const headers = { ...req.headers };
    delete headers.host;
    let dataToSend = req.body;
    if(req.method==='POST' && req.is('application/x-www-form-urlencoded')) dataToSend = qs.stringify(req.body);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: dataToSend,
      responseType: 'text',
      transformResponse: [data=>data]
    });

    if(req.method==='POST' && req.originalUrl==='/transactions'){
      try{
        const jsonResponse = JSON.parse(response.data);
        saveTransactionLog(jsonResponse);
        if(jsonResponse.successful){
          const msg = `✅ Berhasil\n\nTransaksi Baru\nHash: [${jsonResponse.hash}](https://blockexplorer.minepi.com/mainnet/transactions/${jsonResponse.hash})\nLedger: ${jsonResponse.ledger}\nMemo: ${jsonResponse.memo||'-'}\nSource: ${jsonResponse.source_account}\nFee: ${jsonResponse.fee_charged}\nWaktu: ${jsonResponse.created_at}`;
          sendTelegramNotification(msg);
        }
      }catch(e){ console.error('Gagal parsing transaksi:',e.message); }
    }

    let responseBody = response.data;
    const contentType = response.headers['content-type'];
    if(responseBody && contentType && contentType.includes('application/json')){
      const targetRegex = new RegExp(TARGET_NODE, 'g');
      responseBody = responseBody.replace(targetRegex, proxyBaseUrl);
    }

    Object.keys(response.headers).forEach(k=>res.setHeader(k,response.headers[k]));
    res.status(response.status).send(responseBody);
  } catch(err){
    if(err.response) res.status(err.response.status).send(err.response.data);
    else if(err.request) res.status(502).send({error:'Bad Gateway'});
    else res.status(500).send({error:'Internal Server Error'});
  }
});

server.listen(PORT, () => {
  console.log(`Reverse proxy berjalan di http://localhost:${PORT}`);
  console.log(`Admin Panel real-time di http://localhost:${PORT}/admin`);
});

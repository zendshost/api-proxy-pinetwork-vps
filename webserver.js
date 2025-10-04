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

// File konfigurasi & log
const CONFIG_FILE = path.join(__dirname, 'config.json');
const LOG_FILE = path.join(__dirname, 'transactions.json');

// Load / Save config
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')); } catch { return {}; }
  }
  return {};
}
function saveConfig(newConfig){
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig,null,2));
}

let config = loadConfig();
let TARGET_NODE = config.TARGET_NODE || 'http://81.240.60.124:31401';
let TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN || '';
let TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID || '';

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.use('/admin', basicAuth({ users: { 'admin':'password123' }, challenge:true }));

// Telegram notification
async function sendTelegramNotification(message){
  if(!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try{
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2'
    });
  } catch(err){
    console.error('[TELEGRAM ERROR]', err.response ? err.response.data : err.message);
  }
}

// Transaction log helpers
function saveTransactionLog(txData){
  let logs = [];
  if(fs.existsSync(LOG_FILE)){
    try{ logs = JSON.parse(fs.readFileSync(LOG_FILE,'utf8')); } catch{}
  }
  logs.unshift(txData);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs,null,2));
  io.emit('newTx', txData);
}

function deleteTransactionLog(hash){
  if(!fs.existsSync(LOG_FILE)) return;
  let logs = JSON.parse(fs.readFileSync(LOG_FILE,'utf8'));
  logs = logs.filter(tx => tx.hash !== hash);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs,null,2));
  io.emit('deleteTx', hash);
}

function clearTransactionLog(){
  fs.writeFileSync(LOG_FILE, JSON.stringify([],null,2));
  io.emit('clearAll');
}

// Admin Panel
app.get('/admin', (req,res)=>{
  let logs = [];
  if(fs.existsSync(LOG_FILE)){
    try{ logs = JSON.parse(fs.readFileSync(LOG_FILE,'utf8')); } catch{}
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Admin Panel - Pi Network Proxy</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css">
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="/socket.io/socket.io.js"></script>
  </head>
  <body class="bg-gray-900 text-gray-100">
    <div class="container mx-auto py-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">Admin Panel Transaksi Real-Time</h2>
        <a href="/logout" class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded">Keluar</a>
      </div>

      <!-- Pengaturan -->
      <div class="mb-6 p-4 bg-gray-800 rounded">
        <h3 class="text-xl font-bold mb-2">Pengaturan</h3>
        <form id="configForm" class="space-y-2">
          <div>
            <label class="block mb-1">TARGET_NODE:</label>
            <input type="text" name="TARGET_NODE" value="${TARGET_NODE}" class="w-full p-2 rounded text-gray-900">
          </div>
          <div>
            <label class="block mb-1">TELEGRAM_BOT_TOKEN:</label>
            <input type="text" name="TELEGRAM_BOT_TOKEN" value="${TELEGRAM_BOT_TOKEN}" class="w-full p-2 rounded text-gray-900">
          </div>
          <div>
            <label class="block mb-1">TELEGRAM_CHAT_ID:</label>
            <input type="text" name="TELEGRAM_CHAT_ID" value="${TELEGRAM_CHAT_ID}" class="w-full p-2 rounded text-gray-900">
          </div>
          <button type="submit" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded">Simpan</button>
        </form>
        <div id="configMsg" class="mt-2 text-green-400"></div>
      </div>

      <div class="flex justify-end mb-4">
        <button id="clearAll" class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded">Hapus Semua</button>
      </div>

      <div class="overflow-x-auto">
        <table id="txTable" class="display stripe hover w-full text-gray-900 bg-gray-100">
          <thead>
            <tr class="bg-gray-800 text-gray-100">
              <th>Hash</th><th>Memo</th><th>Source</th><th>Ledger</th>
              <th>Fee</th><th>Waktu</th><th>Berhasil</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(tx=>{
              const statusClass = tx.successful?'text-green-500':'text-red-500';
              const statusText = tx.successful?'✅':'❌';
              return `<tr id="tx-${tx.hash}">
                <td><a href="https://blockexplorer.minepi.com/mainnet/transactions/${tx.hash}" target="_blank" class="underline text-blue-600">${tx.hash}</a></td>
                <td>${tx.memo||'-'}</td>
                <td>${tx.source_account||'-'}</td>
                <td>${tx.ledger||'-'}</td>
                <td>${tx.fee_charged||'0'}</td>
                <td>${tx.created_at||'-'}</td>
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
      $(document).ready(function(){
        const table = $('#txTable').DataTable({ pageLength:10,lengthMenu:[5,10,20,50], order:[[5,'desc']] });

        $('#txTable').on('click','.deleteBtn',function(){
          const hash = $(this).data('hash');
          if(confirm('Yakin ingin hapus transaksi ini?')) window.location.href='/admin/delete/'+hash;
        });

        $('#clearAll').click(function(){
          if(confirm('Yakin ingin hapus semua transaksi?')) window.location.href='/admin/clear';
        });

        socket.on('newTx', tx=>{
          const statusClass = tx.successful?'text-green-500':'text-red-500';
          const statusText = tx.successful?'✅':'❌';
          const rowNode = table.row.add([
            \`<a href="https://blockexplorer.minepi.com/mainnet/transactions/\${tx.hash}" target="_blank" class="underline text-blue-600">\${tx.hash}</a>\`,
            tx.memo||'-', tx.source_account||'-', tx.ledger||'-',
            tx.fee_charged||'0', tx.created_at||'-',
            \`<span class="\${statusClass} font-bold">\${statusText}</span>\`,
            \`<button class="deleteBtn bg-red-600 hover:bg-red-500 px-2 py-1 rounded" data-hash="\${tx.hash}">Hapus</button>\`
          ]).draw().node();
          $(rowNode).attr('id','tx-'+tx.hash);
        });

        socket.on('deleteTx', hash=>{ table.row($('#tx-'+hash)).remove().draw(); });
        socket.on('clearAll', ()=>{ table.clear().draw(); });

        $('#configForm').submit(function(e){
          e.preventDefault();
          $.post('/admin/config', $(this).serialize(), data=>{
            $('#configMsg').text(data.success?'Konfigurasi berhasil disimpan!':'Gagal menyimpan konfigurasi!');
          });
        });
      });
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// Update config via POST
app.post('/admin/config',(req,res)=>{
  const { TARGET_NODE: t, TELEGRAM_BOT_TOKEN: b, TELEGRAM_CHAT_ID: c } = req.body;
  config.TARGET_NODE = t || config.TARGET_NODE;
  config.TELEGRAM_BOT_TOKEN = b || config.TELEGRAM_BOT_TOKEN;
  config.TELEGRAM_CHAT_ID = c || config.TELEGRAM_CHAT_ID;
  saveConfig(config);
  TARGET_NODE = config.TARGET_NODE;
  TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN;
  TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID;
  res.json({ success:true });
});

// Delete single tx
app.get('/admin/delete/:hash',(req,res)=>{
  deleteTransactionLog(req.params.hash);
  res.redirect('/admin');
});

// Clear all
app.get('/admin/clear',(req,res)=>{
  clearTransactionLog();
  res.redirect('/admin');
});

// Logout
app.get('/logout',(req,res)=>{
  res.set('WWW-Authenticate','Basic realm="Admin Panel"');
  return res.status(401).send('Keluar dari panel. Silakan login lagi.');
});

// --- Proxy utama ---
app.use(async(req,res)=>{
  const targetUrl = TARGET_NODE + req.originalUrl;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;
  console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  // Monitoring transaksi POST /transactions
  let transactionXDR = req.body.tx || null;
  try{
    const headers = {...req.headers};
    delete headers.host;

    let dataToSend;
    if(req.method==='POST' && req.is('application/x-www-form-urlencoded')){
      dataToSend = qs.stringify(req.body);
    } else { dataToSend = req.body; }

    const response = await axios({
      method:req.method,
      url:targetUrl,
      headers,
      data:dataToSend,
      responseType:'text',
      transformResponse:[data=>data]
    });

    // Parse JSON jika POST /transactions
    let parsedTx = null;
    if(req.method==='POST' && req.originalUrl==='/transactions'){
      try{ parsedTx = JSON.parse(response.data); } catch{}
      if(parsedTx){
        const txData = {
          hash: parsedTx.hash,
          ledger: parsedTx.ledger,
          memo: parsedTx.memo,
          source_account: parsedTx.source_account,
          fee_charged: parsedTx.fee_charged,
          created_at: parsedTx.created_at,
          successful: parsedTx.successful
        };
        saveTransactionLog(txData);

        // Kirim ke Telegram hanya jika berhasil
        if(parsedTx.successful){
          const msg = `✅ Berhasil\\n\\nTransaksi Baru\\nHash: [${parsedTx.hash}](https://blockexplorer.minepi.com/mainnet/transactions/${parsedTx.hash})\\nLedger: ${parsedTx.ledger}\\nMemo: ${parsedTx.memo}\\nSource: ${parsedTx.source_account}\\nFee: ${parsedTx.fee_charged}\\nWaktu: ${parsedTx.created_at}`;
          sendTelegramNotification(msg);
        }
      }
    }

    // Rewrite response JSON TARGET_NODE -> proxy URL
    let responseBody = response.data;
    const contentType = response.headers['content-type'];
    if(responseBody && contentType && contentType.includes('application/json')){
      const targetRegex = new RegExp(TARGET_NODE,'g');
      responseBody = responseBody.replace(targetRegex, proxyBaseUrl);
    }

    Object.keys(response.headers).forEach(key=>res.setHeader(key,response.headers[key]));
    res.status(response.status).send(responseBody);

  } catch(err){
    if(err.response){
      console.error(`[PROXY ERROR] Status ${err.response.status}:`, err.response.data);
      res.status(err.response.status).send(err.response.data);
    } else if(err.request){
      console.error(`[PROXY ERROR] Tidak bisa terhubung ke ${targetUrl}:`, err.message);
      res.status(502).send({error:'Bad Gateway'});
    } else {
      console.error('[PROXY ERROR] Internal:', err.message);
      res.status(500).send({error:'Internal Server Error'});
    }
  }
});

server.listen(PORT, ()=>{
  console.log(`Proxy & Admin Panel berjalan di http://localhost:${PORT}`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin`);
});

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Inisialisasi aplikasi Express
const app = express();

// Definisikan port di mana server proxy Anda akan berjalan
const PORT = 31401;

// Definisikan URL API target yang ingin Anda teruskan permintaannya
const API_TARGET_URL = 'http://14.241.120.142:31401';

// Konfigurasi untuk proxy
const proxyOptions = {
    target: API_TARGET_URL, // Alamat server tujuan
    changeOrigin: true,     // Ini penting! Mengubah header 'Host' agar sesuai dengan target.
                            // Diperlukan agar server tujuan menerima permintaan.
    
    // Opsi tambahan jika diperlukan (biasanya tidak perlu diubah)
    onProxyReq: (proxyReq, req, res) => {
        // Anda bisa memodifikasi request sebelum dikirim ke target di sini jika perlu
        console.log(`[Proxy] Meneruskan request: ${req.method} ${req.originalUrl} -> ${API_TARGET_URL}${req.originalUrl}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        // Anda bisa memodifikasi response dari target sebelum dikirim kembali ke client
        console.log(`[Proxy] Menerima response dengan status: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        // Menangani error jika server target tidak bisa dihubungi
        console.error('Proxy error:', err);
        res.status(500).send('Proxy error: Tidak dapat terhubung ke server tujuan.');
    }
};

// Gunakan middleware proxy untuk SEMUA rute ('/')
// Artinya, setiap request yang masuk ke server Anda (misal: /login, /getUsers, dll)
// akan diteruskan ke server target.
app.use('/', createProxyMiddleware(proxyOptions));

// Jalankan server pada port yang telah ditentukan
app.listen(PORT, () => {
    console.log(`Server Proxy berjalan di http://localhost:${PORT}`);
    console.log(`Semua permintaan akan diteruskan ke ${API_TARGET_URL}`);
});

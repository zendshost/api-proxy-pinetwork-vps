# Pi Network API Proxy & Notifier

![Versi Node.js](https://img.shields.io/badge/node-%3E%3D16.x-brightgreen.svg)
![Lisensi](https://img.shields.io/badge/license-MIT-blue.svg)
![Status Proyek](https://img.shields.io/badge/status-aktif-success.svg)
![Dibuat oleh](https://img.shields.io/badge/author-zendshost-_-%237289DA?logo=telegram)

Proxy API canggih untuk Pi Network Node Anda yang dirancang untuk berjalan di VPS. Proyek ini tidak hanya meneruskan permintaan ke node Pi Anda, tetapi juga menyediakan notifikasi Telegram real-time untuk transaksi yang berhasil dan dilengkapi dengan panel admin web untuk memantau serta mengelola semua transaksi.

## ✨ Fitur Unggulan

-   **🚀 Reverse Proxy:** Meneruskan semua permintaan dari aplikasi Anda ke Pi Network Node yang Anda tentukan.
-   **🔗 URL Rewriting:** Secara otomatis menulis ulang URL node target di dalam respons JSON, membuatnya transparan bagi klien.
-   **🔔 Notifikasi Telegram:** Dapatkan pemberitahuan instan di grup atau channel Telegram Anda setiap kali ada transaksi yang berhasil.
-   **📊 Panel Admin Web (Versi Lengkap):**
    -   Antarmuka web untuk memantau semua log transaksi (berhasil dan gagal) secara real-time.
    -   Login dilindungi dengan Basic Authentication.
    -   Kelola log transaksi (hapus satu per satu atau semua).
    -   Konfigurasi URL Node Target dan detail Telegram langsung dari antarmuka web.
-   **💾 Pencatatan Transaksi (Versi Lengkap):** Semua upaya transaksi (termasuk yang gagal) dicatat dalam file `transactions.json` untuk audit dan debugging.
-   **🔌 Real-time Updates:** Panel admin menggunakan Socket.IO untuk menampilkan transaksi baru tanpa perlu me-refresh halaman.
-   **💡 Dua Versi:** Pilih antara versi `server.js` (simpel dan ringan) atau `webserver.js` (lengkap dengan panel admin) sesuai kebutuhan Anda.

## 🗂️ Daftar Isi

-   [Pilih Versi Anda](#-pilih-versi-anda)
-   [Prasyarat](#-prasyarat)
-   [Instalasi](#-instalasi)
-   [Konfigurasi & Menjalankan](#-konfigurasi--menjalankan)
    -   [Opsi 1: Versi Simpel (`server.js`)](#opsi-1-versi-simpel-serverjs)
    -   [Opsi 2: Versi Lengkap dengan Admin Panel (`webserver.js`)](#opsi-2-versi-lengkap-dengan-admin-panel-webserverjs)
-   [Cara Penggunaan](#-cara-penggunaan)
-   [Struktur Proyek](#-struktur-proyek)
-   [Kontak & Dukungan](#-kontak--dukungan)
-   [Lisensi](#-lisensi)

## ⚖️ Pilih Versi Anda

Proyek ini menyediakan dua file server yang berbeda. Pilih yang paling sesuai dengan kebutuhan Anda.

| Fitur                   | `server.js` (Simpel)                               | `webserver.js` (Lengkap)                                 |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| **Fungsi Utama**        | Reverse Proxy                                      | Reverse Proxy + Admin Panel                              |
| **Notifikasi Telegram** | ✅ (Hanya untuk transaksi berhasil)                | ✅ (Hanya untuk transaksi berhasil)                      |
| **Panel Admin Web**     | ❌                                                 | ✅ (Real-time, Auth, Manajemen Log)                      |
| **Log Transaksi**       | ❌ (Hanya di console)                              | ✅ (Disimpan di `transactions.json`)                     |
| **Konfigurasi**         | Manual (Edit file `.js`)                           | Mudah (Melalui Panel Admin)                              |
| **Ideal Untuk**         | Penggunaan cepat, sumber daya minimal, tanpa UI.   | Pemantauan lengkap, manajemen mudah, fitur lengkap.      |

**Rekomendasi:** Gunakan `webserver.js` untuk pengalaman terbaik dan kontrol penuh.

## 🛠️ Prasyarat

Sebelum memulai, pastikan Anda memiliki:

1.  **Server/VPS:** Sebuah Virtual Private Server (misalnya, dari DigitalOcean, Vultr, Contabo, dll.) yang menjalankan Linux (Ubuntu direkomendasikan).
2.  **Node.js:** Versi `16.x` atau yang lebih baru.
3.  **NPM** (biasanya terinstal bersama Node.js).
4.  **Git:** Untuk meng-clone repositori.
5.  **Akun Telegram:**
    -   **Bot Token:** Dapatkan dari [@BotFather](https://t.me/BotFather) di Telegram.
    -   **Chat ID:** ID unik dari grup atau pengguna yang akan menerima notifikasi. Dapatkan dari [@userinfobot](https://t.me/userinfobot).

## 🚀 Instalasi

Ikuti langkah-langkah ini di terminal VPS Anda:

1.  **Clone Repositori**
    ```bash
    git clone https://github.com/zendshost/api-proxy-pinetwork-vps.git
    ```

2.  **Masuk ke Direktori Proyek**
    ```bash
    cd api-proxy-pinetwork-vps
    ```

3.  **Instal Dependensi**
    Proyek ini menggunakan beberapa paket Node.js. Instal semuanya dengan perintah berikut:
    ```bash
    npm install
    ```

## ⚙️ Konfigurasi & Menjalankan

Pilih salah satu dari dua opsi di bawah ini.

---

### Opsi 1: Versi Simpel (`server.js`)

Versi ini ideal jika Anda hanya memerlukan fungsi proxy dan notifikasi dasar tanpa antarmuka web.

#### 1. Konfigurasi

Buka file `server.js` menggunakan editor teks (misalnya, `nano`):

```bash
nano server.js
```

Ubah nilai variabel di bagian atas file sesuai dengan kebutuhan Anda:

```javascript
// --- Konfigurasi ---
const PORT = 31401; // Port yang akan digunakan oleh proxy. Biarkan default jika tidak ada alasan khusus.
const TARGET_NODE = 'http://194.35.14:31401'; // GANTI DENGAN URL NODE PI ANDA

// --- Konfigurasi Telegram ---
const TELEGRAM_BOT_TOKEN = '7533580803:AAHzOcxxdffgrHiiorgcsfsfsffcs'; // GANTI DENGAN TOKEN BOT ANDA
const TELEGRAM_CHAT_ID = '7890743676'; // GANTI DENGAN CHAT ID ANDA
```

Simpan file dan keluar (di `nano`, tekan `CTRL+X`, lalu `Y`, lalu `Enter`).

#### 2. Menjalankan

Untuk menjalankan server, gunakan perintah:

```bash
node server.js
```

Anda akan melihat output seperti ini:
```
Reverse proxy berjalan di http://localhost:31401
Meneruskan permintaan ke: http://194.35.14:31401
```

> **Untuk Produksi:** Sangat disarankan untuk menjalankan aplikasi menggunakan process manager seperti **PM2**. Ini akan menjaga aplikasi tetap berjalan dan me-restart secara otomatis jika terjadi crash.
>
> ```bash
> # Instal PM2 secara global
> npm install pm2 -g
>
> # Jalankan server dengan PM2
> pm2 start server.js --name "pi-proxy-simple"
> ```

---

### Opsi 2: Versi Lengkap dengan Admin Panel (`webserver.js`)

Ini adalah versi yang direkomendasikan untuk kontrol dan pemantauan penuh.

#### 1. Konfigurasi Awal

Konfigurasi untuk versi ini sangat mudah dan dapat dilakukan melalui antarmuka web.

Pertama, jalankan server sekali untuk menghasilkan file konfigurasi `config.json`.

```bash
node webserver.js
```

Biarkan berjalan, lalu lanjutkan ke langkah berikutnya.

#### 2. Akses Panel Admin

Buka browser web Anda dan kunjungi:

`http://<IP_VPS_ANDA>:31401/admin`

Anda akan diminta untuk memasukkan username dan password.

-   **Username Default:** `admin`
-   **Password Default:** `password123`

> **⚠️ PERINGATAN KEAMANAN PENTING!**
> Password default sangat tidak aman. Segera ubah dengan mengedit file `webserver.js`:
>
> ```bash
> nano webserver.js
> ```
>
> Cari baris ini (sekitar baris 30):
> ```javascript
> app.use('/admin', basicAuth({ users: { 'admin':'password123' }, challenge:true }));
> ```
> Ubah `'password123'` menjadi password yang kuat dan aman. Setelah itu, restart aplikasi.

#### 3. Konfigurasi Melalui Panel Admin

Setelah login, Anda akan melihat bagian **"Pengaturan"**. Di sini Anda dapat:

-   **TARGET_NODE:** Masukkan URL lengkap Pi Network Node Anda (contoh: `http://81.240.60.124:31401`).
-   **TELEGRAM_BOT_TOKEN:** Masukkan token bot Telegram Anda.
-   **TELEGRAM_CHAT_ID:** Masukkan Chat ID tujuan notifikasi.

Klik **"Simpan"**. Pengaturan akan disimpan di file `config.json` dan langsung diterapkan tanpa perlu me-restart server.

#### 4. Menjalankan untuk Produksi

Setelah konfigurasi selesai, hentikan proses yang berjalan (tekan `CTRL+C`) dan jalankan kembali menggunakan **PM2**.

```bash
# Instal PM2 jika belum
npm install pm2 -g

# Jalankan server dengan PM2
pm2 start webserver.js --name "pi-proxy-admin"
```

## 📝 Cara Penggunaan

Setelah proxy Anda berjalan (baik versi simpel maupun lengkap), arahkan aplikasi atau dompet Pi Anda untuk menggunakan URL proxy Anda, bukan URL node asli.

-   **URL Proxy Anda:** `http://<IP_VPS_ANDA>:31401`

Semua permintaan ke URL ini akan diteruskan dengan aman ke node target Anda, dan setiap transaksi yang berhasil akan memicu notifikasi Telegram. Jika Anda menggunakan versi lengkap, semua transaksi akan muncul secara real-time di panel admin Anda.

## 📁 Struktur Proyek

```
.
├── server.js               # Versi proxy simpel dan ringan
├── webserver.js            # Versi proxy lengkap dengan panel admin
├── package.json            # Daftar dependensi proyek
├── package-lock.json       # Kunci versi dependensi
├── config.json             # (Dihasilkan oleh webserver.js) File konfigurasi
└── transactions.json       # (Dihasilkan oleh webserver.js) Log semua transaksi
```

## 📞 Kontak & Dukungan

Proyek ini dibuat dan dikelola oleh **zendshost**.

Jika Anda memiliki pertanyaan, saran, atau membutuhkan bantuan, jangan ragu untuk menghubungi melalui:

-   **Telegram:** [@zendshost](https://t.me/zendshost)

## 📜 Lisensi

Proyek ini dilisensikan di bawah **MIT License**. Lihat file `LICENSE` untuk detail lebih lanjut.

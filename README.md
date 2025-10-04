Instalasi
______________________________________________
Os Ubuntu
______________________________________________
apt update
______________________________________________
apt install npm
______________________________________________
git clone https://github.com/zendshost/api-proxy-pinetwork-vps.git
______________________________________________
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
______________________________________________
source ~/.bashrc
______________________________________________
nvm install --lts
______________________________________________
cd api-proxy-pinetwork-vps
______________________________________________
Langkah 3: Instalasi Library yang Dibutuhkan
Kita butuh dua library utama:
express: Kerangka kerja web untuk Node.js.
Jalankan perintah ini untuk menginstalnya:
______________________________________________
npm install express axios cors qs socket.io express-basic-auth datatables.net datatables.net-dt
______________________________________________
mkdir public
______________________________________________
npm install pm2 -g
______________________________________________
pm2 start webserver.js
______________________________________________
pm2 logs server.js
______________________________________________
Jika berhasil, akan muncul:
______________________________________________
Proxy & Admin Panel berjalan di http://localhost:31401
Admin Panel: http://localhost:31401/admin
______________________________________________
Akses admin panel

Buka browser: http://SERVER_IP:31401/admin

Login:

Username: admin

Password: password123

Di panel bisa:

Lihat riwayat transaksi realtime

Hapus 1 per 1 atau semua

Ubah TARGET_NODE / BOT_TOKEN / CHAT_ID
______________________________________________

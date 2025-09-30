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
cd api-proxy-pinetwork-vps
______________________________________________
Inisialisasi proyek Node.js. Perintah ini akan membuat file package.json.
______________________________________________
npm init -y
______________________________________________
Langkah 3: Instalasi Library yang Dibutuhkan
Kita butuh dua library utama:

express: Kerangka kerja web untuk Node.js.

http-proxy-middleware: Library yang akan melakukan semua pekerjaan "proxy" atau penerusan permintaan.

Jalankan perintah ini untuk menginstalnya:
______________________________________________
npm install express http-proxy-middleware
______________________________________________
npm install pm2 -g
______________________________________________
pm2 start server.js
______________________________________________
pm2 logs server.js
______________________________________________

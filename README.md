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
npm install express axios qs cors express-basic-auth socket.io
______________________________________________
npm install pm2 -g
______________________________________________
pm2 start server.js
______________________________________________
pm2 logs server.js
______________________________________________

#!/bin/bash
# Luminine CLI Termux Kurulum Betiği

echo "Luminine CLI yükleniyor..."
pkg update && pkg upgrade -y
pkg install git nodejs -y

if [ -d "luminine-cli" ]; then
    echo "Dizin zaten var, güncelleniyor..."
    cd luminine-cli
    git pull
else
    git clone https://github.com/zelasip/luminine-cli.git
    cd luminine-cli
fi

npm install
npm run build
echo "Kurulum tamamlandı! 'node dist/index.js' ile çalıştırabilirsiniz."

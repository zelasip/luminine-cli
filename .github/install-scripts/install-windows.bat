@echo off
REM Luminine CLI Windows Kurulum Betiği

echo Luminine CLI yukleniyor...
IF EXIST "luminine-cli" (
    echo Dizin zaten var, guncelleniyor...
    cd luminine-cli
    git pull
) ELSE (
    git clone https://github.com/zelasip/luminine-cli.git
    cd luminine-cli
)

call npm install
call npm run build
echo Kurulum tamamlandi! 'node dist/index.js' ile calistirabilirsiniz.
pause

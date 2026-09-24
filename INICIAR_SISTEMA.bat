@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo PONDE PESQUISAS - CONFIGURACAO LOCAL
 echo ==========================================
if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo Arquivo backend\.env criado. Edite-o com os dados do PostgreSQL.
)
cd backend
call npm install
call npx prisma generate
call npx prisma db push
call npx prisma db seed
start "API Ponde Pesquisas" cmd /k "npm start"
cd ..

echo.
echo Agora abra a pasta frontend no VS Code e use o Live Server na porta 5500.
echo Configure frontend\js\config.js para API_BASE_URL=http://localhost:3000
pause

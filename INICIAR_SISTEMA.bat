@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo PONDE PESQUISAS - CONFIGURACAO LOCAL
echo ==========================================
set "PRIMEIRA_CONFIGURACAO=0"
if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  set "PRIMEIRA_CONFIGURACAO=1"
  echo Arquivo backend\.env criado.
)

rem Cria chaves aleatorias locais se o arquivo ainda possuir valores de exemplo.
node -e "const fs=require('fs'),crypto=require('crypto'),p='backend/.env',marker='TROQUE_POR_UMA_CHAVE_SEGURA_ALEATORIA';let s=fs.readFileSync(p,'utf8');let changed=false;if(s.includes(marker)){s=s.replace(/^ADMIN_SETUP_KEY=.*$/m,'ADMIN_SETUP_KEY='+crypto.randomBytes(32).toString('hex'));changed=true}if(/^JWT_SECRET=.*troque-esta-chave.*$/mi.test(s)){s=s.replace(/^JWT_SECRET=.*$/mi,'JWT_SECRET='+crypto.randomBytes(48).toString('hex'));changed=true}if(changed)fs.writeFileSync(p,s);const m=s.match(/^ADMIN_SETUP_KEY=([^\r\n]+)/m);if(m)console.log('CHAVE ADMIN_SETUP_KEY para informar na primeira tela de cadastro:\n'+m[1].trim()+'\n');"

if "%PRIMEIRA_CONFIGURACAO%"=="1" (
  echo.
  echo O arquivo backend\.env sera aberto. Preencha DATABASE_URL e DIRECT_URL com os dados do PostgreSQL/Supabase.
  start "" notepad "backend\.env"
  echo Salve e feche o Bloco de Notas. Depois pressione uma tecla para continuar.
  pause >nul
)

cd backend
call npm install
if errorlevel 1 goto erro
call npx prisma generate
if errorlevel 1 goto erro
call npx prisma db push
if errorlevel 1 goto erro
start "API Ponde Pesquisas" cmd /k "npm start"
cd ..

echo.
echo API iniciada. No primeiro acesso, clique em Configurar primeira conta e informe a chave ADMIN_SETUP_KEY mostrada acima.
echo A conta sera damascenocaio311@gmail.com, com senha temporaria 1234 e troca obrigatoria.
echo Abra a pasta frontend no VS Code e use o Live Server na porta 5500.
echo O frontend usa http://localhost:3000 automaticamente quando aberto em localhost.
pause
goto fim

:erro
echo.
echo Houve um erro. Confira os dados em backend\.env e a conexao com o banco, e execute o arquivo novamente.
pause
:fim

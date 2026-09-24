const API = (window.APP_CONFIG?.API_BASE_URL || '').replace(/\/$/, '');
const META = 60;
const TOKEN_KEY = 'ponde_auth_token';
const USER_KEY = 'ponde_auth_user';
const BACKUP_DB_NAME = 'PondePesquisasBackup';
const BACKUP_DB_VERSION = 1;
const BACKUP_STORE = 'surveys';
let backupDbPromise = null;
let serverAvailable = true;
let currentUser = null;
let charts = {};
let serverCountCache = 0;
let sending = false;
let youngOptions = [];
let lastDashboardData = null;

const QUESTIONS = [
  { id:'p1', title:'1. Gentileza e disponibilidade na recepção?', options:[['MUITO_SATISFEITO','Muito Satisfeito'],['SATISFEITO','Satisfeito'],['INSATISFEITO','Insatisfeito'],['MUITO_INSATISFEITO','Muito Insatisfeito']] },
  { id:'p2', title:'2. Tratamento recebido pela Equipe de Saúde?', options:[['MUITO_SATISFEITO','Muito Satisfeito'],['SATISFEITO','Satisfeito'],['INSATISFEITO','Insatisfeito'],['MUITO_INSATISFEITO','Muito Insatisfeito']] },
  { id:'p3', title:'3. Qualidade dos serviços prestados no Multicentro?', options:[['MUITO_SATISFEITO','Muito Satisfeito'],['SATISFEITO','Satisfeito'],['INSATISFEITO','Insatisfeito'],['MUITO_INSATISFEITO','Muito Insatisfeito']] },
  { id:'p4', title:'4. Grau de satisfação com o Multicentro?', options:[['MUITO_SATISFEITO','Muito Satisfeito'],['SATISFEITO','Satisfeito'],['INSATISFEITO','Insatisfeito'],['MUITO_INSATISFEITO','Muito Insatisfeito']] },
  { id:'p5', title:'5. Você indicaria os serviços do Multicentro de Amaralina?', options:[['COM_CERTEZA','Com Certeza'],['SIM','Sim'],['NAO','Não'],['DE_JEITO_NENHUM','De jeito Nenhum']] }
];

const $ = (id) => document.getElementById(id);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const pendingKey = (date) => `ponde_pending_${currentUser?.id || 'anon'}_${date}`;
const fmtPct = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(value || 0) % 1 ? 1 : 0, maximumFractionDigits: 1 })}%`;
const formatDateBR = (value) => { if (!value) return ''; const [y,m,d] = value.split('-'); return `${d}/${m}/${y}`; };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

function toast(message, type='info') {
  const root = $('toast-root');
  const el = document.createElement('div');
  el.className = `toast rounded-xl border bg-white px-4 py-3 text-sm font-semibold shadow-lg ${type==='success'?'border-emerald-200 text-emerald-700':type==='error'?'border-rose-200 text-rose-700':'border-slate-200 text-slate-700'}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function api(path, options={}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na comunicação com o servidor.');
  return data;
}

function renderQuestions() {
  $('questions-container').innerHTML = QUESTIONS.map((q) => `
    <article class="question-card">
      <div class="question-title">${q.title}</div>
      <div class="option-grid">
        ${q.options.map(([value,label]) => `<div class="option"><input type="radio" id="${q.id}_${value}" name="${q.id}" value="${value}"><label for="${q.id}_${value}">${label}</label></div>`).join('')}
      </div>
    </article>
  `).join('');
  window.lucide?.createIcons?.();
}

function setScreen(loggedIn) {
  $('screen-login').classList.toggle('hidden', loggedIn);
  $('screen-app').classList.toggle('hidden', !loggedIn);
  if (!loggedIn) return;
  setTimeout(() => window.lucide?.createIcons?.(), 0);
}

function renderUserHeader() {
  $('user-name').textContent = currentUser.nome;
  $('user-role').textContent = { ADMIN:'Administrador', GESTAO:'Gestão', JOVEM:'Jovem Aprendiz' }[currentUser.role] || currentUser.role;
  $('user-avatar').textContent = currentUser.nome.trim().charAt(0).toUpperCase() || 'U';
}

function renderNav() {
  const items = [];
  if (currentUser.role !== 'JOVEM') items.push(['dashboard','layout-dashboard','Dashboard']);
  if (currentUser.role === 'JOVEM') {
    items.push(['pesquisa','clipboard-list','Coletar Pesquisa']);
    items.push(['backup','shield-check','Minhas Pesquisas']);
  }
  if (currentUser.role !== 'JOVEM') items.push(['download','download','Baixar Pesquisas']);
  if (currentUser.role === 'ADMIN') items.push(['admin','users','Gerenciar Usuários']);
  $('nav').innerHTML = items.map(([id,icon,label]) => `<button data-view="${id}" class="nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-900"><i data-lucide="${icon}" class="h-4 w-4"></i>${label}</button>`).join('');
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
  window.lucide?.createIcons?.();
}

function navigate(view) {
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  $(`view-${view}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('bg-cyan-600', el.dataset.view === view));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('text-white', el.dataset.view === view));
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.add('hidden');
  if (view === 'dashboard') loadDashboard();
  if (view === 'pesquisa') loadJovem();
  if (view === 'backup') loadBackupView();
  if (view === 'download') { setExportCurrentMonth(); loadYoungFilters('export-young'); }
  if (view === 'admin') loadUsers();
}


function openBackupDb() {
  if (backupDbPromise) return backupDbPromise;
  backupDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Armazenamento local avançado indisponível neste navegador.'));
    const request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        const store = db.createObjectStore(BACKUP_STORE, { keyPath: 'clientId' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('data', 'data', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir a cópia local.'));
  });
  return backupDbPromise;
}

function makeClientId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function saveLocalBackupSurvey(survey) {
  const db = await openBackupDb();
  const record = {
    clientId: survey.clientId || makeClientId(),
    userId: currentUser.id,
    userName: currentUser.nome,
    userEmail: currentUser.email,
    data: survey.data,
    nome: survey.nome || '',
    p1: survey.p1,
    p2: survey.p2,
    p3: survey.p3,
    p4: survey.p4,
    p5: survey.p5,
    feedback: survey.feedback || '',
    contato: survey.contato || '',
    createdAtLocal: new Date().toISOString(),
    syncedAt: null
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, 'readwrite');
    tx.objectStore(BACKUP_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Não foi possível salvar a cópia local.'));
  });
  survey.clientId = record.clientId;
  return record;
}

async function getLocalBackupSurveys(from, to) {
  try {
    const db = await openBackupDb();
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readonly');
      const request = tx.objectStore(BACKUP_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Não foi possível ler a cópia local.'));
    });
    return all.filter((row) => row.userId === currentUser.id && (!from || row.data >= from) && (!to || row.data <= to))
      .sort((a, b) => `${b.data}${b.createdAtLocal}`.localeCompare(`${a.data}${a.createdAtLocal}`));
  } catch (error) {
    toast(error.message, 'error');
    return [];
  }
}

async function archivePendingItems(date) {
  const pending = getPending(date);
  if (!pending.length) return;
  const withIds = pending.map((item) => ({ ...item, clientId: item.clientId || makeClientId() }));
  if (withIds.some((item, index) => item.clientId !== pending[index].clientId)) setPending(withIds, date);
  try { await Promise.all(withIds.map((item) => saveLocalBackupSurvey(item))); } catch (error) { console.warn('Não foi possível arquivar todas as pendências localmente:', error); }
}

async function countLocalBackup(date) {
  const rows = await getLocalBackupSurveys(date, date);
  return rows.length;
}

async function markBackupsSynced(clientIds) {
  if (!clientIds?.length) return;
  try {
    const db = await openBackupDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readwrite');
      const store = tx.objectStore(BACKUP_STORE);
      clientIds.forEach((clientId) => {
        const request = store.get(clientId);
        request.onsuccess = () => {
          const row = request.result;
          if (row) {
            row.syncedAt = new Date().toISOString();
            store.put(row);
          }
        };
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Não foi possível marcar a cópia como sincronizada.'));
    });
  } catch (error) {
    console.warn('Backup local não marcado como sincronizado:', error);
  }
}

const ANSWER_LABELS_CLIENT = {
  MUITO_SATISFEITO: 'Muito Satisfeito', SATISFEITO: 'Satisfeito', INSATISFEITO: 'Insatisfeito', MUITO_INSATISFEITO: 'Muito Insatisfeito',
  COM_CERTEZA: 'Com Certeza', SIM: 'Sim', NAO: 'Não', DE_JEITO_NENHUM: 'De jeito Nenhum'
};

const BACKUP_CSV_HEADERS = ['ID local','Data','Nome','P1 - Recepção','P2 - Equipe de Saúde','P3 - Qualidade dos Serviços','P4 - Satisfação com o Multicentro','P5 - Indicaria','Elogio / Reclamação / Sugestão','Contato','Jovem','E-mail','Status da sincronização','Cópia criada em'];

function csvEscapeClient(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function backupRowsToCsv(rows) {
  const lines = [BACKUP_CSV_HEADERS.map(csvEscapeClient).join(';')];
  rows.forEach((row) => {
    lines.push([
      row.clientId,
      formatDateBR(row.data),
      row.nome,
      ANSWER_LABELS_CLIENT[row.p1] || row.p1,
      ANSWER_LABELS_CLIENT[row.p2] || row.p2,
      ANSWER_LABELS_CLIENT[row.p3] || row.p3,
      ANSWER_LABELS_CLIENT[row.p4] || row.p4,
      ANSWER_LABELS_CLIENT[row.p5] || row.p5,
      row.feedback,
      row.contato,
      row.userName,
      row.userEmail,
      row.syncedAt ? 'Sincronizada' : 'Pendente no banco',
      new Date(row.createdAtLocal).toLocaleString('pt-BR')
    ].map(csvEscapeClient).join(';'));
  });
  return `\uFEFF${lines.join('\r\n')}`;
}

function downloadCsvText(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  sessionStorage.setItem('ponde_last_backup_download', new Date().toISOString());
}

function updateBackupLastCopyBadge() {
  const value = sessionStorage.getItem('ponde_last_backup_download');
  $('backup-last-copy').textContent = value ? `Último download: ${new Date(value).toLocaleString('pt-BR')}` : 'Nenhuma cópia baixada nesta sessão';
}

function getPending(date = $('survey-date').value || today()) {
  try { return JSON.parse(localStorage.getItem(pendingKey(date)) || '[]'); } catch { return []; }
}
function setPending(items, date = $('survey-date').value || today()) { localStorage.setItem(pendingKey(date), JSON.stringify(items)); }
function clearPending(date = $('survey-date').value || today()) { localStorage.removeItem(pendingKey(date)); }

async function fetchCount(date) {
  const data = await api(`/api/pesquisas/today-count?date=${encodeURIComponent(date)}`);
  serverCountCache = data.count;
  return data.count;
}

function updateProgress(count, { syncedCount = 0, pendingCount = 0 } = {}) {
  const safe = Math.min(count, META);
  const complete = safe >= META;
  const fullySynced = complete && syncedCount >= META && pendingCount === 0;
  $('progress-text').textContent = `${safe}/${META}`;
  $('progress-bar').style.width = `${(safe / META) * 100}%`;
  $('progress-bar').classList.toggle('bg-emerald-500', fullySynced);
  $('progress-bar').classList.toggle('bg-amber-500', complete && !fullySynced);
  $('progress-bar').classList.toggle('bg-cyan-500', !complete);
  $('survey-form').classList.toggle('hidden', complete);
  $('goal-success').classList.toggle('hidden', !complete);
  $('retry-sync').classList.toggle('hidden', !complete || fullySynced || pendingCount === 0);
  $('goal-success-text').textContent = fullySynced
    ? `As ${META} pesquisas foram registradas e sincronizadas com sucesso no sistema.`
    : `A meta local de ${META} pesquisas foi atingida. ${pendingCount} pesquisa(s) aguardam sincronização; a cópia de segurança local continua disponível.`;
  if (complete) $('goal-success').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function loadJovem() {
  const date = $('survey-date').value || today();
  await archivePendingItems(date);
  const pending = getPending(date);
  try {
    serverCountCache = await fetchCount(date);
    serverAvailable = true;
    updateProgress(serverCountCache + pending.length, { syncedCount: serverCountCache, pendingCount: pending.length });
  } catch (error) {
    serverAvailable = false;
    const localCount = await countLocalBackup(date);
    updateProgress(localCount, { syncedCount: 0, pendingCount: pending.length });
    toast('Banco temporariamente indisponível. Sua cópia local continua segura neste navegador.', 'info');
  }
  $('survey-form').scrollIntoView({ behavior:'smooth', block:'start' });
}

function resetSurvey() {
  $('survey-name').value = '';
  $('survey-feedback').value = '';
  $('survey-contact').value = '';
  document.querySelectorAll('#questions-container input[type="radio"]').forEach((el) => { el.checked = false; });
}

function surveyFromForm() {
  const data = { data:$('survey-date').value || today(), nome:$('survey-name').value.trim(), feedback:$('survey-feedback').value.trim(), contato:$('survey-contact').value.trim() };
  for (const q of QUESTIONS) {
    const selected = document.querySelector(`input[name="${q.id}"]:checked`);
    if (!selected) { toast(`Responda a pergunta ${q.id.slice(1)} antes de salvar.`, 'error'); return null; }
    data[q.id] = selected.value;
  }
  return data;
}

async function sendPending(auto=false) {
  const date = $('survey-date').value || today();
  let pending = getPending(date);
  if (!pending.length) { toast('Não há pesquisas pendentes para enviar.', 'info'); return; }
  if (sending) return;
  sending = true;
  $('modal-confirm').disabled = true;
  $('save-survey').disabled = true;
  $('send-surveys').disabled = true;
  $('retry-sync').disabled = true;
  const originalConfirmText = $('modal-confirm').textContent;
  $('modal-confirm').textContent = 'Enviando...';
  try {
    // Garante um ID local mesmo para pendências antigas criadas em uma versão anterior.
    let changed = false;
    pending = pending.map((item) => {
      if (item.clientId) return item;
      changed = true;
      return { ...item, clientId: makeClientId() };
    });
    if (changed) setPending(pending, date);
    await Promise.all(pending.map((item) => saveLocalBackupSurvey(item)));
    await api('/api/pesquisas/batch', { method:'POST', body:JSON.stringify(pending) });
    await markBackupsSynced(pending.map((item) => item.clientId));
    clearPending(date);
    serverCountCache = await fetchCount(date);
    serverAvailable = true;
    updateProgress(serverCountCache, { syncedCount: serverCountCache, pendingCount: 0 });
    if (auto && serverCountCache >= META) {
      toast('Meta concluída e pesquisas sincronizadas com sucesso!', 'success');
    } else toast('Pesquisas sincronizadas com sucesso!', 'success');
    loadBackupView();
  } catch (error) {
    serverAvailable = false;
    toast('O banco não respondeu. As pesquisas continuam salvas localmente e podem ser baixadas ou sincronizadas novamente.', 'error');
    const localCount = await countLocalBackup(date);
    updateProgress(Math.max(localCount, getPending(date).length), { syncedCount: serverCountCache, pendingCount: getPending(date).length });
  }
  finally {
    sending = false;
    $('modal-confirm').disabled = false;
    $('save-survey').disabled = false;
    $('send-surveys').disabled = false;
    $('retry-sync').disabled = false;
    $('modal-confirm').textContent = originalConfirmText;
  }
}

async function handleSurveySubmit(event) {
  event.preventDefault();
  if (sending) return;
  const data = surveyFromForm();
  if (!data) return;
  const date = data.data;
  const pending = getPending(date);
  const current = serverAvailable ? serverCountCache + pending.length : await countLocalBackup(date);
  if (current >= META) { toast('A meta desta data já foi concluída.', 'info'); updateProgress(current, { syncedCount: serverAvailable ? serverCountCache : 0, pendingCount: pending.length }); return; }
  data.clientId = makeClientId();
  try {
    await saveLocalBackupSurvey(data);
  } catch (error) {
    // Mesmo com falha no IndexedDB, o pending localStorage continua sendo uma segunda camada de contingência.
    toast('A cópia avançada do navegador falhou; a pesquisa ainda foi mantida temporariamente para envio.', 'info');
  }
  pending.push(data);
  setPending(pending, date);
  resetSurvey();
  const localCount = await countLocalBackup(date);
  const newTotal = serverAvailable ? serverCountCache + pending.length : localCount;
  updateProgress(newTotal, { syncedCount: serverAvailable ? serverCountCache : 0, pendingCount: pending.length });
  toast('Pesquisa salva com sucesso e cópia de segurança criada!', 'success');
  if (newTotal === META) await sendPending(true);
}

function openSendModal() {
  const pending = getPending($('survey-date').value || today());
  if (!pending.length) { toast('Não há pesquisas pendentes para enviar.', 'info'); return; }
  $('send-modal-text').textContent = `Você possui ${pending.length} pesquisa(s) pendente(s) para esta data. O envio será registrado no sistema.`;
  $('send-modal').classList.remove('hidden'); $('send-modal').classList.add('flex');
}
function closeSendModal() { $('send-modal').classList.add('hidden'); $('send-modal').classList.remove('flex'); }

function destroyChart(name) { if (charts[name]) charts[name].destroy(); }
function labelsForMap(map, labels) { return labels.map((key) => map[key] || 0); }
function dateRangeKeys(from, to) {
  const labels = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end && labels.length < 93) {
    labels.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return labels;
}

function chartBaseOptions() {
  return { responsive:true, maintainAspectRatio:false, interaction:{ mode:'index', intersect:false }, plugins:{ tooltip:{ padding:10, displayColors:true } } };
}

function renderDashboardCharts(data) {
  const from = $('dash-from').value || today();
  const to = $('dash-to').value || today();
  const dailyLabels = dateRangeKeys(from, to);
  const dailyValues = dailyLabels.map((key) => data.daily[key] || 0);

  const daysCtx = $('chart-daily'); destroyChart('daily');
  charts.daily = new Chart(daysCtx, {
    type:'line',
    data:{ labels:dailyLabels.map(formatDateBR), datasets:[
      { label:'Pesquisas', data:dailyValues, tension:.28, borderWidth:3, pointRadius:3, fill:true },
      { label:'Meta diária (60)', data:dailyLabels.map(() => META), borderWidth:2, borderDash:[6,6], pointRadius:0, fill:false }
    ] },
    options:{ ...chartBaseOptions(), scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } }, plugins:{ legend:{ position:'bottom' } } }
  });

  const satLabels = ['Muito Satisfeito','Satisfeito','Insatisfeito','Muito Insatisfeito'];
  const satKeys = ['MUITO_SATISFEITO','SATISFEITO','INSATISFEITO','MUITO_INSATISFEITO'];
  const satCtx = $('chart-satisfaction'); destroyChart('satisfaction');
  charts.satisfaction = new Chart(satCtx, { type:'doughnut', data:{ labels:satLabels, datasets:[{ data:labelsForMap(data.satisfaction,satKeys), borderWidth:2 }] }, options:{ ...chartBaseOptions(), cutout:'62%', plugins:{ legend:{ position:'bottom' } } } });

  const recLabels = ['Com Certeza','Sim','Não','De jeito Nenhum'];
  const recKeys = ['COM_CERTEZA','SIM','NAO','DE_JEITO_NENHUM'];
  const recCtx = $('chart-recommendation'); destroyChart('recommendation');
  charts.recommendation = new Chart(recCtx, { type:'bar', data:{ labels:recLabels, datasets:[{ label:'Respostas', data:labelsForMap(data.recommendation,recKeys), borderRadius:7, borderWidth:0 }] }, options:{ ...chartBaseOptions(), scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } }, plugins:{ legend:{ display:false } } } });

  const qCtx = $('chart-questions'); destroyChart('questions');
  charts.questions = new Chart(qCtx, { type:'bar', data:{ labels:data.questionPerformance.map((q) => q.label), datasets:[{ label:'Satisfação positiva (%)', data:data.questionPerformance.map((q) => q.positive), borderRadius:7 }] }, options:{ ...chartBaseOptions(), indexAxis:'y', scales:{ x:{ beginAtZero:true, max:100, ticks:{ callback:(value) => `${value}%` } } }, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(ctx) => `${ctx.raw}%` } } } } });

  const youngRows = lastDashboardUsers || [];
  const yCtx = $('chart-youngs'); destroyChart('youngs');
  charts.youngs = new Chart(yCtx, { type:'bar', data:{ labels:youngRows.map((u) => u.nome), datasets:[
    { label:'Média/dia', data:youngRows.map((u) => u.avgPerDay), borderRadius:7 },
    { label:'Meta diária', data:youngRows.map(() => META), borderRadius:7 }
  ] }, options:{ ...chartBaseOptions(), scales:{ y:{ beginAtZero:true } }, plugins:{ legend:{ position:'bottom' } } } });
}

let lastDashboardUsers = [];

function percentDelta(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
function paintDelta(id, current, previous, suffix='%') {
  const el = $(id);
  const value = percentDelta(Number(current || 0), Number(previous || 0));
  el.textContent = `${value > 0 ? '+' : ''}${value}${suffix}`;
  el.className = `text-xs font-bold ${value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-slate-400'}`;
}

function renderQuickInsights(data, users) {
  const items = [];
  const busiest = Object.entries(data.daily || {}).sort((a,b) => b[1]-a[1])[0];
  if (busiest) items.push({ icon:'calendar-days', title:'Maior volume de coleta', text:`${formatDateBR(busiest[0])}: ${busiest[1]} pesquisa(s).` });
  const lowest = [...data.questionPerformance].sort((a,b) => a.positive-b.positive)[0];
  if (lowest && data.totalPesquisas) items.push({ icon:'target', title:'Ponto para acompanhar', text:`${lowest.label}: ${fmtPct(lowest.positive)} de respostas positivas.` });
  const active = users.filter((u) => u.count > 0).length;
  items.push({ icon:'users', title:'Participação da equipe', text:`${active} jovem(ns) tiveram coletas no período.` });
  items.push({ icon:'message-square', title:'Feedbacks registrados', text:`${data.feedbacks} pesquisa(s) possuem observação textual.` });
  $('insight-list').innerHTML = items.map((item) => `<div class="insight-item"><div class="insight-icon"><i data-lucide="${item.icon}" class="h-4 w-4"></i></div><div><p class="font-semibold text-slate-800">${escapeHtml(item.title)}</p><p class="text-xs leading-5 text-slate-500">${escapeHtml(item.text)}</p></div></div>`).join('');
  window.lucide?.createIcons?.();
}

function renderRecentFeedbacks(data) {
  $('feedback-list').innerHTML = data.recentFeedbacks?.length ? data.recentFeedbacks.map((item) => `<article class="rounded-xl border border-slate-100 bg-slate-50 p-3"><div class="flex items-center justify-between gap-3 text-xs text-slate-400"><span>${formatDateBR(item.date)}</span><span class="font-semibold text-cyan-700">Feedback</span></div><p class="mt-2 text-sm leading-6 text-slate-700">${escapeHtml(item.feedback)}</p></article>`).join('') : '<div class="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">Nenhum feedback no período selecionado.</div>';
}

function renderUsersTable(users) {
  $('table-users').innerHTML = users.length ? users.map((u) => `<tr class="hover:bg-slate-50"><td class="px-4 py-3"><div class="font-semibold text-slate-800">${escapeHtml(u.nome)}</div><div class="text-xs text-slate-400">${escapeHtml(u.email)}</div></td><td class="px-4 py-3 font-semibold">${u.count}</td><td class="px-4 py-3">${u.avgPerDay.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</td><td class="px-4 py-3">${fmtPct(u.satisfacao)}</td><td class="px-4 py-3">${fmtPct(u.indicaria)}</td><td class="px-4 py-3">${u.feedbacks}</td><td class="px-4 py-3 text-right"><button class="btn-mini" data-focus-young="${u.id}">Filtrar</button></td></tr>`).join('') : '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Nenhum jovem encontrado no período.</td></tr>';
  document.querySelectorAll('[data-focus-young]').forEach((btn) => btn.addEventListener('click', () => {
    $('dash-young').value = btn.dataset.focusYoung;
    loadDashboard();
    window.scrollTo({ top:0, behavior:'smooth' });
  }));
}

function setKpiDelta(id, current, previous, emptyLabel='—') {
  const value = Number(current || 0);
  const prev = Number(previous || 0);
  const element = $(id);
  if (!element) return;
  if (value === 0 && prev === 0) { element.textContent = emptyLabel; element.className = 'text-xs font-bold text-slate-400'; return; }
  const delta = percentDelta(value, prev);
  element.textContent = `${delta > 0 ? '+' : ''}${delta}% no período anterior`;
  element.className = `text-xs font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-400'}`;
}

async function loadYoungFilters(selectId) {
  try {
    const data = await api('/api/pesquisas/dashboard/youngs');
    youngOptions = data.youngs;
    const select = $(selectId);
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Todos os jovens</option>' + youngOptions.map((u) => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('');
    if (youngOptions.some((u) => String(u.id) === String(previous))) select.value = previous;
  } catch (error) { toast(error.message, 'error'); }
}

async function loadDashboard() {
  const from = $('dash-from').value || today();
  const to = $('dash-to').value || today();
  const youngId = $('dash-young').value;
  if (to < from) { toast('A data final não pode ser anterior à data inicial.', 'error'); return; }
  try {
    await loadYoungFilters('dash-young');
    $('dash-young').value = youngId;
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${youngId ? `&youngId=${encodeURIComponent(youngId)}` : ''}`;
    const data = await api(`/api/pesquisas/dashboard/summary?${query}`);
    const users = await api(`/api/pesquisas/dashboard/users?${query}`);
    lastDashboardData = data;
    lastDashboardUsers = users.users;
    $('kpi-total').textContent = data.totalPesquisas;
    $('kpi-satisfacao').textContent = fmtPct(data.satisfacao);
    $('kpi-indicaria').textContent = fmtPct(data.indicaria);
    $('kpi-feedback').textContent = data.feedbacks;
    $('kpi-media-dia').textContent = data.avgPerDay.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
    $('kpi-jovens').textContent = data.activeYoungs;
    $('dash-date-label').textContent = `${formatDateBR(from)} → ${formatDateBR(to)}`;
    const collectionPct = Math.min(data.collectionRate, 100);
    $('collection-rate').textContent = fmtPct(collectionPct);
    $('collection-rate-big').textContent = fmtPct(collectionPct);
    $('collection-rate-ring').style.background = `conic-gradient(#06b6d4 ${collectionPct * 3.6}deg, #f1f5f9 0deg)`;
    $('collection-rate-bar').style.width = `${collectionPct}%`;
    $('collection-average').textContent = `${data.avgPerDay.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} / dia`;
    $('collection-detail').textContent = `Referência de ${META} pesquisas por dia no período selecionado.`;
    setKpiDelta('delta-total', data.totalPesquisas, data.previous.totalPesquisas);
    setKpiDelta('delta-satisfacao', data.satisfacao, data.previous.satisfacao);
    setKpiDelta('delta-indicaria', data.indicaria, data.previous.indicaria);
    setKpiDelta('delta-feedback', data.feedbacks, data.previous.feedbacks);
    paintDelta('delta-media', data.avgPerDay, data.previous.avgPerDay);
    renderDashboardCharts(data);
    renderUsersTable(users.users);
    renderQuickInsights(data, users.users);
    renderRecentFeedbacks(data);
  } catch (error) { toast(error.message, 'error'); }
}


async function loadBackupView() {
  if (currentUser?.role !== 'JOVEM') return;
  const from = $('backup-from').value || today();
  const to = $('backup-to').value || today();
  if (to < from) { toast('A data final não pode ser anterior à data inicial.', 'error'); return; }

  const localRows = await getLocalBackupSurveys(from, to);
  const pendingRows = localRows.filter((row) => !row.syncedAt).length;
  $('backup-local-count').textContent = localRows.length;
  $('backup-pending-count').textContent = pendingRows;
  $('backup-table-subtitle').textContent = `${formatDateBR(from)} → ${formatDateBR(to)} · ${localRows.length} cópia(s) local(is)`;
  $('backup-table-body').innerHTML = localRows.length ? localRows.map((row) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-3 whitespace-nowrap">${formatDateBR(row.data)}</td>
    <td class="px-4 py-3">${escapeHtml(row.nome || 'Não informado')}</td>
    <td class="px-4 py-3">${escapeHtml(ANSWER_LABELS_CLIENT[row.p1] || row.p1)}</td>
    <td class="px-4 py-3">${escapeHtml(ANSWER_LABELS_CLIENT[row.p2] || row.p2)}</td>
    <td class="px-4 py-3">${escapeHtml(ANSWER_LABELS_CLIENT[row.p3] || row.p3)}</td>
    <td class="px-4 py-3">${escapeHtml(ANSWER_LABELS_CLIENT[row.p4] || row.p4)}</td>
    <td class="px-4 py-3">${escapeHtml(ANSWER_LABELS_CLIENT[row.p5] || row.p5)}</td>
    <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold ${row.syncedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">${row.syncedAt ? 'Sincronizada' : 'Pendente'}</span></td>
  </tr>`).join('') : '<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">Nenhuma cópia local encontrada no período.</td></tr>';

  // Tenta consultar o que chegou ao banco. Se falhar, a área continua útil pelo backup local.
  try {
    const server = await api(`/api/pesquisas/mine?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    serverAvailable = true;
    $('backup-server-count').textContent = server.total;
    $('backup-server-label').textContent = server.truncated ? 'limite de 1.000 no período' : 'no período selecionado';
    $('backup-connectivity').innerHTML = '<span class="h-2 w-2 rounded-full bg-emerald-500"></span>Banco conectado';
    $('backup-connectivity').className = 'inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700';
  } catch (error) {
    serverAvailable = false;
    $('backup-server-count').textContent = '—';
    $('backup-server-label').textContent = 'indisponível no momento';
    $('backup-connectivity').innerHTML = '<span class="h-2 w-2 rounded-full bg-amber-500"></span>Modo de segurança local';
    $('backup-connectivity').className = 'inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700';
  }
  updateBackupLastCopyBadge();
  window.lucide?.createIcons?.();
}

async function downloadLocalBackup(from, to, onlyPending=false) {
  let rows = await getLocalBackupSurveys(from, to);
  if (onlyPending) rows = rows.filter((row) => !row.syncedAt);
  if (!rows.length) { toast(onlyPending ? 'Não há pesquisas pendentes na cópia local.' : 'Não há cópias locais no período.', 'info'); return false; }
  const suffix = onlyPending ? '_pendentes' : '';
  downloadCsvText(backupRowsToCsv(rows), `backup_pesquisas_${from}_a_${to}${suffix}.csv`);
  updateBackupLastCopyBadge();
  toast('Cópia local baixada com sucesso.', 'success');
  return true;
}

async function exportMySurveysWithFallback(from, to) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { toast('Sua sessão expirou. Faça login novamente.', 'error'); logout(); return; }
  try {
    const response = await fetch(`${API}/api/pesquisas/export/csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Servidor indisponível para exportação.');
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || `minhas_pesquisas_${from}_a_${to}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    updateBackupLastCopyBadge();
    toast('Pesquisas baixadas do banco com sucesso. A cópia local continua disponível.', 'success');
    return true;
  } catch (error) {
    toast('Banco indisponível. Usando a cópia local de segurança.', 'info');
    return downloadLocalBackup(from, to, false);
  }
}

function setQuickRange(mode) {
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);
  if (mode === '7d') from.setDate(now.getDate() - 6);
  if (mode === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  if (mode === 'prev-month') {
    from = new Date(now.getFullYear(), now.getMonth()-1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  }
  $('dash-from').value = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;
  $('dash-to').value = `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`;
  loadDashboard();
}

function setExportCurrentMonth() {
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  $('export-from').value = first;
  $('export-to').value = today();
  if ($('export-young')) $('export-young').value = '';
}

async function exportSurveysCsv() {
  const from = $('export-from').value || today();
  const to = $('export-to').value || today();
  const youngId = $('export-young').value;
  if (to < from) { toast('A data final não pode ser anterior à data inicial.', 'error'); return; }
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { toast('Sua sessão expirou. Faça login novamente.', 'error'); logout(); return; }
  const btn = $('export-csv-btn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-circle" class="mr-2 inline-block h-4 w-4 animate-spin"></i>Gerando CSV...';
  window.lucide?.createIcons?.();
  try {
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${youngId ? `&youngId=${encodeURIComponent(youngId)}` : ''}`;
    const response = await fetch(`${API}/api/pesquisas/export/csv?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Não foi possível gerar o arquivo CSV.'); }
    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || `pesquisas_multicentro_${from}_a_${to}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast('Arquivo CSV baixado com sucesso!', 'success');
  } catch (error) { toast(error.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = original; window.lucide?.createIcons?.(); }
}

async function loadUsers() {
  try {
    const data = await api('/api/users');
    $('table-admin-users').innerHTML = data.users.map((u) => `<tr><td class="px-4 py-3 font-semibold">${escapeHtml(u.nome)}</td><td class="px-4 py-3">${escapeHtml(u.email)}</td><td class="px-4 py-3">${u.role === 'GESTAO' ? 'Gestão' : u.role === 'JOVEM' ? 'Jovem Aprendiz' : 'Administrador'}</td><td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold ${u.ativo?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}">${u.ativo?'Ativo':'Inativo'}</span></td><td class="px-4 py-3 text-right">${u.role === 'ADMIN' ? '<span class="text-xs text-slate-400">Protegido</span>' : `<button class="text-xs font-semibold text-rose-600 hover:underline" data-remove-user="${u.id}">Remover</button>`}</td></tr>`).join('');
    document.querySelectorAll('[data-remove-user]').forEach((btn) => btn.addEventListener('click', () => removeUser(Number(btn.dataset.removeUser))));
  } catch (error) { toast(error.message, 'error'); }
}

async function removeUser(id) {
  if (!confirm('Deseja realmente remover este usuário?')) return;
  try { const result = await api(`/api/users/${id}`, { method:'DELETE' }); toast(result.message, 'success'); await loadUsers(); } catch (error) { toast(error.message, 'error'); }
}

async function handleCreateUser(event) {
  event.preventDefault();
  const body = { nome:$('user-name-input').value.trim(), email:$('user-email-input').value.trim(), senha:$('user-password-input').value, role:$('user-role-input').value };
  try { await api('/api/users', { method:'POST', body:JSON.stringify(body) }); toast('Usuário criado com sucesso!', 'success'); event.target.reset(); await loadUsers(); } catch (error) { toast(error.message, 'error'); }
}

async function handleLogin(event) {
  event.preventDefault();
  const btn = $('login-btn'); btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const result = await api('/api/auth/login', { method:'POST', body:JSON.stringify({ email:$('login-email').value, senha:$('login-senha').value }) });
    localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem(USER_KEY, JSON.stringify(result.user)); currentUser = result.user;
    setScreen(true); renderUserHeader(); renderNav();
    if (currentUser.role === 'ADMIN' || currentUser.role === 'GESTAO') navigate('dashboard'); else navigate('pesquisa');
    toast('Login realizado com sucesso!', 'success');
  } catch (error) { toast(error.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Entrar no portal'; }
}

async function restoreSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    const result = await api('/api/auth/me');
    currentUser = result.user; setScreen(true); renderUserHeader(); renderNav();
    if (currentUser.role === 'ADMIN' || currentUser.role === 'GESTAO') navigate('dashboard'); else navigate('pesquisa');
  } catch { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
}

function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); currentUser = null; setScreen(false); $('login-senha').value=''; }

function togglePassword(inputId, buttonId) {
  const input = $(inputId); const button = $(buttonId); if (!input || !button) return;
  button.addEventListener('click', () => { const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; button.innerHTML = `<i data-lucide="${visible ? 'eye' : 'eye-off'}" class="h-4 w-4"></i>`; window.lucide?.createIcons?.(); });
}

function init() {
  renderQuestions();
  $('survey-date').value = today();
  $('dash-from').value = `${new Date(Date.now() - 6*86400000).toISOString().slice(0,10)}`;
  $('dash-to').value = today();
  $('backup-from').value = today();
  $('backup-to').value = today();
  $('login-form').addEventListener('submit', handleLogin);
  togglePassword('login-senha', 'toggle-login-password');
  $('survey-form').addEventListener('submit', handleSurveySubmit);
  $('send-surveys').addEventListener('click', openSendModal);
  $('retry-sync').addEventListener('click', () => sendPending(false));
  $('go-backup').addEventListener('click', () => navigate('backup'));
  $('modal-cancel').addEventListener('click', closeSendModal);
  $('modal-confirm').addEventListener('click', async () => { closeSendModal(); await sendPending(false); });
  $('dash-filter').addEventListener('click', loadDashboard);
  document.querySelectorAll('[data-range]').forEach((button) => button.addEventListener('click', () => setQuickRange(button.dataset.range)));
  $('dash-young').addEventListener('change', loadDashboard);
  $('dash-clear-young').addEventListener('click', () => { $('dash-young').value=''; loadDashboard(); });
  $('export-csv-btn').addEventListener('click', exportSurveysCsv);
  $('export-this-month').addEventListener('click', () => { setExportCurrentMonth(); loadYoungFilters('export-young'); });
  $('backup-refresh').addEventListener('click', loadBackupView);
  $('backup-download-today').addEventListener('click', () => exportMySurveysWithFallback(today(), today()));
  $('backup-download-period').addEventListener('click', () => exportMySurveysWithFallback($('backup-from').value || today(), $('backup-to').value || today()));
  $('backup-download-pending').addEventListener('click', () => downloadLocalBackup($('backup-from').value || today(), $('backup-to').value || today(), true));
  $('user-form').addEventListener('submit', handleCreateUser);
  $('logout-btn').addEventListener('click', logout);
  $('mobile-menu').addEventListener('click', () => { $('sidebar').classList.add('open'); $('sidebar-overlay').classList.remove('hidden'); });
  $('sidebar-overlay').addEventListener('click', () => { $('sidebar').classList.remove('open'); $('sidebar-overlay').classList.add('hidden'); });
  $('survey-date').addEventListener('change', loadJovem);
  if (window.APP_CONFIG?.METABASE_DASHBOARD_URL) { $('metabase-btn').href = window.APP_CONFIG.METABASE_DASHBOARD_URL; $('metabase-btn').classList.remove('hidden'); }
  window.addEventListener('online', () => { serverAvailable = true; if (currentUser?.role === 'JOVEM') toast('Conexão restabelecida. Você pode tentar sincronizar as pesquisas pendentes.', 'success'); });
  window.addEventListener('offline', () => { serverAvailable = false; if (currentUser?.role === 'JOVEM') toast('Sem conexão. O backup local continua disponível.', 'info'); });
  restoreSession();
  window.lucide?.createIcons?.();
}

document.addEventListener('DOMContentLoaded', init);

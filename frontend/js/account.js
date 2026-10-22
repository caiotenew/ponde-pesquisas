/*
 * Conta do usuário: abas Entrar / Criar conta, "esqueci minha senha", força da senha e troca de senha.
 * Depende do app.js (window.PondeApp).
 */
(function () {
  'use strict';
  const { $, api, toast, dialog, escapeHtml } = window.PondeApp;
  const ADMIN_EMAIL = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_EMAIL || '').toLowerCase();
  const WEAK_KEY = 'ponde_weak_password';

  /* ---------- Força da senha ---------- */
  const LEVELS = [{ label: 'Fraca', cls: 's1' }, { label: 'Fraca', cls: 's1' }, { label: 'Razoável', cls: 's2' }, { label: 'Boa', cls: 's3' }, { label: 'Forte', cls: 's4' }];
  function strength(pwd) {
    if (!pwd) return { score: 0, label: 'Digite uma senha', cls: '' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) score += 1;
    if ((/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) || /[^A-Za-z0-9]/.test(pwd)) score += 1;
    return { score, ...LEVELS[Math.min(score, 4)] };
  }
  function paintMeter(root, pwd, confirm, min) {
    const info = strength(pwd);
    root.querySelector('.pw-bar').className = `pw-bar ${info.cls}`;
    root.querySelector('.pw-bar span').style.width = pwd ? `${(Math.max(info.score, 1) / 4) * 100}%` : '0%';
    root.querySelector('.pw-label').textContent = info.label;
    const rules = {
      len: pwd.length >= min,
      mix: /[a-zA-Z]/.test(pwd) && /\d/.test(pwd),
      match: confirm !== null && pwd.length > 0 && pwd === confirm
    };
    root.querySelectorAll('[data-rule]').forEach((li) => {
      const rule = li.dataset.rule;
      if (rule === 'len') li.querySelector('.rule-text').textContent = `Mínimo de ${min} caracteres`;
      li.classList.toggle('is-ok', Boolean(rules[rule]));
    });
  }
  const meterHTML = (withMatch) => `<div class="pw-meter"><div class="pw-meter-top"><div class="pw-bar"><span></span></div><small class="pw-label">Digite uma senha</small></div><ul class="pw-rules"><li data-rule="len"><i></i><span class="rule-text">Mínimo de 6 caracteres</span></li><li data-rule="mix"><i></i><span>Letras e números (recomendado)</span></li>${withMatch ? '<li data-rule="match"><i></i><span>As senhas coincidem</span></li>' : ''}</ul></div>`;

  /* ---------- Painéis da tela de acesso ---------- */
  function showPane(name) {
    ['login', 'register', 'forgot', 'done'].forEach((p) => { $(`pane-${p}`).hidden = p !== name; });
    $('auth-tabs').hidden = !(name === 'login' || name === 'register');
    $('tab-login').classList.toggle('is-selected', name === 'login');
    $('tab-register').classList.toggle('is-selected', name === 'register');
    $('tab-login').setAttribute('aria-selected', String(name === 'login'));
    $('tab-register').setAttribute('aria-selected', String(name === 'register'));
    const focusId = { login: 'login-email', register: 'reg-nome', forgot: 'forgot-email' }[name];
    if (focusId) setTimeout(() => $(focusId) && $(focusId).focus(), 30);
  }
  function showDone({ icon, title, text }) {
    $('done-icon').innerHTML = `<i data-lucide="${icon}"></i>`;
    $('done-title').textContent = title;
    $('done-text').textContent = text;
    showPane('done');
    window.lucide && window.lucide.createIcons && window.lucide.createIcons();
  }
  const selectedRole = () => (document.querySelector('input[name="reg-role"]:checked') || {}).value || 'JOVEM';
  const minLen = () => ($('reg-email').value.trim().toLowerCase() === ADMIN_EMAIL && ADMIN_EMAIL ? 4 : 6);

  function updateRoleUI() {
    const gestao = selectedRole() === 'GESTAO';
    $('reg-gestao-fields').hidden = !gestao;
    document.querySelectorAll('.role-card').forEach((card) => card.classList.toggle('is-selected', card.querySelector('input').checked));
    $('reg-submit').textContent = gestao ? 'Solicitar acesso de Gestão' : 'Criar minha conta';
    $('reg-role-note').textContent = gestao
      ? 'Contas de Gestão passam por aprovação do administrador antes do primeiro acesso.'
      : 'Contas de Jovem Aprendiz têm acesso imediato para coletar pesquisas.';
  }
  function updateRegisterMeter() { paintMeter($('reg-meter'), $('reg-senha').value, $('reg-senha2').value, minLen()); }

  function setFeedback(message) {
    const box = $('reg-feedback');
    box.hidden = !message;
    box.textContent = message || '';
  }

  async function handleRegister(event) {
    event.preventDefault();
    setFeedback('');
    const role = selectedRole();
    const body = {
      nome: $('reg-nome').value.trim(), email: $('reg-email').value.trim(), senha: $('reg-senha').value, role,
      cargo: $('reg-cargo').value.trim(), justificativa: $('reg-justificativa').value.trim()
    };
    if (body.nome.split(' ').filter(Boolean).length < 2) return setFeedback('Informe seu nome completo (nome e sobrenome).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return setFeedback('Informe um e-mail válido.');
    if (body.senha.length < minLen()) return setFeedback(`A senha precisa ter pelo menos ${minLen()} caracteres.`);
    if (body.senha !== $('reg-senha2').value) return setFeedback('As senhas não coincidem.');
    if (role === 'GESTAO' && body.cargo.length < 2) return setFeedback('Informe seu cargo ou função para solicitar acesso de Gestão.');
    if (!$('reg-terms').checked) return setFeedback('Confirme a declaração para continuar.');

    const btn = $('reg-submit'); const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
      $('register-form').reset(); updateRoleUI(); updateRegisterMeter();
      if (result.pending) {
        showDone({ icon: 'clock-3', title: 'Solicitação enviada', text: result.message });
      } else {
        window.PondeApp.completeLogin(result);
        toast(result.message || 'Conta criada com sucesso!', 'success');
      }
    } catch (error) { setFeedback(error.message); }
    finally { btn.disabled = false; btn.textContent = label; updateRoleUI(); }
  }

  async function handleForgot(event) {
    event.preventDefault();
    const btn = $('forgot-submit'); btn.disabled = true;
    try {
      const result = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: $('forgot-email').value.trim() }) });
      showDone({ icon: 'mail-check', title: 'Pedido registrado', text: result.message });
    } catch (error) { toast(error.message, 'error'); }
    finally { btn.disabled = false; }
  }

  /* ---------- Trocar senha (dentro do sistema) ---------- */
  function showBanner(on) {
    const box = $('app-banner');
    if (!box) return;
    box.innerHTML = on
      ? '<div class="app-banner"><i data-lucide="triangle-alert"></i><div><strong>Sua senha é muito simples.</strong> Defina uma senha mais forte para proteger o acesso ao sistema.</div><button type="button" class="btn-mini" id="banner-change">Alterar agora</button></div>'
      : '';
    if (on) { $('banner-change').addEventListener('click', () => openChangePassword({})); window.lucide && window.lucide.createIcons && window.lucide.createIcons(); }
  }

  function openChangePassword({ forced = false, intro = '' } = {}) {
    const html = `${intro ? `<p class="dlg-text">${escapeHtml(intro)}</p>` : ''}
      <label class="dlg-label" for="cp-atual">${forced ? 'Senha temporária recebida' : 'Senha atual'}</label>
      <input id="cp-atual" type="password" class="field" autocomplete="current-password">
      <label class="dlg-label" for="cp-nova">Nova senha</label>
      <input id="cp-nova" type="password" class="field" autocomplete="new-password">
      <label class="dlg-label" for="cp-conf">Confirmar nova senha</label>
      <input id="cp-conf" type="password" class="field" autocomplete="new-password">
      ${meterHTML(true)}`;
    const dlg = dialog({
      title: forced ? 'Defina uma nova senha' : 'Alterar senha', icon: 'key-round', body: html, dismissible: !forced,
      actions: [
        ...(forced ? [] : [{ label: 'Cancelar' }]),
        {
          label: 'Salvar nova senha', kind: 'primary',
          onClick: async ({ box }) => {
            const atual = box.querySelector('#cp-atual').value, nova = box.querySelector('#cp-nova').value, conf = box.querySelector('#cp-conf').value;
            if (!atual) { toast('Informe a senha atual.', 'error'); return false; }
            if (nova.length < 6) { toast('A nova senha precisa ter pelo menos 6 caracteres.', 'error'); return false; }
            if (nova !== conf) { toast('As senhas não coincidem.', 'error'); return false; }
            const result = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }) });
            window.PondeApp.setSession(result.token, result.user);
            sessionStorage.removeItem(WEAK_KEY); showBanner(false);
            toast('Senha alterada com sucesso.', 'success');
          }
        }
      ]
    });
    const box = dlg.box;
    const refresh = () => paintMeter(box, box.querySelector('#cp-nova').value, box.querySelector('#cp-conf').value, 6);
    box.querySelector('#cp-nova').addEventListener('input', refresh);
    box.querySelector('#cp-conf').addEventListener('input', refresh);
    refresh();
  }

  /* ---------- Ligações ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    $('tab-login').addEventListener('click', () => showPane('login'));
    $('tab-register').addEventListener('click', () => showPane('register'));
    $('go-forgot').addEventListener('click', () => showPane('forgot'));
    document.querySelectorAll('[data-go-login]').forEach((b) => b.addEventListener('click', () => showPane('login')));
    document.querySelectorAll('input[name="reg-role"]').forEach((r) => r.addEventListener('change', updateRoleUI));
    ['reg-senha', 'reg-senha2', 'reg-email'].forEach((id) => $(id).addEventListener('input', updateRegisterMeter));
    $('register-form').addEventListener('submit', handleRegister);
    $('forgot-form').addEventListener('submit', handleForgot);
    $('change-password-btn').addEventListener('click', () => openChangePassword({}));
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => btn.addEventListener('click', () => {
      const input = $(btn.dataset.togglePassword);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      btn.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
      window.lucide && window.lucide.createIcons && window.lucide.createIcons();
    }));
    updateRoleUI(); updateRegisterMeter();
  });

  window.PondeHooks.afterLogin = (result) => {
    const user = result.user;
    if (user.mustChangePassword) {
      openChangePassword({ forced: true, intro: 'O administrador definiu uma senha temporária para você. Crie uma senha pessoal para continuar.' });
      return;
    }
    if (result.weakPassword) sessionStorage.setItem(WEAK_KEY, '1');
    const weak = sessionStorage.getItem(WEAK_KEY) === '1';
    showBanner(weak);
    if (weak && !result.restored) openChangePassword({ intro: 'Sua senha atual é muito curta e fácil de adivinhar. Recomendamos trocá-la agora.' });
  };
  window.PondeHooks.onLogout = () => { sessionStorage.removeItem(WEAK_KEY); showBanner(false); showPane('login'); };
})();

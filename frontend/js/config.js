/*
 * Configuração do frontend.
 * - Rodando local (localhost / 127.0.0.1): usa a API em http://localhost:3000 automaticamente.
 * - Publicado (GitHub Pages): usa PRODUCTION_API_URL.
 *
 * >>> ÚNICA LINHA PARA EDITAR APÓS O DEPLOY DO BACKEND NO RENDER <<<
 */
(function () {
  var PRODUCTION_API_URL = 'https://SEU-BACKEND.onrender.com';

  var isLocal = ['localhost', '127.0.0.1'].indexOf(window.location.hostname) !== -1;
  window.APP_CONFIG = {
    API_BASE_URL: isLocal ? 'http://localhost:3000' : PRODUCTION_API_URL,
    // E-mail reservado ao administrador (a senha dele pode ter 4 caracteres no cadastro).
    ADMIN_EMAIL: 'damascenocaio311@gmail.com',
    // Opcional: URL pública do dashboard Metabase.
    METABASE_DASHBOARD_URL: ''
  };
})();

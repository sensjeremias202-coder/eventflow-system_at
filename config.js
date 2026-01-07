// Configuração dinâmica da URL da API.
// Inclua este arquivo ANTES de api.js em cada página.
// Prioridade de origem: query param (apiBase) -> localStorage -> ambiente detectado.

(function(){
  try {
    var params = new URLSearchParams(window.location.search || '');
    var qp = params.get('apiBase');
    if (qp) {
      try { localStorage.setItem('API_BASE_URL', qp); } catch(_) {}
      window.API_BASE_URL = qp;
      console.log('[Config] API via query param:', qp);
      return;
    }
  } catch (_) {}

  try {
    var ls = null;
    try { ls = localStorage.getItem('API_BASE_URL'); } catch(_) {}
    if (ls) {
      window.API_BASE_URL = ls;
      console.log('[Config] API via localStorage:', ls);
      return;
    }
  } catch (_) {}

  try {
    var host = (typeof location !== 'undefined' ? location.hostname : '');
    var isLocal = /^(localhost|127\.0\.0\.1)$/i.test(String(host));
    window.API_BASE_URL = isLocal ? 'http://localhost:5000' : 'https://eventflow-system.onrender.com';
    console.log('[Config] API via ambiente:', window.API_BASE_URL, 'Host:', host);
  } catch (e) {
    window.API_BASE_URL = 'https://eventflow-system.onrender.com';
  }
})();

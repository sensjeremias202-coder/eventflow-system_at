// Configuração dinâmica da URL da API.
// Inclua este arquivo ANTES de api.js em cada página.
// Prioridade de origem: query param (apiBase) -> localStorage -> ambiente detectado.

(function(){
  try {
    var params = new URLSearchParams(window.location.search || '');
    var qp = params.get('apiBase');
    var gcid = params.get('googleClientId');
    if (qp) {
      try { localStorage.setItem('API_BASE_URL', qp); } catch(_) {}
      window.API_BASE_URL = qp;
      console.log('[Config] API via query param:', qp);
      return;
    }
    if (gcid) {
      try { localStorage.setItem('GOOGLE_CLIENT_ID', gcid); } catch(_) {}
      window.GOOGLE_CLIENT_ID = gcid;
      console.log('[Config] Google Client via query:', gcid);
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
    var gls = null;
    try { gls = localStorage.getItem('GOOGLE_CLIENT_ID'); } catch(_) {}
    if (gls) {
      window.GOOGLE_CLIENT_ID = gls;
      console.log('[Config] Google Client via localStorage:', gls);
    }
  } catch (_) {}

  try {
    var host = (typeof location !== 'undefined' ? location.hostname : '');
    var isLocal = /^(localhost|127\.0\.0\.1)$/i.test(String(host));
    // Preferir porta 5100 em ambiente local (compatível com o .env atual)
    window.API_BASE_URL = isLocal ? 'http://localhost:5100' : 'https://eventflow-system.onrender.com';
    console.log('[Config] API via ambiente:', window.API_BASE_URL, 'Host:', host);
    // Injetar favicon padronizado (corrige 404 /favicon.ico no GitHub Pages)
    try {
      var hasFavicon = document.querySelector('link[rel="icon"]');
      if (!hasFavicon && typeof location !== 'undefined') {
        var parts = String(location.pathname || '').split('/').filter(Boolean);
        var projectRoot = parts.length > 0 ? ('/' + parts[0]) : '';
        var href = (projectRoot || '') + '/favicon.svg';
        var link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = href;
        document.head && document.head.appendChild(link);
      }
    } catch (_) {}
    // Define GOOGLE_CLIENT_ID padrão em produção caso não esteja setado
    if (!isLocal) {
      var defaultProdGoogleClientId = '659805758572-mmkqsk3oib6r63mpone8e716bjceu8qq.apps.googleusercontent.com';
      if (!window.GOOGLE_CLIENT_ID) {
        window.GOOGLE_CLIENT_ID = defaultProdGoogleClientId;
        console.log('[Config] GOOGLE_CLIENT_ID (prod):', window.GOOGLE_CLIENT_ID);
      }
    }
  } catch (e) {
    window.API_BASE_URL = 'https://eventflow-system.onrender.com';
  }
})();

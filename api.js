(function(){
  const DEFAULT_BASE = 'http://localhost:5000';
  const BASE_URL = (window.API_BASE_URL || localStorage.getItem('API_BASE_URL') || DEFAULT_BASE).replace(/\/$/, '');

  function getToken(){
    try { return localStorage.getItem('token'); } catch(e){ return null; }
  }
  function setToken(t){ try { localStorage.setItem('token', t); } catch(e){} }
  function clearToken(){ try { localStorage.removeItem('token'); } catch(e){} }

  async function apiFetch(path, options = {}, { auth = false } = {}){
    const url = path.startsWith('http') ? path : `${BASE_URL}/api${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (auth){
      const token = getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }
    const opts = Object.assign({}, options, { headers });
    const res = await fetch(url, opts);
    if (res.status === 401){
      // token inválido/ausente
      clearToken();
      // Redirecionar mantendo UX simples
      if (!location.pathname.endsWith('login-firebase.html')) {
        location.href = 'login-firebase.html';
      }
      throw new Error('Não autorizado');
    }
    return res;
  }

  async function requireVerified(){
    // Verificação desativada: sempre permitir
    return true;
  }

  const api = {
    url: BASE_URL,
    origin: (typeof location !== 'undefined' ? location.origin : ''),
    token: { get: getToken, set: setToken, clear: clearToken },
    fetch: apiFetch,
    get: (path, { auth = false } = {}) => apiFetch(path, { method: 'GET' }, { auth }),
    post: (path, body, { auth = false } = {}) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }, { auth }),
    put: (path, body, { auth = false } = {}) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }, { auth }),
    del: (path, { auth = false } = {}) => apiFetch(path, { method: 'DELETE' }, { auth }),
    requireAuth: () => { if (!getToken()) location.href = 'login-firebase.html'; },
    requireVerified,
    health: async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        return { ok: res.ok, data };
      } catch (e) {
        return { ok: false, error: e && e.message ? e.message : 'Failed to fetch' };
      }
    }
  };

  try {
    console.log('[API] Base:', BASE_URL, 'Origin:', api.origin);
  } catch (e) {}

  window.api = api;
})();

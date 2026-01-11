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

// Utilitários de data/hora em Horário de Brasília
(function(){
  try {
    window.BR_TZ = 'America/Sao_Paulo';
    window.formatBRDateTime = function(date, opts){
      try { return new Date(date).toLocaleString('pt-BR', Object.assign({ timeZone: window.BR_TZ }, opts||{})); }
      catch(e){ return new Date(date).toLocaleString('pt-BR'); }
    };
    window.formatBRTime = function(date){
      try { return new Date(date).toLocaleTimeString('pt-BR', { timeZone: window.BR_TZ, hour: '2-digit', minute: '2-digit' }); }
      catch(e){ var d = new Date(date); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); }
    };
    window.initBRClock = function(selector){
      function tick(){
        var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
        if (!el) return;
        el.textContent = new Date().toLocaleString('pt-BR', { timeZone: window.BR_TZ, dateStyle: 'short', timeStyle: 'medium' });
      }
      tick();
      return setInterval(tick, 1000);
    };
    document.addEventListener('DOMContentLoaded', function(){
      try { if (document.getElementById('brClock')) window.initBRClock('#brClock'); } catch(_) {}
      try { if (document.getElementById('brClockChat')) window.initBRClock('#brClockChat'); } catch(_) {}
    });
  } catch(_) {}
})();

// Registro de Service Worker e fila offline simples para eventos
(function(){
  try {
    // Registra Service Worker com caminho relativo ao projeto
    if ('serviceWorker' in navigator) {
      var parts = String(location.pathname || '').split('/').filter(Boolean);
      var projectRoot = parts.length > 0 ? ('/' + parts[0]) : '';
      var swPath = (projectRoot || '') + '/sw.js';
      navigator.serviceWorker.register(swPath).then(function(reg){
        console.log('[SW] registrado:', swPath);
      }).catch(function(err){ console.warn('[SW] falha ao registrar', err); });
    }

    // Fila offline básica para mutações de eventos
    var QUEUE_KEY = 'eventflow_offline_queue';
    var changeHandlers = [];
    function readQueue(){ try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(_) { return []; } }
    function writeQueue(q){ try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch(_) {} try { changeHandlers.forEach(function(h){ h({ pending: q.length, syncing: syncing }); }); } catch(_) {} }

    var syncing = false;
    async function flushQueue(){
      var q = readQueue();
      if (!Array.isArray(q) || q.length === 0) return;
      var next = [];
      syncing = true; try { changeHandlers.forEach(function(h){ h({ pending: q.length, syncing: syncing }); }); } catch(_) {}
      for (var i=0;i<q.length;i++){
        var item = q[i];
        try {
          var opts = { method: item.method, headers: { 'Content-Type': 'application/json' } };
          if (item.auth && window.api && window.api.token.get()) {
            opts.headers['Authorization'] = 'Bearer ' + window.api.token.get();
          }
          if (item.body) opts.body = JSON.stringify(item.body);
          var res = await fetch((window.api ? (window.api.url + '/api' + item.path) : (window.API_BASE_URL.replace(/\/$/,'') + '/api' + item.path)), opts);
          if (!res.ok) throw new Error('Falha ao enviar '+item.method+' '+item.path+' (HTTP '+res.status+')');
          // Atualiza eventos locais após sucesso
          try { typeof syncEventsFromBackend === 'function' && await syncEventsFromBackend(); } catch(_) {}
        } catch (e) {
          var msg = e && e.message ? String(e.message) : '';
          if (msg.includes('HTTP 403')) {
            console.warn('[offlineQueue] descartando item por 403 (sem permissão):', item.path);
            // Não re-enfileira 403 para evitar loops
          } else {
            console.warn('[offlineQueue] manter item na fila', item.path, e && e.message);
            next.push(item);
          }
        }
      }
      writeQueue(next);
      syncing = false; try { changeHandlers.forEach(function(h){ h({ pending: next.length, syncing: syncing }); }); } catch(_) {}
    }

    window.offlineQueue = {
      enqueue: function(method, path, body, { auth = true } = {}){
        var q = readQueue();
        q.push({ method: method, path: path, body: body || null, auth: !!auth, at: Date.now() });
        writeQueue(q);
        console.log('[offlineQueue] enfileirado', method, path);
      },
      flush: flushQueue,
      getQueue: function(){ return readQueue(); },
      onChange: function(handler){ if (typeof handler === 'function') changeHandlers.push(handler); }
    };

    window.addEventListener('online', function(){ flushQueue(); });
    document.addEventListener('DOMContentLoaded', function(){ flushQueue(); });
  } catch(_) {}
})();

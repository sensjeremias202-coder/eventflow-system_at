// Shim de dados para evitar 404 em pages que referenciam data.js
// EventflowData é definido em script.js; aqui apenas garantimos que exista.
(function(){
  try {
    if (!window.EventflowData) {
      window.EventflowData = { events: [], attendees: [], notifications: [], user: {} };
    }
    // Sincroniza com localStorage se existir
    var saved = null;
    try { saved = localStorage.getItem('eventflowData'); } catch(_) {}
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        Object.assign(window.EventflowData, parsed || {});
      } catch (_) {}
    }
  } catch (_) {}
})();

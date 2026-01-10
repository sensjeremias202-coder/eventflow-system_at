/*
E2E: testa entrega em tempo real entre Alice e Bruno
- Faz login via REST para obter JWTs
- Garante/Cria DM via REST
- Conecta 2 clientes Socket.IO e verifica recebimento de mensagem
*/

const { io } = require('socket.io-client');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5100';

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`login failed (${email}): ${res.status} ${t}`);
  }
  return res.json();
}

async function register(name, email, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  // Pode retornar 201 (criado) ou 400 (já existe) dependendo do backend
  if (res.ok) return true;
  const txt = await res.text();
  if (res.status === 400 && /já cadastrado|cadastrado/i.test(txt)) return true;
  return false;
}

async function ensureDM(token, userId) {
  const res = await fetch(`${BASE}/api/chat/conversations/dm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ensureDM failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.conversation._id;
}

async function getUsers(token) {
  const res = await fetch(`${BASE}/api/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`getUsers failed: ${res.status} ${t}`);
  }
  return res.json();
}

function waitFor(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

(async () => {
  try {
    // 0) Garantir usuários (modo memória/local)
    await register('Alice Souza', 'alice@example.com', '123456');
    await register('Bruno Lima', 'bruno@example.com', '123456');

    // 1) Logins
    const a = await login('alice@example.com', '123456');
    const b = await login('bruno@example.com', '123456');

    // 2) Buscar id do Bruno para criar DM
    const users = await getUsers(a.token);
    const bruno = (users.users || users).find(u => /bruno@/i.test(u.email));
    if (!bruno) throw new Error('Bruno não encontrado na lista de usuários');

    // 3) Garantir DM
    const convId = await ensureDM(a.token, bruno._id || bruno.id);

    // 4) Conectar Sockets
    const sa = io(BASE, { auth: { token: a.token } });
    const sb = io(BASE, { auth: { token: b.token } });

    await Promise.all([
      new Promise((res, rej) => { sa.on('connect', res); sa.on('connect_error', rej); }),
      new Promise((res, rej) => { sb.on('connect', res); sb.on('connect_error', rej); })
    ]);

    // 5) Assegurar recebimento de history ao entrar (opcional)
    sa.emit('chat:join', { conversationId: convId });
    sb.emit('chat:join', { conversationId: convId });
    // Aguarda histórico para garantir que ambos entraram na sala
    await Promise.all([
      waitFor(sa, 'chat:history', 2000).catch(()=>{}),
      waitFor(sb, 'chat:history', 2000).catch(()=>{})
    ]);

    // 6) Enviar mensagem de Alice e aguardar em Bruno
    const text = `ping-${Date.now()}`;
    const got = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('Bruno não recebeu mensagem em 5s')), 5000);
      sb.on('chat:message', (payload) => {
        if (payload && String(payload.conversationId) === String(convId) && payload.message && payload.message.text === text) {
          clearTimeout(to);
          resolve(payload);
        }
      });
    });

    sa.emit('chat:message', { conversationId: convId, text, clientId: `test-${Date.now()}` });
    const received = await got;

    console.log('OK: Bruno recebeu mensagem:', received.message);

    // 7) Responder de Bruno e aguardar em Alice
    const reply = `pong-${Date.now()}`;
    const got2 = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('Alice não recebeu mensagem em 5s')), 5000);
      sa.on('chat:message', (payload) => {
        if (payload && String(payload.conversationId) === String(convId) && payload.message && payload.message.text === reply) {
          clearTimeout(to);
          resolve(payload);
        }
      });
    });

    sb.emit('chat:message', { conversationId: convId, text: reply, clientId: `test-${Date.now()}` });
    const received2 = await got2;

    console.log('OK: Alice recebeu mensagem:', received2.message);

    sa.close();
    sb.close();

    console.log('E2E chat: SUCESSO');
    process.exit(0);
  } catch (e) {
    console.error('E2E chat: FALHA:', e.message);
    process.exit(1);
  }
})();

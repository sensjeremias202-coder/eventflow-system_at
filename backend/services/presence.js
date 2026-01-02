// Serviço simples de presença em memória
const onlineUsers = new Set();
const lastSeen = new Map();

function markOnline(userId){
  const id = String(userId);
  onlineUsers.add(id);
}

function markOffline(userId){
  const id = String(userId);
  onlineUsers.delete(id);
  lastSeen.set(id, Date.now());
}

function isOnline(userId){
  return onlineUsers.has(String(userId));
}

function getLastSeen(userId){
  const ts = lastSeen.get(String(userId));
  return ts ? new Date(ts) : null;
}

function getOnlineUsers(){
  return Array.from(onlineUsers);
}

module.exports = { markOnline, markOffline, isOnline, getLastSeen, getOnlineUsers };

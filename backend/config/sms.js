const twilio = (() => { try { return require('twilio'); } catch(_) { return null; } })();

function getClient(){
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (twilio && sid && token) {
    try { return twilio(sid, token); } catch(_) { return null; }
  }
  return null;
}

async function sendSMS(to, body){
  if (!to) throw new Error('Telefone é obrigatório');
  const client = getClient();
  if (client && process.env.TWILIO_FROM_NUMBER){
    try {
      const msg = await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body });
      return { ok: true, sid: msg.sid };
    } catch(e){
      console.warn('[SMS] Falha ao enviar via Twilio, fallback para console:', e && e.message ? e.message : e);
    }
  }
  // Fallback de desenvolvimento: loga no console
  console.log(`[SMS] Enviar para ${to}: ${body}`);
  return { ok: true, sid: null, dev: true };
}

module.exports = { sendSMS };

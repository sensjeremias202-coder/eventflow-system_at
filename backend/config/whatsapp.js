const twilio = (() => { try { return require('twilio'); } catch(_) { return null; } })();

function getClient(){
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (twilio && sid && token) {
    try { return twilio(sid, token); } catch(_) { return null; }
  }
  return null;
}

// Envia mensagem WhatsApp usando Twilio se configurado; caso contrário, loga no console
async function sendWhatsApp(to, body){
  if (!to) throw new Error('Telefone é obrigatório');
  const client = getClient();
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  if (client) {
    try {
      const msg = await client.messages.create({ to: `whatsapp:${to}`, from, body });
      return { ok: true, sid: msg.sid };
    } catch(e){
      console.warn('[WhatsApp] Falha ao enviar via Twilio, fallback para console:', e && e.message ? e.message : e);
    }
  }
  console.log(`[WhatsApp] Enviar para ${to}: ${body}`);
  return { ok: true, sid: null, dev: true };
}

module.exports = { sendWhatsApp };

const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE || '').toLowerCase() === 'true' || Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } else {
    // Fallback: loga no console ao invés de enviar
    transporter = {
      sendMail: async (opts) => {
        console.log('📧 [FAKE EMAIL - SMTP não configurado]');
        console.log('Para:', opts.to);
        console.log('Assunto:', opts.subject);
        console.log('HTML:', opts.html);
        return { messageId: 'console-log' };
      }
    };
  }

  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  return t.sendMail({ from: process.env.MAIL_FROM || 'no-reply@eventflow.local', to, subject, html });
}

module.exports = { sendMail };

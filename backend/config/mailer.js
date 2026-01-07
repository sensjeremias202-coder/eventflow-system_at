const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_URL,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    NODE_ENV,
    STRICT_SMTP
  } = process.env;

  const isProd = String(NODE_ENV || '').toLowerCase() === 'production';
  const mustBeStrict = String(STRICT_SMTP || '').toLowerCase() === 'true' || isProd;

  if (SMTP_URL) {
    transporter = nodemailer.createTransport(SMTP_URL);
  } else if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure:
        String(SMTP_SECURE || '').toLowerCase() === 'true' || Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } else if (mustBeStrict) {
    throw new Error(
      'SMTP não configurado. Defina SMTP_URL ou SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (STRICT_SMTP/NODE_ENV=production)'
    );
  } else {
    // Fallback: loga no console ao invés de enviar (apenas dev)
    transporter = {
      sendMail: async (opts) => {
        console.log('📧 [FAKE EMAIL - SMTP não configurado]');
        console.log('Para:', opts.to);
        console.log('Assunto:', opts.subject);
        console.log('HTML:', opts.html);
        return { messageId: 'console-log' };
      },
    };
  }

  return transporter;
}

async function sendMail({ to, subject, html }) {
  const from = process.env.MAIL_FROM || 'no-reply@eventflow.local';
  const t = getTransporter();
  return t.sendMail({ from, to, subject, html });
}

module.exports = { sendMail };

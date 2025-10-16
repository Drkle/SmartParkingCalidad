// server/Utils/sendEmail2.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  throw new Error('Faltan variables SMTP en .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: String(SMTP_SECURE).toLowerCase() === 'true', // true=465, false=587
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

/**
 * Envía un correo.
 * @param {{subject:string, receiverMail:string, html:string, from?:string}} mailData
 */
async function sendEmail2(mailData) {
  const { subject, receiverMail, html, from } = mailData;

  const info = await transporter.sendMail({
    from: from || `"Smart Parking" <${SMTP_USER}>`,
    to: receiverMail,
    subject,
    html,
  });

  console.log('Mail sent:', info.messageId);
  return info.messageId;
}

module.exports = sendEmail2;

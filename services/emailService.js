// services/emailService.js
// Sends email through any SMTP provider (Nodemailer). Currently Brevo; switching to Gmail
// or a provider on a custom domain only means changing the environment variables:
//   SMTP_HOST   e.g. smtp-relay.brevo.com
//   SMTP_PORT   587 (STARTTLS) or 465 (TLS); defaults to 587
//   SMTP_USER   the provider's SMTP login
//   SMTP_PASS   the provider's SMTP key or app password
//   EMAIL_FROM  sender shown to users, e.g. "KitchenWise <you@gmail.com>"; the address
//               must be a sender the provider has verified
// Never log SMTP_USER/SMTP_PASS or the message body (it contains login codes and reset tokens).
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter = null;

const getTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
        throw new Error('Email is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM.');
    }
    if (!transporter) {
        const port = Number(SMTP_PORT) || 587;
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port,
            secure: port === 465, // 587 upgrades to TLS with STARTTLS
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });
    }
    return transporter;
};

const emailService = {
    // Throws if the provider does not accept the message, so callers can report failure.
    sendEmail: async (toEmail, subject, messageInHtml) => {
        const mailer = getTransporter();
        return await mailer.sendMail({ from: process.env.EMAIL_FROM, to: toEmail, subject, html: messageInHtml });
    },
};

export default emailService;

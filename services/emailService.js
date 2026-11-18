// services/emailService.js
// Sends email through a dedicated Gmail account over SMTP (Nodemailer).
// GMAIL_USER is the app's Gmail address; GMAIL_APP_PASSWORD is a Google "app password"
// (16 characters, requires 2-Step Verification), not the account's normal password.
// Never log either value, or the message body (it contains login codes and reset tokens).
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter = null;

const getTransporter = () => {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
        throw new Error('Email is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD.');
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    }
    return transporter;
};

const emailService = {
    // Throws if the message could not be handed to Gmail, so callers can report failure.
    sendEmail: async (toEmail, subject, messageInHtml) => {
        const from = `KitchenWise <${process.env.GMAIL_USER}>`;
        return await getTransporter().sendMail({ from, to: toEmail, subject, html: messageInHtml });
    },
};

export default emailService;

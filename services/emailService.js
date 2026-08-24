import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

const emailService = {
    sendEmail: async (toEmail, subject, messageInHtml) => {
        return await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: toEmail,
            subject: subject,
            html: messageInHtml,
        });
    },
    receiveEmail: async () => {
        return await resend.emails.list();
    }
}

export default emailService;
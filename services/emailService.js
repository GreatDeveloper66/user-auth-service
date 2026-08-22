import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

const sendEmail = (toEmail, subject, messageInHtml) => {
    return resend.emails.send({
        from: 'onboarding@resend.dev',
        to: toEmail,
        subject: subject,
        html:messageInHtml,
    });
};

export default sendEmail;;



// resend.emails.send({
//   from: 'onboarding@resend.dev',
//   to: 'ashaffe@gmail.com',
//   subject: 'Hello World',
//   html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
// });
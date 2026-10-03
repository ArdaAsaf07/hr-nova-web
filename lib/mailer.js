const nodemailer = require("nodemailer");

function isMailConfigured() {
    const resendConfigured = Boolean(
        process.env.RESEND_API_KEY && process.env.MAIL_FROM
    );
    const smtpConfigured = Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.MAIL_FROM
    );
    return resendConfigured || smtpConfigured;
}

function createTransporter() {
    if (!isMailConfigured()) {
        throw new Error("SMTP ayarları tamamlanmadı.");
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

async function sendMail({ to, subject, text }) {
    if (process.env.RESEND_API_KEY) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(`Resend API hatası (${response.status}): ${result.message || "Mail gönderilemedi."}`);
        }
        return result;
    }
    const transporter = createTransporter();

    return transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        text
    });
}

module.exports = {
    isMailConfigured,
    sendMail
};

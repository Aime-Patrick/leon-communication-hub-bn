import nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const sendEmail = async (options: EmailOptions): Promise<void> => {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send email');
    }
}; 
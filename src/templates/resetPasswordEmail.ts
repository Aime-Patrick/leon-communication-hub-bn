export const getResetPasswordEmailTemplate = (resetUrl: string, userName: string) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Reset Your Password</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .container {
                    background-color: #f9f9f9;
                    border-radius: 5px;
                    padding: 20px;
                    border: 1px solid #ddd;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #4F46E5;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Password Reset Request</h2>
                </div>
                <p>Hello ${userName},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <p style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset Password</a>
                </p>
                <p>If you didn't request this password reset, you can safely ignore this email.</p>
                <p>This password reset link will expire in 1 hour.</p>
                <div class="footer">
                    <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
                    <p>${resetUrl}</p>
                </div>
            </div>
        </body>
        </html>
    `;
}; 
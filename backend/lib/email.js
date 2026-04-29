import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"WorkFlow" <${process.env.SMTP_FROM || "noreply@workflow.dev"}>`;
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function escapeHtml(str) {
  return (
    str?.replaceAll(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ) || ""
  );
}

export async function sendOtpEmail(email, code, purpose) {
  const subject =
    purpose === "login"
      ? "Your login code"
      : purpose === "verifyEmail"
        ? "Verify your email"
        : "Reset your password";

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'SF Mono', monospace; background: #0f1117; color: #e8ecf4; padding: 40px 20px; margin: 0">
        <div style="max-width: 480px; margin: 0 auto; background: #161b27; border: 1px solid #2a3347; border-radius: 12px; padding: 40px">
          <div style="font-size: 24px; font-weight: 700; color: #9d8ff9; margin-bottom: 8px">⬡ WorkFlow</div>
          <h2 style="color: #e8ecf4; margin: 0 0 16px; font-size: 18px">${subject}</h2>
          <p style="color: #8892a8; margin: 0 0 24px; font-size: 14px; line-height: 1.6">
            Use the code below to continue. It expires in <strong style="color:#e8ecf4">5 minutes</strong>.
          </p>
          <div style="background: #0f1117; border: 1px solid #2a3347; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #9d8ff9">${code}</span>
          </div>
          <p style="color: #5a6580; font-size: 12px; margin: 0">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendWelcomeEmail(email, name) {
  const safeName = escapeHtml(name) || "there";
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Welcome to WorkFlow",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'SF Mono', monospace; background: #0f1117; color: #e8ecf4; padding: 40px 20px; margin: 0">
        <div style="max-width: 480px; margin: 0 auto; background: #161b27; border: 1px solid #2a3347; border-radius: 12px; padding: 40px">
          <div style="font-size: 24px; font-weight: 700; color: #9d8ff9; margin-bottom: 8px">⬡ WorkFlow</div>
          <h2 style="color: #e8ecf4; margin: 0 0 16px">Welcome, ${safeName} 👋</h2>
          <p style="color: #8892a8; font-size: 14px; line-height: 1.6; margin: 0 0 24px">
            Your account is ready. Start building your first AI-generated project.
          </p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#7c6df8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
            Go to dashboard →
          </a>
        </div>
      </body>
      </html>
    `,
  });
}

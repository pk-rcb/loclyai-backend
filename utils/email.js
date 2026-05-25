import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a password reset email with a styled HTML template.
 */
export async function sendPasswordResetEmail(toEmail, resetLink) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.06); overflow:hidden;">
              
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#ec4899); padding:32px 24px; text-align:center;">
                  <span style="font-size:32px;">🌍</span>
                  <h1 style="color:#ffffff; font-size:24px; font-weight:800; margin:8px 0 4px; letter-spacing:-0.02em;">LoclyAI</h1>
                  <p style="color:rgba(255,255,255,0.85); font-size:14px; margin:0;">Your city, fixed faster.</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px 24px;">
                  <h2 style="color:#0f172a; font-size:20px; font-weight:700; margin:0 0 12px;">Password Reset Request</h2>
                  <p style="color:#64748b; font-size:15px; line-height:1.6; margin:0 0 24px;">
                    We received a request to reset your password. Click the button below to create a new password. This link expires in <strong>1 hour</strong>.
                  </p>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:8px 0 24px;">
                        <a href="${resetLink}" 
                           style="display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#7c3aed,#ec4899); color:#ffffff; font-size:16px; font-weight:700; text-decoration:none; border-radius:10px; box-shadow:0 4px 14px rgba(124,58,237,0.3);">
                          Reset My Password
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0 0 16px;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="color:#7c3aed; font-size:13px; word-break:break-all; background:#f1f5f9; padding:12px; border-radius:8px; margin:0 0 24px;">
                    ${resetLink}
                  </p>

                  <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">

                  <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0;">
                    If you didn't request this, you can safely ignore this email. Your password will not change.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc; padding:20px 24px; text-align:center; border-top:1px solid #e2e8f0;">
                  <p style="color:#94a3b8; font-size:12px; margin:0;">
                    © ${new Date().getFullYear()} LoclyAI — Making cities better, together.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'LoclyAI <onboarding@resend.dev>',
    to: [toEmail],
    subject: 'LoclyAI — Reset Your Password',
    html,
  });

  if (error) {
    console.error('Resend email error:', error);
    throw new Error(error.message);
  }

  console.log('📧 Email sent successfully, ID:', data.id);
  return data;
}

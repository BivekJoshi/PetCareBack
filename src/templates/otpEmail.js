// Branded HTML (+ plain-text) template for the sign-up email OTP. Kept as a
// single self-contained function so the mail service can render it with no
// external assets. Inline styles only — email clients ignore <style> blocks.

const BRAND = '#0E9594'; // PetCare teal
const BRAND_DARK = '#0a6e6d';

export const otpEmail = ({ code, firstName, ttlMinutes = 10 }) => {
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const spaced = String(code).split('').join('&nbsp;&nbsp;');

  const subject = `${code} is your PetCare verification code`;

  const text =
    `${greeting}\n\n` +
    `Your PetCare verification code is ${code}.\n` +
    `It expires in ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.\n\n` +
    `— The PetCare Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px -12px rgba(16,24,40,.25);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});padding:28px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.3px;">🐾 PetCare</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#101828;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475467;">
            Use the verification code below to confirm your email and finish setting up your PetCare account.
          </p>
          <div style="margin:0 0 24px;padding:18px;text-align:center;background:#f0fbfa;border:1px solid #cdeeed;border-radius:12px;">
            <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:${BRAND_DARK};">${spaced}</div>
          </div>
          <p style="margin:0 0 6px;font-size:13px;color:#475467;">
            This code expires in <strong>${ttlMinutes} minutes</strong>.
          </p>
          <p style="margin:0;font-size:13px;color:#98a2b3;">
            Didn't try to sign up? You can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eef0f2;">
          <p style="margin:0;font-size:12px;color:#98a2b3;">© PetCare · This is an automated message, please don't reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
};

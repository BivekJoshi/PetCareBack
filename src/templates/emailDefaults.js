// Default transactional-email templates. These are the seed/fallback content
// for the editable templates in the admin Control Panel: when no DB row exists
// for a key (or the admin clicks "Reset to default"), this content is used.
//
// The `html` and `subject` are stored in the DB and editable; the mailer fills
// the {{tokens}} per send. `text` (the plain-text alternative) and the token
// catalogue are not edited in the UI and live only here.

const shell = (bodyParagraph, footerNote) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px -12px rgba(16,24,40,.25);">
        <tr><td style="background:linear-gradient(135deg,#0E9594,#0a6e6d);padding:28px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.3px;">🐾 PetCare</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#101828;">{{greeting}}</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475467;">
            ${bodyParagraph}
          </p>
          <div style="margin:0 0 24px;padding:18px;text-align:center;background:#f0fbfa;border:1px solid #cdeeed;border-radius:12px;">
            <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#0a6e6d;">{{spacedCode}}</div>
          </div>
          <p style="margin:0 0 6px;font-size:13px;color:#475467;">
            This code expires in <strong>{{ttlMinutes}} minutes</strong>.
          </p>
          <p style="margin:0;font-size:13px;color:#98a2b3;">
            ${footerNote}
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eef0f2;">
          <p style="margin:0;font-size:12px;color:#98a2b3;">© PetCare · This is an automated message, please don't reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// Tokens an editor may use, surfaced in the UI as a quick reference.
const TOKENS = [
  { token: '{{greeting}}', description: 'Greeting line, e.g. "Hi Jane," (or "Hello,")' },
  { token: '{{spacedCode}}', description: 'The 6-digit code, spaced out for the big display' },
  { token: '{{code}}', description: 'The raw 6-digit code (handy in the subject line)' },
  { token: '{{ttlMinutes}}', description: 'Minutes until the code expires' },
];

export const EMAIL_TEMPLATE_DEFAULTS = {
  otp: {
    key: 'otp',
    name: 'Email verification code',
    description: 'Sent when a new user verifies their email address at sign-up.',
    subject: '{{code}} is your PetCare verification code',
    html: shell(
      'Use the verification code below to confirm your email and finish setting up your PetCare account.',
      "Didn't try to sign up? You can safely ignore this email.",
    ),
    text:
      '{{greeting}}\n\n' +
      'Your PetCare verification code is {{code}}.\n' +
      "It expires in {{ttlMinutes}} minutes. If you didn't request this, you can ignore this email.\n\n" +
      '— The PetCare Team',
    tokens: TOKENS,
  },
  'password-reset': {
    key: 'password-reset',
    name: 'Password reset code',
    description: 'Sent when a user requests a password reset from "Forgot password".',
    subject: '{{code}} is your PetCare password reset code',
    html: shell(
      'We received a request to reset your PetCare password. Enter the code below to choose a new one.',
      "Didn't request a reset? You can safely ignore this email — your password won't change.",
    ),
    text:
      '{{greeting}}\n\n' +
      'We received a request to reset your PetCare password.\n' +
      'Your reset code is {{code}}. It expires in {{ttlMinutes}} minutes.\n' +
      "If you didn't request this, you can safely ignore this email — your password stays unchanged.\n\n" +
      '— The PetCare Team',
    tokens: TOKENS,
  },
};

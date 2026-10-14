import { emailTheme } from "./email-theme";

const { color, font } = emailTheme;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

export function renderConfirmationEmailHtml(confirmUrl: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background-color: ${color.background}; font-family: ${font.body};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${color.background};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: ${color.card}; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 28px 32px; border-bottom: 3px solid ${color.primary};">
                <span style="font-family: ${font.heading}; font-size: 26px; font-weight: bold; color: ${color.primary};">RealtyPulse</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px 32px 8px;">
                <p style="margin: 0 0 20px; font-family: ${font.body}; font-size: 15px; line-height: 1.6; color: ${color.foreground};">Confirm your subscription to RealtyPulse's weekly market updates by clicking the button below:</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius: 8px; background-color: ${color.primary};">
                      <a href="${escapeAttr(confirmUrl)}" style="display: inline-block; padding: 12px 24px; font-family: ${font.body}; font-size: 15px; font-weight: bold; color: ${color.onPrimary}; text-decoration: none;">Confirm my subscription</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid ${color.border};">
                  <tr>
                    <td style="padding-top: 16px; font-family: ${font.body}; color: ${color.mutedForeground}; font-size: 12px; line-height: 1.6;">
                      If you didn't request this, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

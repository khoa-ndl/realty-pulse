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
  <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
    <table role="presentation" width="100%" style="background-color: #f5f5f5;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" style="background-color: #ffffff;">
            <tr>
              <td style="padding: 24px; background-color: #1a3c34; color: #ffffff;">
                <h1 style="margin: 0; font-size: 22px;">RealtyPulse</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; color: #333;">
                <p style="margin: 0 0 16px;">Confirm your subscription to RealtyPulse's weekly market updates by clicking the link below:</p>
                <p style="margin: 0;"><a href="${escapeAttr(confirmUrl)}" style="color: #1a3c34; font-weight: bold;">Confirm my subscription</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; color: #888; font-size: 12px; border-top: 1px solid #eee;">
                <p style="margin: 0;">If you didn't request this, you can safely ignore this email.</p>
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

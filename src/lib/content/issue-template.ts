import type { StoredListing } from "./issue-store";
import { emailTheme } from "./email-theme";

const { color, font } = emailTheme;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function renderListing(listing: StoredListing, isFirst: boolean): string {
  const columnWidth = `${(100 / listing.photoUrls.length).toFixed(2)}%`;
  const photos = listing.photoUrls
    .map(
      (url, i) =>
        `<td width="${columnWidth}" style="padding: ${i === 0 ? "0" : "0 0 0 8px"};"><img src="${escapeAttr(url)}" width="100%" alt="Property photo" style="display: block; width: 100%; height: auto; border-radius: 8px;" /></td>`
    )
    .join("");

  return `
    <tr>
      <td style="padding: ${isFirst ? "0" : "16px"} 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${color.border}; border-radius: 12px; background-color: ${color.card};">
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${photos}</tr></table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 14px; font-family: ${font.data}; font-size: 13px;">
                <tr>
                  <td style="padding-right: 12px; font-weight: bold; color: ${color.primary};">$${listing.price.toLocaleString("en-US")}</td>
                  <td style="padding-right: 12px; color: ${color.mutedForeground};">${listing.beds} bd</td>
                  <td style="padding-right: 12px; color: ${color.mutedForeground};">${listing.baths} ba</td>
                  <td style="color: ${color.mutedForeground};">${listing.sqft.toLocaleString("en-US")} sqft</td>
                </tr>
              </table>
              <p style="margin: 12px 0 0; font-family: ${font.heading}; font-size: 17px; font-weight: bold; color: ${color.foreground};">${escapeHtml(listing.address)}</p>
              <p style="margin: 6px 0 0; font-family: ${font.body}; font-size: 14px; line-height: 1.6; color: ${color.foreground};">${escapeHtml(listing.blurb)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export function renderIssueHtml(content: {
  marketCommentary: string;
  listings: StoredListing[];
  baseUrl: string;
}): string {
  const listingRows = content.listings.map((listing, i) => renderListing(listing, i === 0)).join("");
  const unsubscribeUrl = `${content.baseUrl}/unsubscribe?email={{SUBSCRIBER_EMAIL}}`;

  return `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background-color: ${color.background}; font-family: ${font.body};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${color.background};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: ${color.card}; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 28px 32px 20px; border-bottom: 3px solid ${color.primary};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family: ${font.heading}; font-size: 26px; font-weight: bold; color: ${color.primary};">RealtyPulse</td>
                    <td align="right" style="font-family: ${font.data}; font-size: 11px; letter-spacing: 0.06em; color: ${color.mutedForeground}; text-transform: uppercase;">Seattle Market Weekly</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 4px;">
                <p style="margin: 0 0 8px; font-family: ${font.data}; font-size: 11px; letter-spacing: 0.06em; color: ${color.secondary}; text-transform: uppercase;">Market Snapshot</p>
                <p style="margin: 0; padding-left: 14px; border-left: 3px solid ${color.muted}; font-family: ${font.body}; font-size: 15px; line-height: 1.6; color: ${color.foreground};">${escapeHtml(content.marketCommentary)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 10px;">
                <p style="margin: 0; font-family: ${font.data}; font-size: 11px; letter-spacing: 0.06em; color: ${color.secondary}; text-transform: uppercase;">Spotlight Listings</p>
              </td>
            </tr>
            ${listingRows}
            <tr>
              <td style="padding: 28px 32px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid ${color.border};">
                  <tr>
                    <td style="padding-top: 20px; font-family: ${font.body}; color: ${color.mutedForeground}; font-size: 12px; line-height: 1.6;">
                      <p style="margin: 0;">RealtyPulse, 123 Pike St, Seattle, WA 98101</p>
                      <p style="margin: 4px 0 0;"><a href="${unsubscribeUrl}" style="color: ${color.primary};">Unsubscribe</a></p>
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

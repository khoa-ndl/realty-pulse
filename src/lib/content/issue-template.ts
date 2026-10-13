import type { StoredListing } from "./issue-store";

function renderListing(listing: StoredListing): string {
  const photos = listing.photoUrls
    .map((url) => `<td style="padding: 4px;"><img src="${url}" width="150" alt="Property photo" style="border-radius: 6px;" /></td>`)
    .join("");

  return `
    <tr>
      <td style="padding: 16px 24px;">
        <table role="presentation" width="100%"><tr>${photos}</tr></table>
        <table role="presentation" style="margin-top: 8px; font-size: 14px; color: #444;">
          <tr>
            <td style="padding-right: 12px; font-weight: bold;">$${listing.price.toLocaleString("en-US")}</td>
            <td style="padding-right: 12px;">${listing.beds} bd</td>
            <td style="padding-right: 12px;">${listing.baths} ba</td>
            <td>${listing.sqft.toLocaleString("en-US")} sqft</td>
          </tr>
        </table>
        <p style="margin: 8px 0 0; font-weight: bold;">${listing.address}</p>
        <p style="margin: 4px 0 0; color: #333;">${listing.blurb}</p>
      </td>
    </tr>
  `;
}

export function renderIssueHtml(content: {
  marketCommentary: string;
  listings: StoredListing[];
  baseUrl: string;
}): string {
  const listingRows = content.listings.map(renderListing).join("");
  const unsubscribeUrl = `${content.baseUrl}/unsubscribe?email={{SUBSCRIBER_EMAIL}}`;

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
                <p style="margin: 4px 0 0; font-size: 13px;">Weekly market insights for Seattle buyers and sellers</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; color: #333;">
                <p style="margin: 0;">${content.marketCommentary}</p>
              </td>
            </tr>
            ${listingRows}
            <tr>
              <td style="padding: 16px 24px; color: #888; font-size: 12px; border-top: 1px solid #eee;">
                <p style="margin: 0;">RealtyPulse, 123 Pike St, Seattle, WA 98101</p>
                <p style="margin: 4px 0 0;"><a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe</a></p>
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

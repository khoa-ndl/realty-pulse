export function personalizeIssueHtml(html: string, email: string): string {
  return html.replaceAll("{{SUBSCRIBER_EMAIL}}", encodeURIComponent(email));
}

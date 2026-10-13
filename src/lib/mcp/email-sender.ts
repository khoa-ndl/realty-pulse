import { google } from "googleapis";
import type { Env } from "@/lib/env";

export interface EmailSender {
  sendEmail(to: string, subject: string, html: string): Promise<void>;
}

export interface GmailClient {
  sendRawMessage(raw: string): Promise<void>;
}

export function buildRawMimeMessage(opts: { to: string; subject: string; html: string }): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(opts.subject, "utf-8").toString("base64")}?=`;
  const message = [
    `To: ${opts.to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    opts.html,
  ].join("\r\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class GmailEmailSender implements EmailSender {
  constructor(private client: GmailClient) {}

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const raw = buildRawMimeMessage({ to, subject, html });
    await this.client.sendRawMessage(raw);
  }
}

export function createGmailClient(
  env: Pick<Env, "GMAIL_CLIENT_ID" | "GMAIL_CLIENT_SECRET" | "GMAIL_REFRESH_TOKEN">
): GmailClient {
  const oauth2Client = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return {
    async sendRawMessage(raw: string) {
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    },
  };
}

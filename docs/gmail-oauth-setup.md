# Gmail OAuth Setup (manual, one-time)

RealtyPulse's outbound MCP server sends email through the Gmail API using
OAuth2, not SMTP with a password. This is a one-time setup you run
yourself in a browser — it can't be automated, since the last step is a
Google consent screen tied to your own Google account.

## 1. Create a Google Cloud project and enable the Gmail API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a new project (or reuse one you already have).
2. In **APIs & Services → Library**, search for "Gmail API" and enable it.

## 2. Create an OAuth client

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**.
2. If prompted, configure the OAuth consent screen first: User type
   **External**, app name "RealtyPulse", your email as support/developer
   contact. You can leave it in "Testing" status — you don't need to
   publish it, since only your own Gmail account will authorize it.
3. Application type: **Web application**. Name it "RealtyPulse OAuth
   Playground". Under **Authorized redirect URIs**, add exactly:
   `https://developers.google.com/oauthplayground` — the OAuth Playground
   requires a Web application client with this redirect URI whitelisted;
   a Desktop app client doesn't expose a configurable redirect URI and
   will fail with `redirect_uri_mismatch` on the Playground.
4. Save the generated **Client ID** and **Client Secret** — these are
   `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `.env`.
5. On the consent screen's **Audience** tab, add the Gmail address you
   want RealtyPulse to send from under **Test users**. If the consent
   screen's **Publishing status** is "In production", click **Back to
   testing** first — the Test users section only appears in Testing mode.

## 3. Get a refresh token

Google's OAuth 2.0 Playground is the simplest way to do this without
writing a throwaway script:

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. Click the gear icon (top right) → check **Use your own OAuth
   credentials** → paste your Client ID and Client Secret from step 2.
   Do this *before* Authorize APIs, or Google issues the refresh token
   against its own shared Playground client instead of yours, which
   auto-revokes after 24h. Google only ever shows a client secret once,
   at creation time — if you lose it, you can't view it again from the
   Credentials page; click **+ Add secret** there to generate a new one.
3. In the left panel, find **Gmail API v1** and select the scope
   `https://www.googleapis.com/auth/gmail.send`.
4. Click **Authorize APIs**, sign in with the Gmail account you added as
   a test user, and approve.
5. Click **Exchange authorization code for tokens**.
6. Copy the **Refresh token** shown — this is `GMAIL_REFRESH_TOKEN` in
   `.env`.

## 4. Fill in `.env`

```
GMAIL_CLIENT_ID=<from step 2>
GMAIL_CLIENT_SECRET=<from step 2>
GMAIL_REFRESH_TOKEN=<from step 3>
```

The refresh token doesn't expire under normal use (the app stays in
"Testing" mode, which Google allows indefinitely for this kind of
single-user use case). If it ever stops working, repeat step 3.

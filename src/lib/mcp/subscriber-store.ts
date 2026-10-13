import type { SupabaseClient } from "@supabase/supabase-js";

export interface SubscriberRecord {
  email: string;
  source: string | null;
  subscribedAt: string;
}

// How long to wait before a repeat /subscribe submission for the same
// still-pending address gets a fresh token and a new confirmation email.
// Without this, repeatedly submitting any address (one's own, by mistake,
// or someone else's, maliciously) sends an unbounded stream of email.
const PENDING_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export interface SubscriberStore {
  addSubscriber(email: string, source?: string): Promise<void>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  removeSubscriber(email: string): Promise<void>;
  addPendingSubscriber(email: string, token: string, source?: string): Promise<"created" | "skipped">;
  confirmSubscriber(token: string): Promise<string | null>;
}

export interface SubscribersTable {
  upsertActive(email: string, source: string | null): Promise<void>;
  selectActive(): Promise<SubscriberRecord[]>;
  markUnsubscribed(email: string): Promise<void>;
  selectByEmail(
    email: string
  ): Promise<{ confirmedAt: string | null; unsubscribedAt: string | null; subscribedAt: string } | null>;
  insertPending(email: string, token: string, source: string | null): Promise<void>;
  confirmByToken(token: string): Promise<string | null>;
}

export class SupabaseSubscriberStore implements SubscriberStore {
  constructor(private table: SubscribersTable) {}

  addSubscriber(email: string, source?: string): Promise<void> {
    return this.table.upsertActive(email, source ?? null);
  }

  listSubscribers(): Promise<SubscriberRecord[]> {
    return this.table.selectActive();
  }

  removeSubscriber(email: string): Promise<void> {
    return this.table.markUnsubscribed(email);
  }

  async addPendingSubscriber(email: string, token: string, source?: string): Promise<"created" | "skipped"> {
    const existing = await this.table.selectByEmail(email);
    if (existing && existing.confirmedAt && !existing.unsubscribedAt) {
      return "skipped";
    }
    if (existing && !existing.confirmedAt && !existing.unsubscribedAt) {
      const ageMs = Date.now() - new Date(existing.subscribedAt).getTime();
      if (ageMs < PENDING_RESEND_COOLDOWN_MS) {
        return "skipped";
      }
    }
    await this.table.insertPending(email, token, source ?? null);
    return "created";
  }

  confirmSubscriber(token: string): Promise<string | null> {
    return this.table.confirmByToken(token);
  }
}

export function createSupabaseSubscribersTable(client: SupabaseClient): SubscribersTable {
  return {
    async upsertActive(email, source) {
      // Explicitly confirmed/un-tokened on every call, not left to the
      // confirmed_at column's default (which only applies to a brand-new
      // row) -- otherwise adding someone through this trusted admin path
      // while they have an unconfirmed public-signup row leaves them
      // silently stuck pending, even though the operator saw success.
      const { error } = await client.from("subscribers").upsert(
        {
          email,
          source,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
          confirmed_at: new Date().toISOString(),
          confirmation_token: null,
        },
        { onConflict: "email" }
      );
      if (error) throw new Error(`Failed to upsert subscriber: ${error.message}`);
    },
    async selectActive() {
      const { data, error } = await client
        .from("subscribers")
        .select("email, source, subscribed_at")
        .is("unsubscribed_at", null)
        .not("confirmed_at", "is", null);
      if (error) throw new Error(`Failed to list subscribers: ${error.message}`);
      return (data ?? []).map((row) => ({
        email: row.email,
        source: row.source,
        subscribedAt: row.subscribed_at,
      }));
    },
    async markUnsubscribed(email) {
      const { error } = await client
        .from("subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("email", email);
      if (error) throw new Error(`Failed to unsubscribe: ${error.message}`);
    },
    async selectByEmail(email) {
      const { data, error } = await client
        .from("subscribers")
        .select("confirmed_at, unsubscribed_at, subscribed_at")
        .eq("email", email)
        .maybeSingle();
      if (error) throw new Error(`Failed to look up subscriber: ${error.message}`);
      return data
        ? { confirmedAt: data.confirmed_at, unsubscribedAt: data.unsubscribed_at, subscribedAt: data.subscribed_at }
        : null;
    },
    async insertPending(email, token, source) {
      const { error } = await client.from("subscribers").upsert(
        {
          email,
          source,
          confirmed_at: null,
          confirmation_token: token,
          unsubscribed_at: null,
          subscribed_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
      if (error) throw new Error(`Failed to insert pending subscriber: ${error.message}`);
    },
    async confirmByToken(token) {
      const { data, error } = await client
        .from("subscribers")
        .update({ confirmed_at: new Date().toISOString(), confirmation_token: null })
        .eq("confirmation_token", token)
        .is("unsubscribed_at", null)
        .select("email")
        .maybeSingle();
      if (error) throw new Error(`Failed to confirm subscriber: ${error.message}`);
      return data?.email ?? null;
    },
  };
}

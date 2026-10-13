import type { SupabaseClient } from "@supabase/supabase-js";

export interface SubscriberRecord {
  email: string;
  source: string | null;
  subscribedAt: string;
}

export interface SubscriberStore {
  addSubscriber(email: string, source?: string): Promise<void>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  removeSubscriber(email: string): Promise<void>;
}

export interface SubscribersTable {
  upsertActive(email: string, source: string | null): Promise<void>;
  selectActive(): Promise<SubscriberRecord[]>;
  markUnsubscribed(email: string): Promise<void>;
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
}

export function createSupabaseSubscribersTable(client: SupabaseClient): SubscribersTable {
  return {
    async upsertActive(email, source) {
      const { error } = await client
        .from("subscribers")
        .upsert({ email, source, subscribed_at: new Date().toISOString(), unsubscribed_at: null }, { onConflict: "email" });
      if (error) throw new Error(`Failed to upsert subscriber: ${error.message}`);
    },
    async selectActive() {
      const { data, error } = await client
        .from("subscribers")
        .select("email, source, subscribed_at")
        .is("unsubscribed_at", null);
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
  };
}

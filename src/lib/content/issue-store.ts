import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoredListing {
  address: string;
  neighborhood: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  blurb: string;
  photoUrls: string[];
}

export interface NewIssue {
  html: string;
  triggerType: "scheduled" | "manual";
  marketSummary: string;
  listings: StoredListing[];
}

export interface IssueRecord extends NewIssue {
  id: string;
  createdAt: string;
  sentAt: string | null;
}

export interface IssueStore {
  saveIssue(issue: NewIssue): Promise<string>;
  listIssues(): Promise<IssueRecord[]>;
  getIssue(id: string): Promise<IssueRecord | null>;
  markSent(id: string): Promise<void>;
}

export interface IssuesTable {
  insert(issue: NewIssue): Promise<string>;
  selectAll(): Promise<IssueRecord[]>;
  selectById(id: string): Promise<IssueRecord | null>;
  markSent(id: string): Promise<void>;
}

export class SupabaseIssueStore implements IssueStore {
  constructor(private table: IssuesTable) {}

  saveIssue(issue: NewIssue): Promise<string> {
    return this.table.insert(issue);
  }

  listIssues(): Promise<IssueRecord[]> {
    return this.table.selectAll();
  }

  getIssue(id: string): Promise<IssueRecord | null> {
    return this.table.selectById(id);
  }

  markSent(id: string): Promise<void> {
    return this.table.markSent(id);
  }
}

export function createSupabaseIssuesTable(client: SupabaseClient): IssuesTable {
  return {
    async insert(issue) {
      const { data, error } = await client
        .from("issues")
        .insert({
          html: issue.html,
          trigger_type: issue.triggerType,
          market_summary: issue.marketSummary,
          listings: issue.listings,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Failed to save issue: ${error.message}`);
      return data.id;
    },
    async selectAll() {
      const { data, error } = await client.from("issues").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list issues: ${error.message}`);
      return (data ?? []).map(rowToIssueRecord);
    },
    async selectById(id) {
      const { data, error } = await client.from("issues").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to get issue: ${error.message}`);
      return data ? rowToIssueRecord(data) : null;
    },
    async markSent(id) {
      const { error } = await client.from("issues").update({ sent_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(`Failed to mark issue sent: ${error.message}`);
    },
  };
}

function rowToIssueRecord(row: Record<string, unknown>): IssueRecord {
  return {
    id: row.id as string,
    html: row.html as string,
    triggerType: row.trigger_type as NewIssue["triggerType"],
    marketSummary: row.market_summary as string,
    listings: row.listings as StoredListing[],
    createdAt: row.created_at as string,
    sentAt: (row.sent_at as string | null) ?? null,
  };
}

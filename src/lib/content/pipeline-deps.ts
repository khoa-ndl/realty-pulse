import { createClient } from "@supabase/supabase-js";
import type { Env } from "@/lib/env";
import { createPerplexityResearcher } from "./market-researcher";
import { createAnthropicMessageClient, createClaudeCopywriter } from "./copywriter";
import { createKieAiImageGenerator } from "./image-generator";
import { createSupabaseIssuesTable, SupabaseIssueStore } from "./issue-store";
import type { GenerateIssueDeps } from "./generate-issue";

export function createGenerateIssueDeps(env: Env): GenerateIssueDeps {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    researcher: createPerplexityResearcher(env.PERPLEXITY_API_KEY),
    copywriter: createClaudeCopywriter(createAnthropicMessageClient(env.ANTHROPIC_API_KEY)),
    imageGenerator: createKieAiImageGenerator(env.KIE_AI_API_KEY),
    issueStore: new SupabaseIssueStore(createSupabaseIssuesTable(supabase)),
    baseUrl: env.NEXT_PUBLIC_APP_URL,
  };
}

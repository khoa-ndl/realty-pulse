import { z } from "zod";

const nonBlank = z.string().trim().min(1);

const schema = z.object({
  ANTHROPIC_API_KEY: nonBlank,
  PERPLEXITY_API_KEY: nonBlank,
  KIE_AI_API_KEY: nonBlank,
  NEXT_PUBLIC_SUPABASE_URL: nonBlank.pipe(z.url()),
  SUPABASE_SERVICE_ROLE_KEY: nonBlank,
  GMAIL_CLIENT_ID: nonBlank,
  GMAIL_CLIENT_SECRET: nonBlank,
  GMAIL_REFRESH_TOKEN: nonBlank,
});

export type Env = z.infer<typeof schema>;

export const ENV_KEYS = Object.keys(schema.shape) as (keyof Env)[];

export function getEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return result.data;
}

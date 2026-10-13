import { z } from "zod";

const schema = z.email();

export function parseUnsubscribeEmail(raw: string | undefined): { email: string } | { error: string } {
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: "This unsubscribe link is missing an email address." };
  }
  return { email: result.data };
}

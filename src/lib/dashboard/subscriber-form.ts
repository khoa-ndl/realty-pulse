import { z } from "zod";

const schema = z.object({ email: z.email(), source: z.string().optional() });

export function parseAddSubscriberForm(
  form: FormData
): { email: string; source?: string } | { error: string } {
  const source = form.get("source");
  const result = schema.safeParse({
    email: form.get("email"),
    source: typeof source === "string" && source.trim() !== "" ? source : undefined,
  });
  if (!result.success) return { error: "Enter a valid email address." };
  return result.data;
}

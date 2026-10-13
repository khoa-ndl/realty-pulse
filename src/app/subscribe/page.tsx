import { SubscribeCard } from "@/components/subscribe-card";
import { subscribeAction } from "./actions";

export default function SubscribePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
        <SubscribeCard onSubscribe={subscribeAction} />
      </div>
    </div>
  );
}

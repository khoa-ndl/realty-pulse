import Link from "next/link";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Generate & Send",
    icon: (
      <path d="M3 11L19 3L13 19L10 12L3 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    ),
  },
  {
    href: "/dashboard/archive",
    label: "Issue Archive",
    icon: (
      <>
        <rect x="3" y="7" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M3 7L4.5 3H15.5L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
        <line x1="8" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: "/dashboard/subscribers",
    label: "Subscribers",
    icon: (
      <>
        <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M2 17C2 13.5 4.2 12 7 12C9.8 12 12 13.5 12 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="14.5" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M13 17C13 14.5 14 13.3 16 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    href: "/dashboard/schedule",
    label: "Schedule Status",
    icon: (
      <>
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M10 5.5V10L13 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
];

export function Sidebar({ currentPath }: { currentPath: string }) {
  return (
    <nav className="flex w-60 flex-col gap-7 border-r border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-2.5 px-2">
        <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 8L56 26V54C56 55.1 55.1 56 54 56H10C8.9 56 8 55.1 8 54V26L32 8Z" fill="#B4502E" />
          <path
            d="M10 36H22L26 26L34 46L38 36H54"
            stroke="#FAF7F2"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="font-[family-name:var(--font-heading)] text-lg text-[var(--color-foreground)]">
          RealtyPulse
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            currentPath === item.href || (item.href !== "/dashboard" && currentPath.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive
                  ? "bg-[var(--color-muted)] font-semibold text-[var(--color-primary)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

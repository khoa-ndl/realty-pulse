// Mirrors design-system/realtypulse/MASTER.md's palette, with email-safe font
// fallbacks — Calistoga/Inter/JetBrains Mono aren't reliably loaded by Outlook
// desktop or stripped-<head> clients, so headings fall back to a warm serif and
// body/data copy to a plain sans/monospace instead of trying to load web fonts.
export const emailTheme = {
  color: {
    primary: "#B4502E",
    onPrimary: "#FFFFFF",
    secondary: "#6B7256",
    background: "#FAF7F2",
    foreground: "#2A211C",
    card: "#FFFDF9",
    mutedForeground: "#6B6058",
    border: "#E3D8CC",
    muted: "#F0E9E1",
  },
  font: {
    heading: "Georgia, 'Times New Roman', serif",
    body: "Helvetica, Arial, sans-serif",
    data: "'Courier New', Courier, monospace",
  },
} as const;

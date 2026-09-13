/**
 * Format a date string into a human-readable relative timestamp.
 * Used across Dashboard and History screens.
 *
 * blocked_at is stored as UTC "YYYY-MM-DD HH:MM:SS" (SQLite's format). A bare
 * `new Date()` on that string is engine-dependent on Hermes and, where it does
 * parse, is read as LOCAL time, shifting every timestamp by the UTC offset.
 * Parse it explicitly as UTC instead.
 */
function parseUtc(dateStr: string): Date {
  let iso = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += "Z";
  return new Date(iso);
}

export function formatTimestamp(dateStr: string): string {
  const date = parseUtc(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

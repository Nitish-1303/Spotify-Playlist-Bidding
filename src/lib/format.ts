export function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function timeAgo(ts: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Price-style money for tables and tiles: $9.00 */
export function formatUsd(n: number, digits = 2) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Signed price move: +$1.00 / -$1.00 / $0.00 */
export function formatSignedUsd(n: number, digits = 2) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${formatUsd(Math.abs(n), digits)}`;
}

export function formatInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

/** 1284 → 1.3K, 2_400_000 → 2.4M */
export function formatCompact(n: number) {
  if (Math.abs(n) < 1000) return formatInt(n);
  return n.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function formatSignedInt(n: number) {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "-"}${formatInt(Math.abs(n))}`;
}

/** Arrow glyph for a market-style delta. */
export function trendGlyph(delta: number) {
  if (delta > 0) return "▲";
  if (delta < 0) return "▼";
  return "▬";
}

export function trendClass(delta: number) {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

/** "2026-08-29T14" (UTC bucket) → "19:00" in the viewer's local time. */
export function hourLabel(key: string) {
  const d = new Date(`${key}:00:00Z`);
  if (Number.isNaN(d.getTime())) return `${key.slice(11, 13)}:00`;
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/**
 * The artist to print, or null to print nothing.
 *
 * Songs bought before the Web API lookup existed carry the literal string
 * "Unknown artist", because oEmbed has no artist field to read. Those are on the
 * tape for good, so the label is treated as the absence it always was — a title
 * standing on its own reads better than a row admitting it does not know.
 */
export function artistLine(artist: string | undefined | null) {
  const trimmed = artist?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown artist") return null;
  return trimmed;
}

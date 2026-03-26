import { formatDistanceToNow, format, differenceInHours, parseISO } from "date-fns";

/**
 * Within 24 hours → relative ("2 hours ago")
 * After 24 hours  → DD/MM/YYYY
 */
export function formatPostDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (differenceInHours(new Date(), date) < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "dd/MM/yyyy");
}

/**
 * Formats a YYYY-MM-DD date string as "DD Month YYYY" (e.g. "15 March 1990").
 * Returns the original string unchanged if it can't be parsed.
 */
export function formatDOB(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd MMMM yyyy");
  } catch {
    return dateStr;
  }
}

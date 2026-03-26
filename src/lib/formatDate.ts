import { formatDistanceToNow, format, differenceInHours } from "date-fns";

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

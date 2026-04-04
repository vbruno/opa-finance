export const DEFAULT_TIMEZONE = "Australia/Adelaide";

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") {
    return false;
  }

  try {
    // Intl throws for invalid IANA timezones.
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

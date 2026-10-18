/**
 * The MailerLite embedded-form endpoint, read from PUBLIC_MAILERLITE_ACTION.
 * Returns null unless it is an https URL on mailerlite.com, so a typo or a
 * stray value never turns into a form that posts somewhere else.
 */
export function newsletterAction(env: Record<string, unknown>): string | null {
  const raw = env.PUBLIC_MAILERLITE_ACTION;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname;
  if (host !== 'mailerlite.com' && !host.endsWith('.mailerlite.com')) return null;
  return value;
}

import { describe, expect, it } from 'vitest';
import { newsletterAction } from '../../src/lib/newsletter';

const url = 'https://assets.mailerlite.com/jsonp/123/forms/456/subscribe';

describe('newsletterAction', () => {
  it('is null when the variable is not set', () => {
    expect(newsletterAction({})).toBeNull();
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: '   ' })).toBeNull();
  });
  it('rejects a URL that is not https', () => {
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: url.replace('https:', 'http:') })).toBeNull();
  });
  it('rejects a host outside mailerlite.com', () => {
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: 'https://example.com/subscribe' })).toBeNull();
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: 'https://mailerlite.com.evil.io/x' })).toBeNull();
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: 'https://evilmailerlite.com/x' })).toBeNull();
  });
  it('rejects something that is not a URL', () => {
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: 'not a url' })).toBeNull();
  });
  it('passes a MailerLite URL through', () => {
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: url })).toBe(url);
    expect(newsletterAction({ PUBLIC_MAILERLITE_ACTION: ` ${url} ` })).toBe(url);
  });
});

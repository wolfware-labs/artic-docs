import { useEffect, useState, type FormEvent } from 'react';

interface Props {
  action: string;
}

type State = 'idle' | 'sending' | 'done' | 'failed';

/**
 * A plain form that posts to MailerLite and works without JavaScript. Once
 * hydrated it submits with fetch instead, so the result shows inline.
 */
export default function Newsletter({ action }: Props) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<State>('idle');

  useEffect(() => setReady(true), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;
    const form = event.currentTarget;
    setState('sending');
    let response: Response;
    let result: { success?: boolean };
    try {
      response = await fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        // A definite rejection from the server: say so and keep the address.
        setState('failed');
        return;
      }
      result = (await response.json()) as { success?: boolean };
    } catch {
      // Blocked by CORS, offline, or a reply we cannot read. The signup may still
      // have gone through, so let the browser submit the form the plain way.
      form.submit();
      return;
    }
    setState(result.success === true ? 'done' : 'failed');
  }

  const message =
    state === 'done'
      ? 'Check your inbox to confirm your subscription.'
      : state === 'failed'
        ? "That didn't go through. Try again in a minute."
        : '';

  return (
    <form
      className="news"
      action={action}
      method="post"
      onSubmit={onSubmit}
      data-ready={ready ? '' : undefined}
      data-state={state}
    >
      <label htmlFor="newsletter-email">
        <b>Follow artic as it grows.</b>
        <span>One email a month on what shipped and what's next. Unsubscribe anytime.</span>
      </label>
      <input type="hidden" name="ml-submit" value="1" />
      <input type="hidden" name="anticsrf" value="true" />
      {state !== 'done' && (
        <div className="row">
          <input
            id="newsletter-email"
            name="fields[email]"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
          <button type="submit" disabled={state === 'sending'}>
            Subscribe
          </button>
        </div>
      )}
      <p className={`msg ${state}`} aria-live="polite">
        {message}
      </p>
    </form>
  );
}

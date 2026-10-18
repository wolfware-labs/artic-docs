import { useEffect, useState } from 'react';

interface Props {
  text: string;
}

/**
 * Renders nothing until hydrated, so a page without JavaScript never shows a
 * dead button. The command itself stays selectable text next to it.
 */
export default function CopyButton({ text }: Props) {
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  if (!ready) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked: the text beside the button is still selectable.
    }
  }

  return (
    <button type="button" className="copy-btn" onClick={copy} aria-label={`Copy: ${text}`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

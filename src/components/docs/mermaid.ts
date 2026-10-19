// Renders the `pre.mermaid` blocks the codeBlocks plugin emits. mermaid is large, so it is only
// loaded on pages that have a diagram, and diagrams redraw when the theme changes.
const diagrams = [...document.querySelectorAll<HTMLElement>('pre.mermaid')];

if (diagrams.length > 0) {
  for (const d of diagrams) d.dataset.source = d.textContent ?? '';
  const { default: mermaid } = await import('mermaid');

  const render = async () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
    for (const d of diagrams) {
      d.removeAttribute('data-processed');
      d.textContent = d.dataset.source ?? '';
    }
    await mermaid.run({ nodes: diagrams });
  };

  await render();
  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

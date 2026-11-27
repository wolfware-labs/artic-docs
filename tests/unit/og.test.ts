import { describe, expect, it } from 'vitest';
import { cardSvg } from '../../src/lib/og';
import { LANDING_CARD } from '../../src/lib/seo.mjs';

// lineClamp cuts text that does not fit with an ellipsis. With the fonts left as text, the cut
// shows in the drawn card. How many characters fit depends on the letters (125 characters of
// prose fit, 125 of capitals do not), so the card is drawn rather than its text counted.
describe('cardSvg', () => {
  it('ends a description that does not fit in three lines with an ellipsis', async () => {
    const capitals = 'XAML GPU RUST '.repeat(9).slice(0, 125);
    expect(await cardSvg({ ...LANDING_CARD, description: capitals }, { embedFont: false })).toContain('\u2026');
  });

  it('draws the landing card without cutting its title or description', async () => {
    expect(await cardSvg(LANDING_CARD, { embedFont: false })).not.toContain('\u2026');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSocialLinkViews } from './social-links';

describe('buildSocialLinkViews', () => {
  it('keeps real social links and drops regular domains that only contain x.com', () => {
    const links = buildSocialLinkViews(['https://vwimpex.com/about-us', 'https://x.com/VWIMPEX']);

    assert.deepEqual(
      links.map(link => ({ channel: link.channel, url: link.url })),
      [{ channel: 'x', url: 'https://x.com/VWIMPEX' }]
    );
  });
});

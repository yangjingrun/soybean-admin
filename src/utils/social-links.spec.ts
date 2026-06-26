import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSocialLinkViews } from './social-links';

describe('buildSocialLinkViews', () => {
  it('maps social hosts to matching brand icons', () => {
    const links = buildSocialLinkViews([
      'https://www.linkedin.com/company/schaeffler',
      'https://www.facebook.com/schaefflergroup',
      'https://www.instagram.com/schaefflergroup/',
      'https://www.youtube.com/user/SchaefflerGlobal',
      'https://www.twitter.com/schaefflergroup',
      'https://www.tiktok.com/@bearinghouse',
      'https://pinterest.com/bearinghouse',
      'https://wa.me/97144910000'
    ]);

    assert.deepEqual(
      links.map(link => ({ channel: link.channel, label: link.label, icon: link.icon })),
      [
        { channel: 'linkedin', label: 'LinkedIn', icon: 'simple-icons:linkedin' },
        { channel: 'facebook', label: 'Facebook', icon: 'simple-icons:facebook' },
        { channel: 'instagram', label: 'Instagram', icon: 'simple-icons:instagram' },
        { channel: 'youtube', label: 'YouTube', icon: 'simple-icons:youtube' },
        { channel: 'x', label: 'X / Twitter', icon: 'simple-icons:x' },
        { channel: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok' },
        { channel: 'pinterest', label: 'Pinterest', icon: 'simple-icons:pinterest' },
        { channel: 'whatsapp', label: 'WhatsApp', icon: 'simple-icons:whatsapp' }
      ]
    );
  });

  it('keeps real social links and drops regular domains that only contain x.com', () => {
    const links = buildSocialLinkViews(['https://vwimpex.com/about-us', 'https://x.com/VWIMPEX']);

    assert.deepEqual(
      links.map(link => ({ channel: link.channel, url: link.url })),
      [{ channel: 'x', url: 'https://x.com/VWIMPEX' }]
    );
  });

  it('maps twitter hosts to the X display channel', () => {
    const links = buildSocialLinkViews(['https://www.twitter.com/schaefflergroup']);

    assert.deepEqual(links, [
      {
        channel: 'x',
        label: 'X / Twitter',
        icon: 'simple-icons:x',
        url: 'https://www.twitter.com/schaefflergroup'
      }
    ]);
  });
});

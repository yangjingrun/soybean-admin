export type SocialLinkChannel =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'x'
  | 'tiktok'
  | 'pinterest'
  | 'whatsapp'
  | 'social';

export interface SocialLinkView {
  url: string;
  channel: SocialLinkChannel;
  label: string;
  icon: string;
}

const socialChannelRules: Array<{
  channel: SocialLinkChannel;
  label: string;
  icon: string;
  match: (hostname: string) => boolean;
}> = [
  { channel: 'linkedin', label: 'LinkedIn', icon: 'simple-icons:linkedin', match: host => matchesDomain(host, 'linkedin.com') },
  { channel: 'facebook', label: 'Facebook', icon: 'simple-icons:facebook', match: host => matchesDomain(host, 'facebook.com') },
  {
    channel: 'instagram',
    label: 'Instagram',
    icon: 'simple-icons:instagram',
    match: host => matchesDomain(host, 'instagram.com')
  },
  {
    channel: 'youtube',
    label: 'YouTube',
    icon: 'simple-icons:youtube',
    match: host => matchesDomain(host, 'youtube.com') || matchesDomain(host, 'youtu.be')
  },
  {
    channel: 'x',
    label: 'X / Twitter',
    icon: 'simple-icons:x',
    match: host => matchesDomain(host, 'x.com') || matchesDomain(host, 'twitter.com')
  },
  { channel: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok', match: host => matchesDomain(host, 'tiktok.com') },
  { channel: 'pinterest', label: 'Pinterest', icon: 'simple-icons:pinterest', match: host => host.startsWith('pinterest.') },
  {
    channel: 'whatsapp',
    label: 'WhatsApp',
    icon: 'simple-icons:whatsapp',
    match: host => matchesDomain(host, 'wa.me') || matchesDomain(host, 'whatsapp.com')
  }
];

/** Converts raw social URLs into deduped icon-ready channel links. */
export function buildSocialLinkViews(links: string[]): SocialLinkView[] {
  const seen = new Set<string>();
  const output: SocialLinkView[] = [];

  for (const link of links) {
    const url = link.trim();
    const dedupeKey = normalizeSocialUrl(url);

    if (!url || seen.has(dedupeKey)) {
      continue;
    }

    const linkView = toSocialLinkView(url);

    if (!linkView) continue;

    seen.add(dedupeKey);
    output.push(linkView);
  }

  return output;
}

function toSocialLinkView(url: string): SocialLinkView | null {
  const hostname = parseHostname(url);
  const rule = hostname ? socialChannelRules.find(item => item.match(hostname)) : null;

  if (!rule) return null;

  return {
    url,
    channel: rule.channel,
    label: rule.label,
    icon: rule.icon
  };
}

function normalizeSocialUrl(url: string) {
  try {
    const parsed = new URL(url);

    return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return url.toLowerCase();
  }
}

function parseHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function matchesDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

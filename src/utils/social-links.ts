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
  match: RegExp;
}> = [
  { channel: 'linkedin', label: 'LinkedIn', icon: 'mdi:linkedin', match: /linkedin\.com/i },
  { channel: 'facebook', label: 'Facebook', icon: 'mdi:facebook', match: /facebook\.com/i },
  { channel: 'instagram', label: 'Instagram', icon: 'mdi:instagram', match: /instagram\.com/i },
  { channel: 'youtube', label: 'YouTube', icon: 'mdi:youtube', match: /youtube\.com|youtu\.be/i },
  { channel: 'x', label: 'X / Twitter', icon: 'mdi:twitter', match: /x\.com|twitter\.com/i },
  { channel: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok', match: /tiktok\.com/i },
  { channel: 'pinterest', label: 'Pinterest', icon: 'mdi:pinterest', match: /pinterest\./i },
  { channel: 'whatsapp', label: 'WhatsApp', icon: 'mdi:whatsapp', match: /wa\.me|whatsapp\.com/i }
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

    seen.add(dedupeKey);
    output.push(toSocialLinkView(url));
  }

  return output;
}

function toSocialLinkView(url: string): SocialLinkView {
  const rule = socialChannelRules.find(item => item.match.test(url));

  return {
    url,
    channel: rule?.channel ?? 'social',
    label: rule?.label ?? '社媒',
    icon: rule?.icon ?? 'mdi:link-variant'
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

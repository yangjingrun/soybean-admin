const targetRegionNames: Record<string, string> = {
  'saudi arabia': '沙特阿拉伯',
  ksa: '沙特阿拉伯',
  'united arab emirates': '阿联酋',
  uae: '阿联酋',
  emirates: '阿联酋',
  'south korea': '韩国',
  korea: '韩国',
  mexico: '墨西哥',
  usa: '美国',
  'united states': '美国',
  'united states of america': '美国',
  germany: '德国',
  france: '法国',
  italy: '意大利',
  spain: '西班牙',
  'united kingdom': '英国',
  uk: '英国',
  russia: '俄罗斯',
  turkey: '土耳其',
  india: '印度',
  vietnam: '越南',
  indonesia: '印度尼西亚',
  thailand: '泰国',
  malaysia: '马来西亚',
  brazil: '巴西',
  egypt: '埃及',
  'south africa': '南非',
  iran: '伊朗',
  iraq: '伊拉克',
  qatar: '卡塔尔',
  kuwait: '科威特',
  oman: '阿曼',
  bahrain: '巴林',
  jordan: '约旦',
  israel: '以色列'
};

/** Formats saved target regions for the history list, keeping the country signal readable. */
export function formatHistoryTargetRegions(regions?: string | null) {
  const regionText = regions?.trim();

  if (!regionText) {
    return '';
  }

  return regionText
    .split(/[,，、/|]+|\s+and\s+/i)
    .map(region => region.trim())
    .filter(Boolean)
    .map(region => targetRegionNames[region.toLowerCase()] || region)
    .join('、');
}

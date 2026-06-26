import DeviceDetector = require('device-detector-js');

export type CrmTrackingIpReliability = 'direct' | 'proxy' | 'unknown';
export type CrmTrackingOpenConfidence = 'high' | 'medium' | 'low';

export interface CrmTrackingOpenInsight {
  clientName: string | null;
  clientType: string | null;
  confidence: CrmTrackingOpenConfidence;
  deviceBrand: string | null;
  deviceLabel: string;
  deviceModel: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  ipReliability: CrmTrackingIpReliability;
  osName: string | null;
  osVersion: string | null;
  proxyProvider: string | null;
  reliabilityNote: string;
  userAgent: string | null;
}

interface CrmTrackingOpenInsightInput {
  userAgent?: string | null;
  ipAddress?: string | null;
}

const detector = new DeviceDetector({ versionTruncation: 1 });

/** 解析邮件打开请求的 User-Agent/IP，输出可给业务用户查看的设备线索。 */
export function buildCrmTrackingOpenInsight(input: CrmTrackingOpenInsightInput): CrmTrackingOpenInsight {
  const userAgent = normalizeNullableString(input.userAgent);
  const ipAddress = normalizeNullableString(input.ipAddress);
  const parsed = userAgent ? detector.parse(userAgent) : null;
  const proxyProvider = detectMailImageProxy(userAgent, ipAddress);
  const deviceType = parsed?.bot ? 'bot' : normalizeNullableString(parsed?.device?.type);
  const ipReliability: CrmTrackingIpReliability = proxyProvider ? 'proxy' : ipAddress ? 'direct' : 'unknown';
  const confidence = getInsightConfidence({ proxyProvider, userAgent, deviceType, ipAddress });

  return {
    clientName: normalizeNullableString(parsed?.client?.name),
    clientType: normalizeNullableString(parsed?.client?.type),
    confidence,
    deviceBrand: normalizeNullableString(parsed?.device?.brand),
    deviceLabel: toDeviceLabel(deviceType),
    deviceModel: normalizeNullableString(parsed?.device?.model),
    deviceType,
    ipAddress,
    ipReliability,
    osName: normalizeNullableString(parsed?.os?.name),
    osVersion: normalizeNullableString(parsed?.os?.version),
    proxyProvider,
    reliabilityNote: buildReliabilityNote({ proxyProvider, confidence, ipReliability }),
    userAgent
  };
}

function detectMailImageProxy(userAgent: string | null, ipAddress: string | null) {
  const ua = userAgent?.toLowerCase() ?? '';

  if (ua.includes('googleimageproxy')) return 'Gmail 图片代理';
  if (ua.includes('yahoomailproxy')) return 'Yahoo 邮件图片代理';
  if (ua.includes('outlook') && ua.includes('proxy')) return 'Outlook 图片代理';

  // Apple Mail Privacy Protection 常通过 Apple 代理预取图片，User-Agent 信息很少且 IP 常落在 Apple 网段。
  if (ipAddress?.startsWith('17.') && (!ua || ua.includes('applewebkit'))) return 'Apple 邮件隐私保护';

  return null;
}

function getInsightConfidence(input: {
  proxyProvider: string | null;
  userAgent: string | null;
  deviceType: string | null;
  ipAddress: string | null;
}): CrmTrackingOpenConfidence {
  if (input.proxyProvider === 'Apple 邮件隐私保护') return 'low';
  if (input.proxyProvider) return 'medium';
  if (input.userAgent && input.deviceType && input.ipAddress) return 'high';
  return 'low';
}

function toDeviceLabel(deviceType: string | null) {
  const labelMap: Record<string, string> = {
    bot: '自动程序',
    desktop: '电脑',
    feature: '功能手机',
    phablet: '大屏手机',
    smartphone: '手机',
    tablet: '平板',
    television: '电视',
    wearable: '穿戴设备'
  };

  return deviceType ? (labelMap[deviceType] ?? deviceType) : '未知设备';
}

function buildReliabilityNote(input: {
  proxyProvider: string | null;
  confidence: CrmTrackingOpenConfidence;
  ipReliability: CrmTrackingIpReliability;
}) {
  if (input.proxyProvider === 'Apple 邮件隐私保护') {
    return '可能由 Apple 邮件隐私保护预取图片，打开时间、IP 和设备只能作为弱线索。';
  }

  if (input.proxyProvider) {
    return '邮箱服务商代理加载图片，IP 可能不是客户真实 IP，设备只能作为线索。';
  }

  if (input.confidence === 'high' && input.ipReliability === 'direct') {
    return '未识别到常见邮箱图片代理，设备和 IP 可信度较高，但仍不能等同于客户真实位置。';
  }

  return '邮件客户端提供的信息有限，设备和 IP 仅供参考。';
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

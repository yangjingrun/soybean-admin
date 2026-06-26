import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCrmTrackingOpenInsight } from './crm-tracking-open-insight';

test('buildCrmTrackingOpenInsight identifies desktop browser opens', () => {
  const insight = buildCrmTrackingOpenInsight({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ipAddress: '203.0.113.12'
  });

  assert.equal(insight.deviceType, 'desktop');
  assert.equal(insight.deviceLabel, '电脑');
  assert.equal(insight.osName, 'Windows');
  assert.equal(insight.clientName, 'Chrome');
  assert.equal(insight.ipAddress, '203.0.113.12');
  assert.equal(insight.proxyProvider, null);
  assert.equal(insight.confidence, 'high');
});

test('buildCrmTrackingOpenInsight identifies mobile opens', () => {
  const insight = buildCrmTrackingOpenInsight({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ipAddress: '198.51.100.20'
  });

  assert.equal(insight.deviceType, 'smartphone');
  assert.equal(insight.deviceLabel, '手机');
  assert.equal(insight.osName, 'iOS');
  assert.equal(insight.clientName, 'Mobile Safari');
  assert.equal(insight.proxyProvider, null);
});

test('buildCrmTrackingOpenInsight marks Gmail image proxy as proxied signal', () => {
  const insight = buildCrmTrackingOpenInsight({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 GoogleImageProxy',
    ipAddress: '66.249.84.10'
  });

  assert.equal(insight.proxyProvider, 'Gmail 图片代理');
  assert.equal(insight.ipReliability, 'proxy');
  assert.equal(insight.confidence, 'medium');
  assert.match(insight.reliabilityNote, /邮箱服务商代理加载/);
});

test('buildCrmTrackingOpenInsight marks Apple Mail privacy opens as low confidence', () => {
  const insight = buildCrmTrackingOpenInsight({
    userAgent: 'Mozilla/5.0 AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ipAddress: '17.58.101.23'
  });

  assert.equal(insight.proxyProvider, 'Apple 邮件隐私保护');
  assert.equal(insight.ipReliability, 'proxy');
  assert.equal(insight.confidence, 'low');
  assert.match(insight.reliabilityNote, /Apple 邮件隐私保护/);
});

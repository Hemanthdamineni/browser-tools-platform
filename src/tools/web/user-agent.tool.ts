import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './user-agent.meta';

const BOT_RE =
  /(bot|crawler|spider|curl|wget|python-requests|Googlebot|bingbot|DuckDuckBot|Slackbot|facebookexternalhit)/i;

interface Parsed {
  browser: string;
  version: string;
  os: string;
  osVersion: string;
  engine: string;
  device: 'mobile' | 'tablet' | 'bot' | 'desktop';
  isBot: boolean;
}

function parse(ua: string): Parsed {
  const isBot = BOT_RE.test(ua);
  const device: Parsed['device'] = isBot
    ? 'bot'
    : /\b(iPad|Tablet|PlayBook|Silk)\b/i.test(ua)
      ? 'tablet'
      : /\b(Mobile|iPhone|iPod|Android.*Mobile|Windows Phone)\b/i.test(ua)
        ? 'mobile'
        : 'desktop';

  // Browser + version, most specific first.
  let browser = 'Unknown';
  let version = '';
  const RULES: [string, RegExp][] = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['cURL', /curl\/([\d.]+)/],
    ['wget', /Wget\/([\d.]+)/],
    ['IE', /(?:MSIE |rv:)([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
    ['Python', /Python-\w+\/([\d.]+)/],
  ];
  for (const [label, re] of RULES) {
    const m = re.exec(ua);
    if (m) {
      browser = label;
      version = m[1] ?? '';
      break;
    }
  }

  // OS + version.
  let os = 'Unknown';
  let osVersion = '';
  const m10 = /Windows NT ([\d.]+)/.exec(ua);
  if (m10) {
    os = 'Windows';
    const map = { '10.0': '10', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' };
    osVersion = map[m10[1]! as keyof typeof map] ?? m10[1]!;
  } else if (/Android ([\d.]+)/.exec(ua)) {
    os = 'Android';
    osVersion = /Android ([\d.]+)/.exec(ua)![1]!;
  } else if (/iPhone OS ([\d_]+)/.exec(ua)) {
    os = 'iOS';
    osVersion = /iPhone OS ([\d_]+)/.exec(ua)![1]!.replace(/_/g, '.');
  } else if (/CPU OS ([\d_]+)/.exec(ua)) {
    os = 'iOS';
    osVersion = /CPU OS ([\d_]+)/.exec(ua)![1]!.replace(/_/g, '.');
  } else if (/Mac OS X ([\d_.]+)/.exec(ua)) {
    os = 'macOS';
    osVersion = /Mac OS X ([\d_.]+)/.exec(ua)![1]!.replace(/_/g, '.');
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  } else if (/Windows Phone ([\d.]+)/.exec(ua)) {
    os = 'Windows Phone';
    osVersion = /Windows Phone ([\d.]+)/.exec(ua)![1]!;
  } else if (/Windows/.test(ua)) {
    os = 'Windows';
  }

  // Engine.
  let engine = 'Unknown';
  if (/Trident/.test(ua)) engine = 'Trident';
  else if (/Gecko\//.test(ua)) engine = 'Gecko';
  else if (/\bEdge\//.test(ua) || /AppleWebKit/.test(ua)) engine = 'Blink';
  if (
    engine === 'Blink' &&
    /Version\/.*Safari/.test(ua) &&
    !/Chrome\//.test(ua) &&
    !/Edg\//.test(ua) &&
    !/OPR\//.test(ua)
  )
    engine = 'WebKit';

  return { browser, version, os, osVersion, engine, device, isBot };
}

function run(input: TextRunInput): TextRunResult {
  const ua = input.text.trim();
  if (!ua) throw new ToolError('Paste a User-Agent string.');

  const p = parse(ua);
  const rows: string[][] = [
    ['Browser', p.browser],
    ['Version', p.version || '—'],
    ['OS', p.os],
    ['OS version', p.osVersion || '—'],
    ['Engine', p.engine],
    ['Device type', p.device],
    ['Is bot', p.isBot ? 'Yes' : 'No'],
  ];

  return {
    output: JSON.stringify({ headers: ['Field', 'Value'], rows }),
    render: 'table',
    stats: { browser: p.browser },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;

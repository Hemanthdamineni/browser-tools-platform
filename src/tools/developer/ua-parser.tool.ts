import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './ua-parser.meta';

const MAX_LEN = 20_000;
const NUM = '([0-9]+(?:\\.[0-9]+)*)';

interface Result {
  rows: string[][];
}

function firstVersion(s: string, re: string): string {
  const m = new RegExp(re, 'i').exec(s);
  return m ? m[1]! : '';
}

function parse(ua: string): Result {
  const s = ua;

  // Bots first: crawlers rarely carry a browser token.
  if (/(?:bot|crawler|spider|slurp|scan|preview|feedfetcher|monitor|crawling|archiver)/i.test(s)) {
    let name = 'Unknown bot';
    const botMatch = s.match(/(?:(?:google|bing|duckduck|baidu|yandex|twitter|facebook|linkedin|slack|discord)[\w]*[\s/-]*)?(?:bot|robot|crawler|spider|slurp)[\w/-]*/i);
    if (botMatch) name = botMatch[0].replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const v = firstVersion(s, '(/|\\s)' + NUM);
    return {
      rows: [
        ['Browser', name],
        ['Version', v || '—'],
        ['Engine', '—'],
        ['OS', '—'],
        ['OS version', '—'],
        ['Device', 'Bot'],
      ],
    };
  }

  let browser = 'Unknown';
  let version = '';
  let engine = 'Unknown';

  if (/SamsungBrowser\//i.test(s)) {
    browser = 'Samsung Internet';
    version = firstVersion(s, 'SamsungBrowser/' + NUM);
    engine = 'Blink';
  } else if (/EdgA\//i.test(s) || /EdgiOS\//i.test(s) || /EdgW\//i.test(s) || /Edg\//i.test(s)) {
    browser = 'Microsoft Edge';
    version = firstVersion(s, '(?:EdgA|EdgiOS|EdgW|Edg)/' + NUM);
    engine = 'Blink';
  } else if (/OPR\//i.test(s) || /Opera Min/i.test(s)) {
    browser = /Opera Min/i.test(s) ? 'Opera Mini' : 'Opera';
    version = firstVersion(s, '(?:OPR|Opera Mini)/' + NUM) || firstVersion(s, 'Opera/' + NUM) || firstVersion(s, 'Version/' + NUM);
    engine = 'Blink';
  } else if (/FxiOS\//i.test(s)) {
    browser = 'Firefox (iOS)';
    version = firstVersion(s, 'FxiOS/' + NUM);
    engine = 'Gecko';
  } else if (/CriOS\//i.test(s)) {
    browser = 'Chrome (iOS)';
    version = firstVersion(s, 'CriOS/' + NUM);
    engine = 'Blink';
  } else if (/Chrome\//i.test(s)) {
    browser = 'Chrome';
    version = firstVersion(s, 'Chrome/' + NUM);
    engine = 'Blink';
  } else if (/Firefox\//i.test(s)) {
    browser = 'Firefox';
    version = firstVersion(s, 'Firefox/' + NUM);
    engine = 'Gecko';
  } else if (/Trident\/[0-9]/.test(s)) {
    browser = 'Internet Explorer';
    version = firstVersion(s, '(?:MSIE|rv)' + NUM);
    engine = 'Trident';
  } else if (/Safari\//i.test(s)) {
    browser = 'Safari';
    version = firstVersion(s, 'Version/' + NUM);
    engine = 'WebKit';
  } else if (/Edge\//i.test(s)) {
    browser = 'Microsoft Edge (Legacy)';
    version = firstVersion(s, 'Edge/' + NUM);
    engine = 'EdgeHTML';
  } else {
    const product = s.match(/^([A-Za-z][A-Za-z0-9._-]*)\/([0-9][0-9.]*)/);
    if (product) {
      browser = product[1]!;
      version = product[2]!;
      engine = '—';
    }
  }

  // OS
  let os = 'Unknown';
  let osver = '';
  if (/Windows Phone/i.test(s)) {
    os = 'Windows Phone';
    osver = firstVersion(s, 'Windows Phone (?:OS )?' + NUM);
  } else if (/Windows NT/i.test(s)) {
    os = 'Windows';
    const nt = firstVersion(s, 'Windows NT ' + NUM);
    const map: Record<string, string> = {
      '5.1': 'XP',
      '5.2': 'XP x64',
      '6.0': 'Vista',
      '6.1': '7',
      '6.2': '8',
      '6.3': '8.1',
      '10.0': '10/11',
    };
    osver = map[nt] ?? nt;
  } else if (/Windows/i.test(s)) {
    os = 'Windows';
  } else if (/(?:iPhone OS|CPU OS)/i.test(s)) {
    os = 'iOS';
    osver = firstVersion(s, '(?:iPhone OS|CPU OS) ' + '([0-9]+(?:[._][0-9]+)*)').replace(/_/g, '.');
  } else if (/Mac OS X/i.test(s)) {
    os = 'macOS';
    osver = firstVersion(s, 'Mac OS X ' + '([0-9]+(?:[._][0-9]+)*)').replace(/_/g, '.');
  } else if (/Android/i.test(s)) {
    os = 'Android';
    osver = firstVersion(s, 'Android ' + NUM);
  } else if (/CrOS/i.test(s)) {
    os = 'ChromeOS';
  } else if (/Linux/i.test(s)) {
    os = 'Linux';
    osver = firstVersion(s, 'Linux ' + NUM);
  } else if (/FreeBSD/i.test(s)) os = 'FreeBSD';

  const isMobile = /Mobile/i.test(s);
  let device = 'Desktop';
  if (/iPad/i.test(s)) device = 'Tablet';
  else if (/iPhone|iPod/i.test(s)) device = 'Mobile';
  else if (/Android/i.test(s) && isMobile) device = 'Mobile';
  else if (/Android/i.test(s)) device = 'Tablet';

  return {
    rows: [
      ['Browser', browser],
      ['Version', version || '—'],
      ['Engine', engine],
      ['OS', os],
      ['OS version', osver || '—'],
      ['Device', device],
    ],
  };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const ua = String(input.text ?? '').trim();
  if (!ua) throw new ToolError('Paste a User-Agent string to decode.');
  if (ua.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  const { rows } = parse(ua);
  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: { properties: rows.length },
    notes: ['User-Agent string is 100% decoded on your device.', 'Detection is heuristic — verify unusual strings manually.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;

import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './random-data.meta';

/* ---------------------------------- data ---------------------------------- */

const FIRST =
  'James Mary Robert Patricia John Jennifer Michael Linda David Elizabeth William Barbara Richard Susan Joseph Jessica Thomas Sarah Charles Karen Christopher Lisa Daniel Nancy Matthew Betty Anthony Sandra Mark Ashley Donald Kimberly Steven Emily Andrew Donna Paul Michelle Joshua Carol Kenneth Amanda Kevin Melissa Brian Deborah George Stephanie Timothy Rebecca Ronald Sharon Edward Laura Jason Cynthia Jeffrey Dorothy Ryan Amy Jacob Kathleen Gary Angela Nicholas Shirley Eric Anna Jonathan Brenda Stephen Pamela Larry Emma Justin Nicole Scott Helen Brandon Samantha Benjamin Katherine Samuel Christine Gregory Debra Alexander Rachel Patrick Carolyn Frank Janet Raymond Maria Jack Heather Dennis Diane Jerry Ruth Tyler Julie Aaron Olivia Jose Joyce Adam Virginia Nathan Victoria Henry Kelly Douglas Lauren Zachary Christina Peter Joan Kyle Evelyn Noah Lauren Ethan Judith Jeremy Megan Walter Andrea Christian Cheryl Keith Hannah Roger Jacqueline Terry Marilyn Austin Ann Sean Kathryn Gerald Diane Carl Frances Harold Katherine Dylan Alice Arthur Judy Lawrence Julie Jordan Victoria Jesse Kelly Bryan Doris Billy Theresa Bruce Beverly Gabriel Denise Joe Tammy Logan Irene Alan Jane Juan Kathryn Albert Gladys Willie Lauren Elijah Teresa Wayne Beverly Randy Amber Vincent Danielle Liam Rose Bobby Diana Roy Brittany'.split(
    ' ',
  );
const LAST =
  'Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson Walker Young Allen King Wright Scott Torres Nguyen Hill Flores Green Adams Nelson Baker Hall Rivera Campbell Mitchell Carter Roberts Gomez Phillips Evans Turner Diaz Parker Cruz Edwards Collins Reyes Stewart Morris Morales Murphy Cook Rogers Gutierrez Ortiz Morgan Cooper Peterson Bailey Reed Kelly Howard Ramos Kim Cox Ward Richardson Watson Brooks Chavez Wood James Bennett Gray Mendoza Ruiz Hughes Price Alvarez Castillo Sanders Patel Myers Long Ross Foster Jimenez'.split(
    ' ',
  );
const CITIES =
  'Springfield Riverside Franklin Greenville Bristol Clinton Fairview Salem Madison Georgetown Arlington Ashland Burlington Manchester Milton Newport Oxford Winchester Clayton Hudson Dayton Lexington Milford Auburn Bergen Dover Florence Georgetown Hampton Kingston Lawrence Lincoln Monterey Newport Oakdale Princeton Somerset Trenton Warren'.split(
    ' ',
  );
const STATES =
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' ',
  );
const STREETS =
  'Maple Oak Cedar Pine Elm Washington Lake Hill Park Sunset River Church High King Queen Victoria Station Bridge Green Park Church Manor Mill Wood Cross London'.split(
    ' ',
  );
const TLDS = ['com', 'net', 'org', 'io', 'dev', 'app', 'co', 'me'];
const ADJ =
  'Smart Swift Bright Bold Cozy Fresh Giant Happy Lucky Prime Rapid Royal Silky Sleek Urban Vital Agile Crisp Elite Foggy Golden Humble Modern Nimbus Quiet Terra Urban Zen'.split(
    ' ',
  );
const NOUN =
  'Bear Cloud Delta Falcon Harbor Iron Jewel Kite Lantern Meadow Nebula Otter Pixel Quartz Rocket Sparrow Tiger Violet Walnut Zebra Anchor Breeze Compass Domino Ember Forge Glacier Harbor'.split(
    ' ',
  );
const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Retail',
  'Manufacturing',
  'Media',
  'Logistics',
  'Energy',
  'Hospitality',
];
const LOREM =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(
    ' ',
  );
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
];

/* -------------------------------- randomness ------------------------------- */

function randInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) return 0;
  if (maxExclusive === 1) return 0;
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}
const pick = <T>(arr: T[]): T => arr[randInt(arr.length)]!;

/* -------------------------------- generators ------------------------------- */

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

function uuidV4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const s = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
function objectId(): string {
  const t = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  let r = '';
  for (let i = 0; i < 16; i++) r += randInt(16).toString(16);
  return t + r;
}
function nanoid(): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let out = '';
  for (let i = 0; i < 21; i++) out += A[randInt(A.length)];
  return out;
}
function ulid(): string {
  const C = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = Date.now();
  let out = '';
  for (let i = 0; i < 10; i++) {
    out = C[t % 32] + out;
    t = Math.floor(t / 32);
  }
  for (let i = 0; i < 16; i++) out += C[randInt(32)];
  return out;
}
const loremSentence = () => {
  const n = 8 + randInt(8);
  const words = Array.from({ length: n }, () => pick(LOREM));
  return words[0]![0]!.toUpperCase() + words[0]!.slice(1) + ' ' + words.slice(1).join(' ') + '.';
};
const ipv4 = () => `${randInt(256)}.${randInt(256)}.${randInt(256)}.${randInt(256)}`;
const ipv6 = () =>
  Array.from({ length: 8 }, () => randInt(0x10000).toString(16).padStart(4, '0')).join(':');
const mac = () =>
  Array.from({ length: 6 }, () => randInt(256).toString(16).padStart(2, '0')).join(':');
const phone = () =>
  `+1-${200 + randInt(800)}-${200 + randInt(800)}-${(1000 + randInt(9000)).toString()}`;

/* --------------------------------- fields --------------------------------- */

type Row = Record<string, string | number>;

function makeRow(dataset: string): Row {
  const first = pick(FIRST);
  const last = pick(LAST);
  switch (dataset) {
    case 'person':
      return {
        firstName: first,
        lastName: last,
        fullName: `${first} ${last}`,
        age: 18 + randInt(70),
        gender: pick(['female', 'male', 'nonbinary']),
      };
    case 'contact':
      return {
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.${pick(TLDS)}`,
        phone: phone(),
      };
    case 'address':
      return {
        street: `${100 + randInt(9900)} ${pick(STREETS)} ${pick(['St', 'Ave', 'Rd', 'Blvd', 'Ln'])}`,
        city: pick(CITIES),
        state: pick(STATES),
        zip: (10000 + randInt(90000)).toString(),
        country: 'US',
      };
    case 'network': {
      const domain = `example-${randInt(100000)}.${pick(TLDS)}`;
      return {
        ipv4: ipv4(),
        ipv6: ipv6(),
        mac: mac(),
        domain,
        url: `https://${domain}/`,
        userAgent: pick(USER_AGENTS),
      };
    }
    case 'commerce': {
      const product = `${pick(ADJ)} ${pick(NOUN)}`;
      return {
        product,
        category: pick(INDUSTRIES),
        price: Number((randInt(100000) / 100).toFixed(2)),
        currency: pick(CURRENCIES),
        sku: `${pick(ADJ).slice(0, 3).toUpperCase()}-${1000 + randInt(9000)}`,
      };
    }
    case 'company': {
      const name = `${pick(ADJ)} ${pick(NOUN)} ${pick(['Labs', 'Inc', 'Group', 'Systems', 'Works'])}`;
      return {
        name,
        catchPhrase: loremSentence(),
        industry: pick(INDUSTRIES),
        domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${pick(TLDS)}`,
      };
    }
    case 'lorem':
      return { sentence: loremSentence() };
    default: {
      // ids
      return { uuid: uuidV4(), objectId: objectId(), nanoid: nanoid(), ulid: ulid() };
    }
  }
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const dataset = String(o.dataset ?? 'person');
  const rows = Math.max(1, Math.floor(Number(o.rows ?? 10)));
  const format = String(o.format ?? 'json');
  const tableName = String(o.tableName || 'data').replace(/[^A-Za-z0-9_]/g, '');

  const data = Array.from({ length: rows }, () => makeRow(dataset));
  const fields = Object.keys(data[0] ?? {});

  let output: string;
  let language = 'json';
  if (format === 'csv') {
    language = 'csv';
    output = [
      fields.join(','),
      ...data.map((r) => fields.map((f) => csvCell(r[f] ?? '')).join(',')),
    ].join('\n');
  } else if (format === 'sql') {
    language = 'sql';
    output = data
      .map((r) => {
        const cols = fields.map((f) => `"${f}"`).join(', ');
        const vals = fields
          .map((f) => {
            const v = r[f] ?? '';
            return typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');
        return `INSERT INTO ${tableName || 'data'} (${cols}) VALUES (${vals});`;
      })
      .join('\n');
  } else {
    output = JSON.stringify(data, null, 2);
  }

  return {
    output,
    render: 'code',
    language,
    filename: `${dataset}.${format === 'json' ? 'json' : format}`,
    stats: { rows, dataset, format },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;

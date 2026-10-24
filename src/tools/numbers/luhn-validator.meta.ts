import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'luhn-validator',
  name: 'Luhn Checksum Validator',
  category: 'numbers',
  summary: 'Validate and generate Luhn (mod-10) checksum numbers.',
  description:
    'Validate numbers that use the Luhn mod-10 algorithm (credit cards, IMEIs, some national ID and account numbers), generate a valid Luhn check digit for a number, and compute the expected check digit. Ignores non-digit separators such as spaces and dashes, and reports the card-network length prefixes when they look familiar.',
  keywords: [
    'Luhn',
    'mod-10',
    'checksum',
    'credit card validation',
    'IMEI',
    'check digit',
    'Luhn verify',
    'generate Luhn',
    'card number',
    'verhoeff',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'validate',
      choices: [
        { value: 'validate', label: 'Validate number' },
        { value: 'check-digit', label: 'Compute check digit' },
        { value: 'generate', label: 'Generate with check digit' },
      ],
    },
  ],
  examples: [
    { title: 'Validate a card number', input: '4539 1488 0343 6467' },
    { title: 'Compute a check digit', options: { mode: 'check-digit' } },
    { title: 'Validate an IMEI', input: '490154203237518' },
    { title: 'Append a check digit to a prefix', input: '7992739871', options: { mode: 'generate' } },
  ],
  article: [
    {
      heading: 'What the Luhn check proves',
      body: 'Luhn, also called modulus 10, is the checksum behind credit card numbers, IMEIs and many national identifiers. The tool takes a number, strips spaces and dashes, and reports whether the weighted digit sum is a multiple of ten. A pass means the digits are internally consistent — it says nothing about whether the account exists, is funded, or was ever issued.',
    },
    {
      heading: 'Three modes',
      body: 'Validate checks a complete number and, when the leading digits look like a known issuer, names the network it resembles. Compute check digit takes a number without its final digit and returns the digit that would complete it, showing why. Generate does the same and appends the result, which is handy when you need a syntactically valid test number for a form or a fixture.',
    },
    {
      heading: 'The right way to make test numbers',
      body: 'Payment sandboxes often reject a number that fails Luhn before it even reaches the mock. Paste any prefix in generate mode and the tool appends the correct check digit, so you get a number the front-end validator accepts without copying a real card from somewhere. The number is still not a real account — it is a well-formed string and nothing more.',
    },
    {
      heading: 'Limits and separators',
      body: 'Input may contain only digits, spaces and dashes; anything else is rejected rather than stripped, so a stray letter is reported instead of silently ignored. A validate run needs at least two digits, and the single-digit case is refused. The issuer hint is a best-effort prefix match against Visa, Mastercard, Discover and American Express and is shown as context, never as proof.',
    },
    {
      heading: 'Numbers never leave the tab',
      body: 'The checksum is computed locally with plain integer arithmetic. Even though card numbers are not secrets in the way a CVV is, running the check on your own machine avoids sending anything to a third party, and the tool needs no network at all.',
    },
  ],
  faq: [
    {
      q: 'What is Luhn?',
      a: 'The mod-10 algorithm used as a quick validity check for numbers that include a check digit, such as credit cards and IMEIs.',
    },
    {
      q: 'Does Luhn guarantee a real card?',
      a: 'No — passing Luhn only verifies the number is well-formed; it gives no signal about issuer, funds, or account status.',
    },
    {
      q: 'How is the check digit computed?',
      a: 'Process digits from the right, doubling every second one and subtracting 9 from results over 9, then choose the digit that makes the sum a multiple of 10.',
    },
  ],
  related: ['checksum-validator', 'random-string'],
  status: 'stable',
};

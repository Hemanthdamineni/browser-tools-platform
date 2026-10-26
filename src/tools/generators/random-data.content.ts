/**
 * Editorial content for the random-data tool page.
 *
 * Kept out of ``random-data.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it generates and how you get it out',
      body: 'Pick a dataset, a row count up to 500 and an output format. JSON returns an array of objects, CSV writes a header row plus RFC 4180-quoted cells, and SQL emits INSERT statements into the table name you provide. Every row comes from the same field set, so the columns line up across all three formats.',
    },
    {
      heading: 'The datasets',
      body: 'Person covers names, age and gender; Contact adds an email and phone; Address gives a street, city, state, zip and country; Network produces IPv4, IPv6, MAC, domain, URL and user-agent values; Commerce gives products with category, price, currency and SKU; Company gives a name, catch phrase, industry and domain; Lorem returns a sentence; and IDs returns a UUID, ObjectId, nanoid and ULID.',
    },
    {
      heading: 'A practical use',
      body: 'Filling a table view or a dashboard layout with realistic rows is the usual reason. Ten companies in JSON drop into a component story; twenty contacts in SQL seed a local database for a migration dry run. The output is deterministic in shape, so a snapshot test can check the schema while the values stay random.',
    },
    {
      heading: 'Randomness and correctness caveats',
      body: 'Values come from the browser CSPRNG with rejection sampling, so there is no modulo bias, but the name, city and street lists are finite — a few thousand rows will repeat. Generated emails sit under an example.* domain and phone numbers are synthetic. ULIDs and ObjectIds embed the current time.',
    },
    {
      heading: 'Nothing leaves your machine',
      body: 'Generation happens entirely in this tab with no request to a data service, so the output cannot be correlated with anything you typed. Rows are produced only when you run the tool and are not stored between visits.',
    },
  ],
  faq: [
    {
      q: 'Are the names and addresses real?',
      a: 'Names come from common first/last name lists and addresses from a mix of real city and street names, but the combinations are random. Treat any result as fiction — do not use it to impersonate anyone.',
    },
    {
      q: 'Which fields does each dataset include?',
      a: 'Person: first/last/full name, age, gender. Contact adds email and phone. Address: street, city, state, zip, country. Network: ipv4, ipv6, mac, domain, url, user agent. Commerce: product, category, price, currency, sku. Company: name, catch phrase, industry, domain. IDs: uuid, objectId, nanoid, ulid.',
    },
    {
      q: 'How many rows can I generate at once?',
      a: 'Between 1 and 500 per run. The cap keeps the browser responsive; run the tool again with different options, or paste several outputs together, when you need a larger fixture.',
    },
  ],
} as const;

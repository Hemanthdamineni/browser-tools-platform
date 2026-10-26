/**
 * Editorial content for the meta-tags tool page.
 *
 * Kept out of ``meta-tags.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the generator emits',
      body: 'Fill in a title and a description and you get a head block: a <title>, a meta description, an optional canonical link, a set of Open Graph properties and a set of Twitter card tags. Empty fields are simply omitted, so you can start with a title and add the social details later, and the output is ready to paste between <head> and </head>.',
    },
    {
      heading: 'The two fields that are always written',
      body: 'Open Graph type and the Twitter card type always appear, because both protocols require a value: og:type defaults to website and can be switched to article, while twitter:card defaults to summary_large_image with a plain summary alternative. Everything conditional \u2014 og:title, og:description, og:url, og:image, og:site_name and the matching twitter: fields \u2014 appears only when you supply it.',
    },
    {
      heading: 'Escaping and safe pasting',
      body: 'Every value is HTML-escaped before it goes in an attribute, so an ampersand becomes &amp; and a double quote becomes &quot;. A title containing quotes or angle brackets therefore cannot break out of the attribute and corrupt your head section \u2014 the kind of bug a hand-written tag block hides until a page title contains a stray character.',
    },
    {
      heading: 'What it does not do',
      body: 'The tool writes tags but does not validate them. It does not check that your canonical URL matches the page you are on, that the social image is reachable or the right size, or that the description lands in the length search engines prefer, and it emits no JSON-LD, favicon or viewport tags. There is no fetching or image inspection, and nothing is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Why are attribute values escaped?',
      a: 'Quotes and angle brackets are escaped (&quot; &lt; &gt; &amp;) so the generated HTML is safe to paste even when your title contains special characters.',
    },
    {
      q: 'Why is og:type always included even when I leave fields blank?',
      a: 'The Open Graph protocol requires a type, and the Twitter card tag is likewise mandatory. Both get a sensible default (website and summary_large_image), while every other tag appears only when you supply its value.',
    },
    {
      q: 'Can I generate a page with only a description?',
      a: 'Yes. The tool needs at least one of title or description; the title tag, og:title and twitter:title are simply dropped when no title is given, and the description tags are written instead.',
    },
  ],
} as const;

import { describe, it, expect } from 'vitest';
import { faqJsonLd, softwareAppJsonLd, breadcrumbJsonLd } from './seo';
import { ALL_TOOLS } from './registry';

/**
 * The escaping BaseHead applies before emitting a JSON-LD block. A literal
 * `</script` anywhere in the payload would end the block early and spill the
 * rest of the JSON into the page as JavaScript.
 */
const toInline = (schema: unknown) => JSON.stringify(schema).replace(/</g, '\\u003c');

const sampleMeta = ALL_TOOLS[0]!.meta;
/** A hostile FAQ: real prose that quotes a closing script tag. */
const sampleMetaFAQ = [{ q: 'Q', a: 'A </script> tag and <b>markup</b>.' }];

describe('JSON-LD escaping', () => {
  it('escapes a payload that quotes a closing script tag', () => {
    const faq = [
      {
        q: 'Does a closing tag in my code break the template?',
        a: 'No. The template neutralises a closing </script> inside your code so it cannot break out.',
      },
    ];
    const schema = faqJsonLd(sampleMeta, faq);
    expect(schema).toBeTruthy();

    const inline = toInline(schema);
    expect(inline).not.toContain('</script');
    expect(inline).not.toContain('<!--');
    expect(inline).toContain('\\u003c');
  });

  it('leaves the prose intact for a JSON consumer', () => {
    const faq = [{ q: 'Q', a: 'A closing </script> tag and <b>markup</b>.' }];
    const schema = faqJsonLd(sampleMeta, faq)!;
    const parsed = JSON.parse(toInline(schema)) as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };
    expect(parsed.mainEntity[0]!.acceptedAnswer.text).toBe(faq[0]!.a);
  });

  it('JSON.stringify alone is what leaks, proving the escape is load-bearing', () => {
    const faq = [{ q: 'Q', a: 'a </script> tag' }];
    const schema = faqJsonLd(sampleMeta, faq)!;
    expect(JSON.stringify(schema)).toContain('</script');
  });

  it('every tool page payload survives the escaping', () => {
    for (const tool of ALL_TOOLS) {
      for (const schema of [
        softwareAppJsonLd(tool.meta),
        breadcrumbJsonLd(tool.meta),
        faqJsonLd(tool.meta, sampleMetaFAQ),
      ]) {
        if (!schema) continue;
        const inline = toInline(schema);
        expect(inline.toLowerCase(), tool.meta.id).not.toContain('</script');
        expect(inline.toLowerCase(), tool.meta.id).not.toContain('<!--');
        expect(() => JSON.parse(inline), tool.meta.id).not.toThrow();
      }
    }
  });
});

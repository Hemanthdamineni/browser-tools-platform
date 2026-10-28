/**
 * Editorial content for the warc-archive-inspector tool page.
 *
 * Kept out of ``warc-archive-inspector.meta.ts`` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Open a WARC or WARC.GZ web archive and read it without a crawler: the file header gives the archive version and writer software, then every record is listed with its type (warcinfo, request, response, revisit, resource, metadata, conversion, continuation), target URI, capture date, IP, content type and declared length. For response records the embedded HTTP status line and headers are read too, so you can see what the crawl actually received.',
    },
    {
      heading: 'Why records can read out of sync',
      body: 'WARC is a sequence of header blocks each followed by exactly WARC-Content-Length bytes of payload, then two CRLFs. The inspector walks that declared length rather than guessing at delimiters, so when a length disagrees with the bytes on disk it reports the offset where parsing lost sync and the record type it was reading — the usual signature of a truncated download, a corrupt transfer, a partial write, or an archive concatenated mid-record.',
    },
    {
      heading: 'Recomputing the block digest',
      body: 'A record may declare a WARC-Block-Digest; the inspector recomputes it over the block and compares. A mismatch is reported as a finding with the algorithm used. Records without a declared digest are marked unchecked rather than assumed sound, because absence is not integrity — it only means the archive never recorded that check.',
    },
    {
      heading: 'gzip and multi-record containers',
      body: 'A WARC.GZ record is conventionally one gzip member, and the tool supports a gzip-compressed archive by decompressing members in sequence. Both plain .warc and .warc.gz are accepted, and anything the parser cannot reconcile is a finding, never a silent truncation: an unterminated header, a compressed record whose header says otherwise, or trailing bytes after the last record are all surfaced.',
    },
  ],
  faq: [
    {
      q: 'Does opening an archive fetch anything from the web?',
      a: 'No. The file is decoded and its records are listed entirely in this tab. Nothing is uploaded and no URL inside the archive is requested, so a crawl of private or authenticated pages is never re-triggered by inspecting it.',
    },
    {
      q: 'What does "lost sync at byte N" mean?',
      a: 'It is the offset where the record you were reading declared a length that did not match the bytes present. The parser consumes exactly the declared Content-Length, so a short or long value misaligns every following header; that first disagreement is the useful point of failure, and it is usually where the archive was truncated or re-concatenated.',
    },
    {
      q: 'Why is a block digest reported as unchecked?',
      a: 'The record carried no WARC-Block-Digest, or declared an algorithm this tool does not implement. The inspector can only compare what the archive recorded against what it recomputes; nothing recorded means nothing to compare, so it says so rather than implying the block is intact.',
    },
    {
      q: 'Can I open a .warc.gz as-is?',
      a: 'Yes — both uncompressed .warc and gzip-compressed .warc.gz are accepted (also with a .warcgz spelling). A gzip member that fails to inflate is reported at its offset instead of stopping the whole inspection.',
    },
  ],
} as const;

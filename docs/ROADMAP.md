# Roadmap

Prioritised by demand × client-side feasibility × maintenance cost. "Ship" =
pure JS / Web Crypto / Canvas / Web Audio / an already-vendored MIT-or-permissive
library. "Later" = needs a heavy WASM module or a new dependency to review.
"Avoid" = not honestly doable client-side, or dilutes trust.

## Shipping now (tranche 1)

Encoding: base64, base32, hex, URL, HTML entities, Unicode escape, quoted-printable,
JWT decode, punycode.
Crypto: hash (text), file hash ✔, HMAC, CRC32, password / passphrase generator,
AES-GCM text & file encryption (Web Crypto + PBKDF2).
Text: case convert, sort/dedupe/reverse lines, find & replace (regex), statistics,
slugify, whitespace cleanup, diff, ROT13/Caesar, Morse, NATO, binary↔text,
Lorem Ipsum, string ↔ char codes, line-ending convert.
Data: JSON format/validate/minify, JSON↔YAML, JSON↔CSV, JSON↔XML, CSV↔Markdown,
JSON to TS/Go/JSON-Schema, query-string ↔ JSON, `.env` ↔ JSON.
Developer: regex tester, cron explainer + next runs, number-base convert,
chmod calculator, hash identifier, snowflake/ObjectId decode, UUID v5.
Web: URL parser, meta-tag generator, `robots.txt` / `.gitignore` / `.editorconfig`
generators, CSS unit convert, box-shadow / gradient / border-radius generators,
data-URI ↔ file.
Colour: convert ✔, contrast checker, palette, gradient, blindness simulator.
Date/time: unix timestamp convert, timezone convert, duration/diff, age, week
number, cron → human.
Numbers: unit converter (length/mass/temp/data/…), percentage, roman numerals,
number to words, GCD/LCM/primes, statistics, random number/dice/picker.
Generators: UUID ✔, NanoID, ULID, QR code (text/URL/wifi/vcard), barcode
(Code 128/39, EAN-13/8, UPC-A, ITF-14, DataMatrix), lorem, fake data,
vCard, iCal, UTM link builder.
Network: IPv4/IPv6 validate + expand, CIDR / subnet calculator, IP ↔ integer,
user-agent parser, MAC format.
Image (Canvas): compress, resize, convert (PNG/JPEG/WebP), crop, rotate/flip,
metadata strip, EXIF viewer, to data-URI, colour picker / palette from image,
placeholder generator, image diff.
PDF (pdf-lib / pdf.js): merge, split, rotate, delete/reorder pages, page numbers,
metadata edit, images → PDF, PDF → images, watermark, text extract.
Archive (fflate): zip create / extract / inspect, gzip, tar, file splitter/joiner,
checksum/SFV, duplicate-file finder.
Audio (Web Audio): recorder → WAV, trim, convert to WAV, info, merge, normalise,
tone generator, metronome, waveform view.
Everyday: stopwatch/timer/countdown, world clock, pomodoro, calculator,
programmer calculator, tip/split, BMI, aspect-ratio, bandwidth/time, data-size.

## Later (needs a dependency review or heavy WASM)

- SQL formatter (`sql-formatter`), HTML/JS/CSS beautify + minify.
- HTML ↔ Markdown (`turndown`).
- SVG optimiser (`svgo`) — heavy; a light DIY cleaner ships now.
- OCR (`tesseract.js` + models, ~10 MB) — lazy, opt-in, clearly labelled.
- Real image codecs: AVIF encode, MozJPEG, OxiPNG (WASM) for better ratios than Canvas.
- Video: trim / convert / to-GIF. `ffmpeg.wasm` licence needs legal review;
  prefer WebCodecs where available. Screen + webcam recording ship now.
- QR **reading** where `BarcodeDetector` is missing (`jsQR`).
- Spreadsheet (`xlsx`) for CSV ↔ XLSX.
- Multi-GB streaming hashing / compression (incremental-hash lib, OPFS).
- `zxcvbn` password-strength (heavy) — a DIY entropy estimate ships now.

## Avoid (deliberately)

- Any server-side processing, cloud sync, accounts, file history.
- Full multi-track video editing (browser memory / codec limits).
- Large ML features (background removal, upscaling) — model sizes impractical.
- Low-value one-off "calculators" that add SEO thin-content risk.

## Platform / infra

- **Astro 7 upgrade** (+ Tailwind v4 via `@tailwindcss/vite`) to clear the
  dev-server advisories in `npm audit`. See `SECURITY.md`.
- Per-tool OG images.
- Dedup worker/main-thread tool chunks.
- i18n scaffolding (copy is centralised; not yet externalised).
- Optional privacy-respecting, self-hosted aggregate page-view counter (opt-in).

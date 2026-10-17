# Complete Tool List

Total: **268** tools across **18** categories.

Generated from `src/tools/**/*.meta.ts` (source of truth).

## archive (11)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `tar-create` | Create TAR Archive | file | stable | Bundle files into a TAR (optionally gzipped .tar.gz) archive. |
| `zip-create` | Create ZIP Archive | file | stable | Create a ZIP archive from one or more files. |
| `tar-extract` | Extract TAR Archive | file | stable | Extract regular files from .tar, .tar.gz and .tgz archives. |
| `zip-extract` | Extract ZIP Archive | file | stable | Extract the entries of a ZIP archive as individual download files. |
| `file-metadata` | File Metadata | file | stable | Inspect file names, sizes, MIME types, timestamps and SHA-256 hashes. |
| `file-signature` | File Signature Inspector | file | stable | Identify common file formats from their bytes instead of trusting the extension. |
| `base64-file` | File to Base64 | file | stable | Encode a file as Base64 text or decode Base64 into a file. |
| `gzip` | Gzip Compress / Decompress | file | stable | Compress a file to .gz or decompress a .gz file back to its original bytes. |
| `zip-inspect` | Inspect ZIP Archive | file | stable | Inspect the files, sizes and compression ratio inside a ZIP archive. |
| `file-join` | Join File Chunks | file | stable | Join numbered file chunks into one file and verify an optional manifest. |
| `file-split` | Split File into Chunks | file | stable | Split a large file into numbered part chunks plus a JSON manifest. |

## audio (10)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `audio-gain` | Adjust Audio Volume | file | stable | Raise or lower an audio file by a set amount in dB. |
| `audio-channels` | Audio Channel Tools | file | stable | Convert mono and stereo, swap channels, isolate left/right, or encode mid-side. |
| `audio-info` | Audio File Info | file | stable | Inspect an audio file: duration, sample rate, channels, bitrate, peak and clipping. |
| `audio-speed` | Change Audio Speed | file | stable | Speed up or slow down audio, optionally preserving pitch approximately. |
| `audio-to-wav` | Convert Audio to WAV | file | stable | Convert browser-supported audio files to uncompressed 16-bit PCM WAV. |
| `audio-fade` | Fade Audio In / Out | file | stable | Apply a linear, exponential or logarithmic fade in and fade out to audio. |
| `audio-merge` | Merge / Concatenate Audio | file | stable | Join audio files end-to-end or mix them together into one WAV. |
| `audio-normalize` | Normalise Audio | file | stable | Scale audio to a target peak or RMS level (in dBFS) without changing the length. |
| `audio-reverse` | Reverse Audio | file | stable | Reverse an audio clip sample-for-sample and save the result as WAV. |
| `audio-trim` | Trim / Clip Audio | file | stable | Cut an audio file to a range and apply click-free fade in/out edges. |

## color (7)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `color-blend` | Color Blender | text | stable | Mix two colors in RGB or HSL space with a 0-100% blend ratio. |
| `color-blindness` | Color Blindness Simulator | text | stable | Simulate protanopia, deuteranopia, tritanopia and achromatopsia on your colors. |
| `color-contrast` | Color Contrast Checker | text | stable | Check WCAG 2.1 contrast ratios for foreground/background colour pairs. |
| `color-name` | Color Name Finder | text | stable | Find the nearest of the 148 CSS named colors, ranked by perceptual distance. |
| `color-palette` | Color Palette Generator | text | stable | Generate tints, shades, complementary, triadic and analogous color palettes. |
| `color-convert` | Colour Converter | text | stable | Convert a colour between HEX, RGB, HSL, HSV, CMYK and OKLCH. |
| `color-random` | Random Color Generator | text | stable | Generate random colors in a chosen style - warm, cool, pastel, vivid and more. |

## converters (1)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `docx-to-markdown` | DOCX to Markdown | file | stable | Turn a Word .docx into Markdown or plain text locally — headings, lists and tables. |

## crypto (4)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `crc32` | CRC-32 / Adler-32 Checksum | text | stable | Compute CRC-32, CRC-32C or Adler-32 checksums of text, as hex or decimal. |
| `file-hash` | File Hash / Checksum | file | stable | Compute SHA-256/384/512 and SHA-1 checksums for one or more files. |
| `hmac` | HMAC Generator | text | stable | Compute an HMAC of text with a secret key using SHA-1, SHA-256, SHA-384 or SHA-512. |
| `hash` | Text Hash Generator | text | stable | Hash text with MD5, SHA-1, SHA-256, SHA-384 or SHA-512 and output hex, Base64 or base64url. |

## data (16)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `dotenv` | .env <-> JSON | text | stable | Parse a .env file into JSON, or turn a JSON object into .env text. Runs entirely on your device. |
| `csv-sanitize` | CSV Formula Injection Guard | text | stable | Detect and neutralize spreadsheet formula injection in CSV cells. |
| `csv-to-json` | CSV to JSON | text | stable | Parse CSV (RFC 4180) into a JSON array, with delimiter sniffing and type inference. |
| `json-diff` | JSON Diff | text | stable | Structural diff of two JSON documents, showing added, removed and changed values by path. |
| `json-format` | JSON Formatter & Validator | text | stable | Pretty-print, minify, recursively sort keys or validate JSON, with line/column errors. |
| `json-patch` | JSON Patch | text | stable | Apply RFC 6902 JSON Patch operations to a JSON document in your browser. |
| `json-schema-check` | JSON Schema Checker | text | stable | Validate JSON against a practical subset of JSON Schema keywords. |
| `json-escape` | JSON String Escape / Unescape | text | stable | Turn raw text into a quoted JSON string literal, or decode a JSON string literal back. |
| `json-to-csv` | JSON to CSV | text | stable | Turn a JSON array of objects into CSV, with delimiter, header, and flatten options. |
| `json-to-jsonschema` | JSON to JSON Schema | text | stable | Infer a JSON Schema (draft 2020-12) from a JSON sample, with required and additionalProperties control. |
| `json-to-typescript` | JSON to TypeScript | text | stable | Generate TypeScript interfaces or type aliases from a JSON sample, with nested named types. |
| `json-to-yaml` | JSON to YAML | text | stable | Convert JSON to YAML on your device, with a 2- or 4-space indent. |
| `ndjson` | NDJSON <-> JSON Array | text | stable | Convert newline-delimited JSON to a JSON array and back, one compact value per line. |
| `querystring` | Query String <-> JSON | text | stable | Parse a URL query string into JSON, or build a query string from a JSON object. Local only. |
| `xml-format` | XML Formatter | text | stable | Pretty-print or minify XML with a pure-JS tokenizer — comments, CDATA and PIs kept intact. |
| `yaml-to-json` | YAML to JSON | text | stable | Convert YAML to JSON locally, with indent choice and optional key sorting. |

## datetime (8)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `age-calculator` | Age Calculator | text | stable | Work out an exact age plus totals, zodiac sign and next birthday. |
| `date-add` | Date Add / Subtract | text | stable | Add or subtract years, months, days, hours and minutes from a date. |
| `date-diff` | Date Difference Calculator | text | stable | Measure the exact gap between two dates in every unit, including business days. |
| `duration-convert` | Duration Converter | text | stable | Convert durations between human, ISO 8601, clock and plain-seconds forms. |
| `rrule-builder` | iCalendar Recurrence Rule Builder | text | stable | Build and validate RFC 5545 RRULE recurrence strings for calendar events. |
| `timezone-convert` | Timezone Converter | text | stable | Convert a date and time across world timezones in one table. |
| `timestamp` | Unix Timestamp Converter | text | stable | Convert Unix timestamps to dates and dates to every common timestamp format. |
| `week-number` | Week Number Calculator | text | stable | Get the ISO 8601 week number plus day-of-year, quarter and leap-year facts. |

## developer (19)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `ansi-sequences` | ANSI Escape Sequence Inspector | text | stable | Strip, visualize, or inspect ANSI terminal escape sequences in text and logs. |
| `backslash-escape` | Backslash Escape / Unescape | text | stable | Turn control characters into readable \\n \\t \\xNN \\uNNNN sequences, or interpret those sequences back into characters. |
| `chmod-calculator` | chmod Permission Calculator | text | stable | Convert Unix file permissions between octal (755) and symbolic (rwxr-xr-x), with a per-class breakdown. |
| `cron-parser` | Cron Expression Parser | text | stable | Explain a cron expression in plain English and list its next run times in UTC. |
| `curl-to-code` | cURL to Code | text | stable | Turn a curl command into ready-to-run code for 12 languages and frameworks. |
| `hash-identifier` | Hash Identifier | text | stable | Guess which hash or password format a string is, from its length and character set. |
| `html-to-text` | HTML to Plain Text | text | stable | Strip HTML tags to clean, readable plain text — entities decoded, block layout preserved. |
| `markdown-table` | Markdown Table Formatter | text | stable | Normalize Markdown pipe tables and optionally align their columns. |
| `markdown-to-html` | Markdown to HTML | text | stable | Convert Markdown to HTML source code — see the generated markup, not a preview. |
| `objectid` | MongoDB ObjectId | text | stable | Decode a 24-character MongoDB ObjectId into its timestamp, random and counter bytes. |
| `uuid-namespace` | Namespaced UUID (v3 / v5) | text | stable | Generate a deterministic name-based UUID (v5 SHA-1 or v3 MD5) from a namespace and name. |
| `number-base` | Number Base Converter | text | stable | Convert an integer between any bases from 2 to 36 with arbitrary precision (BigInt). |
| `regex-tester` | Regex Tester | text | stable | Test a JavaScript regular expression against text — highlight, list matches, replace or split. |
| `semver` | Semantic Version Tool | text | stable | Validate, compare, and sort Semantic Versioning 2.0.0 values. |
| `snowflake` | Snowflake ID Decoder | text | stable | Decode a 64-bit Snowflake ID into its timestamp, worker, process and sequence parts. |
| `sql-format` | SQL Formatter (basic) | text | stable | Pretty-print a SQL query: keyword casing, clause line breaks, indented joins and columns. |
| `string-escape` | String Escaper | text | stable | Escape or unescape text for a target language or context — JS, JSON, C, Java, Python, shell, SQL, CSV, HTML, XML, URL. |
| `diff-text` | Text Diff | text | stable | Compare two blocks of text and see the differences as a unified diff or an inline word/character diff. |
| `text-inspector` | Text Encoding & Character Inspector | text | stable | Inspect BOMs, line endings, control characters, and Unicode code points in text. |

## encoding (11)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `ascii85` | Ascii85 / Base85 | text | stable | Encode and decode Ascii85 / Base85 text in the Adobe, btoa and Z85 variants. |
| `base32` | Base32 Encode / Decode | text | stable | RFC 4648 Base32 and Crockford Base32 encoding and decoding of text. |
| `base58` | Base58 Encode / Decode | text | stable | Convert text to and from Base58 using the Bitcoin and IPFS alphabet. |
| `base64` | Base64 Encode / Decode | text | stable | Convert text to and from Base64, with URL-safe and MIME line-wrap options. |
| `hex` | Hex Encode / Decode | text | stable | Convert text to and from hexadecimal (UTF-8), with configurable separators. |
| `html-entities` | HTML Entity Encode / Decode | text | stable | Escape text for safe insertion into HTML, or decode named and numeric entities. |
| `jwt-decode` | JWT Decoder | text | stable | Decode a JSON Web Token and pretty-print its header and payload. Does not verify the signature. |
| `jwt-sign` | JWT Signer | text | stable | Create and sign JSON Web Tokens with HMAC, or verify an existing token’s signature. |
| `quoted-printable` | Quoted-Printable Encode / Decode | text | stable | Encode or decode MIME quoted-printable (=XX escapes, soft line breaks). |
| `unicode-escape` | Unicode Escape / Unescape | text | stable | Convert text to and from \\uXXXX, \\xXX, \\u{...}, HTML and CSS escape forms. |
| `url-encode` | URL Encode / Decode | text | stable | Percent-encode or decode text for use in URLs — component or whole-URL mode. |

## generators (15)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `barcode` | Barcode Generator | text | stable | Create Code 128, Code 39, EAN-13/8, UPC-A and ITF-14 barcodes as crisp, scannable SVG. |
| `random-data` | Fake Data Generator | text | stable | Generate realistic fake datasets — people, contacts, addresses, products — as JSON, CSV or SQL. |
| `ical-event` | iCalendar Event Generator | text | stable | Create an .ics calendar event file with reminders that imports into any calendar app. |
| `lorem-ipsum` | Lorem Ipsum Generator | text | stable | Generate lorem ipsum placeholder text as words, sentences, paragraphs, lists — plain, HTML or Markdown. |
| `metronome-click` | Metronome Click Track | text | stable | Generate a metronome click track as a WAV file at any tempo, bars and time signature. |
| `nanoid` | NanoID Generator | text | stable | Generate compact, URL-safe NanoIDs with unbiased randomness, in bulk. |
| `otp-uri` | OTP Auth URI Generator | text | stable | Build otpauth:// URIs (TOTP/HOTP) with a base32 secret for authenticator apps. |
| `placeholder-svg` | Placeholder Image Generator | text | stable | Generate sized SVG placeholder images with a custom label and colours for layouts and mockups. |
| `qr-scanner` | QR & Barcode Scanner | file | beta | Scan QR codes and barcodes from your camera or an image — decoded on-device with actions. |
| `qr-code` | QR Code Generator | text | stable | Generate QR codes for text, URLs, Wi-Fi, email, SMS and locations as crisp SVG. |
| `tone-generator` | Tone / Signal Generator | text | stable | Generate a tone, waveform or noise signal as a downloadable WAV file. |
| `ulid` | ULID Generator | text | stable | Generate sortable ULIDs (timestamp + randomness) in Crockford base32. |
| `utm-builder` | UTM Campaign URL Builder | text | stable | Add utm_source, utm_medium, utm_campaign and more tracking parameters to any URL. |
| `uuid` | UUID Generator | text | stable | Generate RFC 4122 UUIDs (v4 random or v7 time-ordered) in bulk. |
| `vcard` | vCard Generator | text | stable | Build vCard 3.0 contact files, or parse a pasted vCard back into fields. |

## image (13)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `image-compress` | Compress Image | file | stable | Reduce image file size by re-encoding locally in your browser. |
| `image-convert` | Convert Image Format | file | stable | Convert images between PNG, JPEG, WebP and AVIF in your browser. |
| `image-crop` | Crop Image | file | stable | Crop an image to an aspect ratio or explicit pixel rectangle. |
| `datauri-to-image` | Data URI to Image | file | beta | Decode an image data URI from a text file into an image file. |
| `image-palette` | Extract Colour Palette | file | stable | Extract the dominant colour palette from an image locally. |
| `favicon-generator` | Favicon Generator | file | beta | Generate favicon, Apple touch, and Android icon assets from one image. |
| `image-diff` | Image Difference | file | beta | Compare two images and visualize their pixel differences. |
| `image-metadata` | Image Metadata & EXIF Viewer | file | stable | Inspect image dimensions, file details, and common JPEG EXIF tags. |
| `image-to-datauri` | Image to Data URI | file | beta | Encode an image as a data URI for HTML, CSS, or source code. |
| `image-resize` | Resize Image | file | stable | Resize images by percentage or to exact dimensions, entirely in your browser. |
| `image-rotate` | Rotate / Flip Image | file | stable | Rotate images by 90-degree steps or flip them horizontally and vertically. |
| `image-spritesheet` | Sprite Sheet Builder | file | beta | Combine multiple images into one sprite sheet with a position map. |
| `svg-to-png` | SVG to PNG | file | beta | Rasterize an SVG image to a downloadable PNG. |

## misc (8)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `aspect-ratio` | Aspect Ratio Calculator | text | stable | Solve, simplify or look up common aspect ratios and resolutions. |
| `bmi-calculator` | BMI Calculator | text | stable | Calculate body mass index from metric or imperial measurements. |
| `data-size` | Data Size Converter | text | stable | Convert data sizes between bytes, decimal/binary units and bits. |
| `calculator` | Expression Calculator | text | stable | Evaluate a mathematical expression with a safe parser — no eval, ever. |
| `loan-calculator` | Loan / EMI Calculator | text | stable | Compute monthly payments, total interest and a payoff timeline for a loan. |
| `programmer-calculator` | Programmer Calculator | text | stable | Calculate integer expressions with bitwise operators in multiple bases. |
| `random-picker` | Random Picker / Shuffler | text | stable | Pick random list items, shuffle an order or deal balanced teams. |
| `tip-calculator` | Tip Calculator | text | stable | Calculate a tip, bill total and per-person split. |

## network (1)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `cidr-calculator` | CIDR Calculator | text | stable | Calculate network address, range, broadcast and host count for any IPv4 or IPv6 CIDR block. |

## numbers (3)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `number-to-words` | Number to Words | text | stable | Spell out numbers in cardinal or ordinal English words with flexible casing. |
| `roman-numeral` | Roman Numeral Converter | text | stable | Convert numbers to Roman numerals and back, with optional vinculum notation. |
| `unit-convert` | Unit Converter | text | stable | Convert between units of length, mass, temperature, data and more. |

## pdf (12)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `pdf-page-numbers` | Add Page Numbers | file | stable | Stamp page numbers onto a PDF in the position and format you choose. |
| `pdf-compress` | Compress PDF | file | beta | Shrink a PDF by re-encoding its images and rebuilding the file, with before/after size. |
| `pdf-delete-pages` | Delete Pages | file | stable | Remove selected pages from a PDF and download the trimmed document. |
| `pdf-extract-pages` | Extract Pages | file | stable | Pull selected pages out of a PDF into a new document. |
| `pdf-extract-text` | Extract PDF Text | file | stable | Extract selectable text from every page of a PDF. |
| `images-to-pdf` | Images to PDF | file | stable | Combine image files into a PDF, with one image per page. |
| `pdf-merge` | Merge PDFs | file | stable | Combine several PDF files into one document, page by page. |
| `pdf-to-images` | PDF to Images | file | stable | Render selected PDF pages as PNG, JPEG, or WebP images. |
| `pdf-rotate` | Rotate Pages | file | stable | Rotate every page — or a selection — of a PDF by 90, 180, or 270 degrees. |
| `pdf-split` | Split PDF | file | stable | Split a PDF into one file per page, per range, or into fixed-size chunks. |
| `pdf-metadata` | View / Edit PDF Metadata | file | stable | Inspect document properties or update PDF title, author, subject, keywords and more. |
| `pdf-watermark` | Watermark PDF | file | stable | Overlay translucent text on selected PDF pages as a centered or tiled watermark. |

## security (7)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `security-headers` | HTTP Security Headers Analyzer | text | stable | Review pasted HTTP response headers for common browser security protections. |
| `checksum-validator` | Identifier Checksum Validator | text | stable | Check Luhn, IBAN MOD-97, ISBN-10, and ISBN-13 checksums locally. |
| `passphrase` | Passphrase Generator | text | stable | Diceware-style passphrases from an embedded word list — memorable and high-entropy. |
| `password` | Password Generator | text | stable | Generate strong random passwords with your browser CSPRNG — no bias, nothing uploaded. |
| `random-string` | Random String Generator | text | stable | Generate random strings from a chosen character set with an unbiased browser CSPRNG. |
| `secret-scanner` | Secret & Credential Scanner | text | stable | Find and optionally redact likely credentials in pasted text or configuration. |
| `text-encrypt` | Text Encryption (AES-GCM) | text | stable | Encrypt or decrypt text with a passphrase using AES-256-GCM and PBKDF2, entirely on your device. |

## text (18)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `line-numbers` | Add Line Numbers | text | stable | Prefix every line with a running number, with configurable start, separator, zero-padding. |
| `case-convert` | Case Converter | text | stable | Convert between UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case and more. |
| `char-frequency` | Character Frequency | text | stable | Count how often each character occurs, with scope filters, optional case folding and count or character sorting. |
| `find-replace` | Find and Replace | text | stable | Replace text by plain string, whole word, or regular expression, with optional case folding. |
| `indent-text` | Indent / Dedent Text | text | stable | Add or remove leading indentation on every line, using spaces or tabs, with an optional skip for blank lines. |
| `morse-code` | Morse Code Translator | text | stable | Translate text to International Morse code and back, tolerant of messy spacing. |
| `nato-phonetic` | NATO Phonetic Alphabet | text | stable | Spell text with the NATO/ICAO phonetic alphabet (Alfa, Bravo, Charlie…) and back. |
| `dedupe-lines` | Remove Duplicate Lines | text | stable | Delete repeated lines from a list, keeping the first or last occurrence. |
| `remove-empty-lines` | Remove Empty Lines | text | stable | Strip blank and whitespace-only lines, collapse blank runs to one, or trim trailing blanks. |
| `text-repeat` | Repeat Text | text | stable | Repeat the input a set number of times, joined by a newline, space, comma, or custom separator. |
| `reverse-text` | Reverse Text | text | stable | Reverse text by character, word, sentence or line — emoji-safe. |
| `rot13` | ROT13 / Caesar Cipher | text | stable | Apply ROT13, ROT5, ROT18, ROT47 or an arbitrary Caesar shift to text. |
| `slugify` | Slugify | text | stable | Turn a title into a clean URL slug — lowercase, hyphenated, accent-folded. |
| `sort-lines` | Sort Lines | text | stable | Sort lines alphabetically, numerically, by length, naturally, or shuffle them. |
| `text-stats` | Text Statistics | text | stable | Count characters, words, sentences, paragraphs and lines, with reading and speaking time estimates. |
| `unicode-normalize` | Unicode Normalizer | text | stable | Normalize Unicode text, optionally remove accents and standardize line endings. |
| `word-frequency` | Word Frequency Counter | text | stable | Count how often each word appears, with case folding, a minimum length, stop-word removal and a top-N limit. |
| `wrap-text` | Wrap / Unwrap Text | text | stable | Hard-wrap text to a fixed column width with greedy word wrap, or unwrap wrapped lines back into paragraphs. |

## web (104)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `editorconfig` | .editorconfig Generator | text | stable | Generate an .editorconfig with your indentation, line-ending and charset settings. |
| `gitignore` | .gitignore Generator | text | stable | Generate a .gitignore for Node, Python, Rust, Go, Java, macOS, Windows and more. |
| `accept-ch` | Accept-CH Builder & Analyzer | text | stable | Build or inspect HTTP client-hints opt-in values. |
| `accept-language` | Accept-Language Header Analyzer | text | stable | Analyze and build Accept-Language values |
| `accept-patch` | Accept-Patch Builder & Analyzer | text | stable | Build or inspect HTTP Accept-Patch media-type capabilities. |
| `accept-post` | Accept-Post Builder & Analyzer | text | stable | Build or inspect HTTP Accept-Post media-type capabilities. |
| `access-control-allow-credentials` | Access-Control-Allow-Credentials Builder & Analyzer | text | stable | Build or inspect the CORS credentials flag. |
| `access-control-allow-methods-headers` | Access-Control-Allow-Methods & Headers Builder | text | stable | Build or inspect CORS preflight grant lists. |
| `access-control-allow-origin` | Access-Control-Allow-Origin Builder & Analyzer | text | stable | Build or inspect CORS origin grants. |
| `access-control-expose-headers` | Access-Control-Expose-Headers Builder | text | stable | Build or inspect exposed cross-origin response headers. |
| `access-control-max-age` | Access-Control-Max-Age Builder & Analyzer | text | stable | Build or inspect the CORS preflight cache time. |
| `age-header` | Age Response Header Analyzer | text | stable | Validate Age response header cache residency. |
| `allow-header` | Allow Header Builder & Analyzer | text | stable | Build or inspect HTTP Allow method lists for API responses. |
| `alt-svc` | Alt-Svc Builder & Analyzer | text | stable | Build or inspect HTTP Alt-Svc alternate-service advertisements. |
| `alt-used` | Alt-Used Header Analyzer | text | stable | Validate the Alt-Used request header back to the origin. |
| `authentication-info` | Authentication-Info Builder & Analyzer | text | stable | Build or inspect HTTP Authentication-Info parameters. |
| `cache-headers` | Cache Headers Builder & Analyzer | text | beta | Build or analyze Cache-Control, CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status, and Vary. |
| `cache-control` | Cache-Control Builder & Analyzer | text | stable | Build or review HTTP Cache-Control directives for browser and CDN caching. |
| `cache-status` | Cache-Status Header Analyzer (RFC 9211) | text | stable | Analyze RFC 9211 Cache-Status debug fields. |
| `cdn-cache-control` | CDN-Cache-Control Builder & Analyzer | text | stable | Build or inspect CDN-Cache-Control directives. |
| `clear-site-data` | Clear-Site-Data Builder & Analyzer | text | stable | Build or inspect site storage-wipe signals. |
| `conditional-request-headers` | Conditional Request Headers Builder & Analyzer | text | beta | Build and analyze ETag, Last-Modified and the If-* request conditions. |
| `connection-header` | Connection Header Builder & Analyzer | text | stable | Build or inspect HTTP/1.1 Connection control tokens. |
| `content-digest` | Content-Digest Builder & Analyzer | text | stable | Build or inspect HTTP Content-Digest integrity fields. |
| `content-disposition` | Content-Disposition Builder & Parser | text | stable | Build or inspect Content-Disposition download and inline headers. |
| `content-language` | Content-Language Builder & Analyzer | text | stable | Build or inspect HTTP Content-Language locale tags. |
| `content-length-app` | Content-Length & Body Byte Counter | text | stable | Compute body byte length and verify content-length. |
| `content-location` | Content-Location Builder & Analyzer | text | stable | Build or inspect HTTP Content-Location resource references. |
| `content-md5` | Content-MD5 Builder & Analyzer | text | stable | Build or verify legacy Content-MD5 integrity values. |
| `content-security-policy` | Content-Security-Policy Builder & Analyzer | text | stable | Build or inspect CSP directives and sources. |
| `content-type` | Content-Type Header Builder & Parser | text | stable | Build or inspect HTTP media-type headers, charsets, and multipart boundaries. |
| `cookie-request` | Cookie Request Header Analyzer | text | stable | Parse and inspect Cookie request-header pairs. |
| `cors-headers` | CORS Headers Builder & Analyzer | text | beta | Build a full CORS policy or analyze pasted Access-Control-* response headers. |
| `critical-ch` | Critical-CH Builder & Analyzer | text | stable | Build or inspect HTTP critical client-hints values. |
| `cross-origin-embedder-policy` | Cross-Origin-Embedder-Policy Builder & Analyzer | text | stable | Build or inspect cross-origin resource embedding controls. |
| `cross-origin-opener-policy` | Cross-Origin-Opener-Policy Builder & Analyzer | text | stable | Build or inspect browsing-context opener isolation. |
| `cross-origin-resource-policy` | Cross-Origin-Resource-Policy Builder & Analyzer | text | stable | Build or inspect CORP resource-embedding policies. |
| `box-shadow` | CSS Box Shadow Generator | text | stable | Generate box-shadow rules — single or layered soft shadows. |
| `gradient-css` | CSS Gradient Generator | text | stable | Build linear, radial and conic CSS gradients with custom colour stops. |
| `css-grid` | CSS Grid Generator | text | stable | Generate CSS Grid layout declarations for tracks, gaps, alignment, and named areas. |
| `css-units` | CSS Unit Converter | text | stable | Convert between px, rem, em, pt, pc, in, cm, mm and % for CSS lengths. |
| `cubic-bezier` | Cubic Bezier Explorer | text | stable | Sample a cubic-bezier() easing curve and find the nearest CSS keyword. |
| `data-uri` | Data URI Converter | text | stable | Encode text as a data: URI, or decode a data: URI back to text. |
| `date-header` | Date Header Builder & Analyzer | text | stable | Build or inspect HTTP Date response timestamps. |
| `document-policy` | Document-Policy Builder & Analyzer | text | stable | Build or inspect Document-Policy behavior controls. |
| `early-data` | Early-Data Builder & Analyzer | text | stable | Build or inspect HTTP Early-Data replay signals. |
| `etag` | ETag Builder & Analyzer | text | stable | Build and compare HTTP entity tags for conditional requests. |
| `expect-header` | Expect Header Builder & Analyzer | text | stable | Build or inspect HTTP Expect request expectations. |
| `expires-header` | Expires Header Builder & Analyzer | text | stable | Build or inspect HTTP Expires cache timestamps. |
| `fluid-clamp` | Fluid CSS Clamp Generator | text | stable | Generate responsive CSS clamp() values between viewport breakpoints. |
| `forwarded-header` | Forwarded Header Builder & Parser | text | stable | Build or inspect standardized proxy Forwarded headers. |
| `meta-tags` | HTML Meta Tag Generator | text | stable | Generate SEO, Open Graph and Twitter card meta tags from page details. |
| `basic-auth` | HTTP Basic Auth Header | text | stable | Build or decode HTTP Basic Authorization headers, UTF-8 safe. |
| `http-encoding` | HTTP Encoding Header Builder & Analyzer | text | stable | Build or inspect Accept-Encoding and Content-Encoding negotiation values. |
| `link-header` | HTTP Link Header Builder & Parser | text | stable | Build or inspect HTTP Link headers for preload, canonical, pagination, and alternates. |
| `http-range` | HTTP Range Header Builder & Parser | text | stable | Build or inspect byte-range request and response headers. |
| `http-status` | HTTP Status Code Reference | text | stable | Look up HTTP status codes — what they mean and when APIs return them. |
| `via-header` | HTTP Via Header Builder & Analyzer | text | stable | Build or inspect HTTP Via header field values for proxy control. |
| `if-match` | If-Match Builder & Analyzer | text | stable | Build or inspect HTTP If-Match entity-tag conditions. |
| `if-modified-since` | If-Modified-Since Builder & Analyzer | text | stable | Build or inspect HTTP If-Modified-Since cache conditions. |
| `if-none-match` | If-None-Match Builder & Analyzer | text | stable | Build or inspect HTTP If-None-Match conditions. |
| `if-range` | If-Range Builder & Analyzer | text | stable | Build or inspect HTTP If-Range validators for partial responses. |
| `if-unmodified-since` | If-Unmodified-Since Builder & Analyzer | text | stable | Build or inspect HTTP If-Unmodified-Since preconditions. |
| `last-modified` | Last-Modified Header Builder & Analyzer | text | stable | Build or inspect HTTP Last-Modified resource timestamps. |
| `media-query-builder` | Media Query Builder & Analyzer | text | stable | Build or inspect CSS @media queries. |
| `mime-lookup` | MIME Type Lookup | text | stable | Look up the MIME type for an extension, or the extensions for a MIME type. |
| `port-lookup` | Network Port Lookup | text | stable | Look up which service uses a TCP/UDP port, or find ports by service name. |
| `network-error-logging` | Network-Error-Logging (NEL) Policy Builder | text | stable | Build or inspect NEL policies and report delivery. |
| `origin-header` | Origin Request Header Analyzer | text | stable | Validate the Origin request header for CORS and CSRF. |
| `origin-agent-cluster` | Origin-Agent-Cluster Builder & Analyzer | text | stable | Build or inspect origin-keyed browsing isolation signals. |
| `permissions-policy` | Permissions-Policy Builder & Analyzer | text | stable | Build or inspect browser capability policy directives. |
| `prefer-header` | Prefer Header Builder & Analyzer | text | stable | Build or inspect HTTP Prefer negotiation directives for APIs. |
| `priority-header` | Priority Header Builder & Analyzer | text | stable | Build or inspect HTTP Priority scheduling parameters. |
| `proxy-authenticate` | Proxy-Authenticate Builder & Analyzer | text | stable | Build or inspect HTTP proxy authentication challenges. |
| `proxy-authorization` | Proxy-Authorization Builder & Analyzer | text | stable | Build or inspect HTTP proxy credential values. |
| `proxy-status` | Proxy-Status Builder & Analyzer | text | stable | Build or inspect HTTP Proxy-Status diagnostics. |
| `punycode` | Punycode / IDN Converter | text | stable | Convert internationalised domain names to ASCII (xn--) and back, per RFC 3492. |
| `referrer-policy` | Referrer-Policy Builder & Analyzer | text | stable | Build or inspect referrer information controls. |
| `reporting-endpoints` | Reporting-Endpoints Builder & Analyzer | text | stable | Build or inspect Reporting API endpoint groups. |
| `repr-digest` | Repr-Digest Builder & Analyzer | text | stable | Build or verify modern representation digest fields. |
| `retry-after` | Retry-After Header Builder & Parser | text | stable | Build or inspect Retry-After headers using seconds or an HTTP date. |
| `robots-txt` | robots.txt Generator | text | stable | Generate a robots.txt: allow all, block all, block AI crawlers, or custom rules. |
| `sec-fetch-inspector` | Sec-Fetch Request Inspector | text | stable | Inspect fetch metadata for cross-site requests. |
| `server-timing` | Server-Timing Builder & Analyzer | text | stable | Build or inspect Server-Timing performance metrics. |
| `set-cookie` | Set-Cookie Builder & Analyzer | text | stable | Build or review Set-Cookie headers and their security attributes locally. |
| `signature-input` | Signature-Input Builder & Analyzer | text | stable | Build or inspect HTTP Message Signature-Input fields. |
| `strict-transport-security` | Strict-Transport-Security (HSTS) Builder & Analyzer | text | stable | Build or inspect HSTS policies. |
| `sri-hash-generator` | Subresource Integrity (SRI) Hash Generator | text | stable | Generate SRI integrity hashes for scripts and styles. |
| `sunset-deprecation` | Sunset & Deprecation Header Analyzer | text | stable | Build or inspect API lifecycle deprecation signals. |
| `surrogate-control` | Surrogate-Control Builder & Analyzer | text | stable | Build or inspect Surrogate-Control intermediary-cache directives. |
| `timing-allow-origin` | Timing-Allow-Origin Builder & Analyzer | text | stable | Build or inspect cross-origin timing data access. |
| `traceparent` | Traceparent Builder & Analyzer | text | stable | Build or inspect W3C Traceparent propagation values. |
| `tracestate` | Tracestate Builder & Analyzer | text | stable | Build or inspect W3C Trace Context tracestate values. |
| `trailer-header` | Trailer Header Builder & Analyzer | text | stable | Build or inspect HTTP Trailer field-name declarations. |
| `upgrade-header` | Upgrade Header Builder & Analyzer | text | stable | Build or inspect HTTP Upgrade protocol-switch values. |
| `url-parse` | URL Parser | text | stable | Break a URL into protocol, host, path, query parameters and hash. |
| `user-agent` | User-Agent Parser | text | stable | Break a User-Agent string into browser, version, OS, engine and device type. |
| `vary-header` | Vary Header Builder & Analyzer | text | stable | Build or inspect HTTP Vary cache-key fields. |
| `warning-header` | Warning Header Analyzer | text | stable | Decode Warning response-header codes (RFC 7234). |
| `web-manifest` | Web App Manifest Generator & Validator | text | stable | Generate or validate a web app manifest for installable sites. |
| `www-authenticate` | WWW-Authenticate Builder & Parser | text | stable | Build or inspect HTTP authentication challenges for Basic and Bearer schemes. |
| `x-content-type-options` | X-Content-Type-Options Analyzer | text | stable | Validate X-Content-Type-Options: nosniff. |
| `x-frame-options` | X-Frame-Options Builder & Analyzer | text | stable | Build or inspect clickjacking frame controls. |
| `request-id` | X-Request-ID / Correlation-ID Tool | text | stable | Generate or validate request correlation IDs. |

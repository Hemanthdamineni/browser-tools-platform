# Todos — pending work for this round

Line order is priority: top first. This file is written by a human (via review) at the start of each round. **Agents never add, remove, reorder, or reword lines.** They only change the checkbox and append the status markers below to the end of a line.

## Status markers (same for BACKLOG.md)

- **Todo:** `- [ ] **id** · category — notes`
- **In progress:** append ` ⏳ <RUN_ID> @ <ISO-8601 UTC>`. A claim older than 3h is stale and may be reclaimed.
- **Failed attempt:** remove the ⏳ marker and append ` ⚠️ <reason>`. Two ⚠️ markers mean the item is blocked.
- **Done:** change `[ ]` to `[x]`, remove the ⏳ marker, and append ` ✅ <short merge sha>`.
- **Blocked:** remove the ⏳ marker and append ` ⛔ <reason>`. A human resolves it in the next round's review.
- **Already exists:** change `[ ]` to `[x]` and append ` ✅ already exists as <id>`.
- **Dependencies:** `after: a, b` means the item is eligible only when every listed item is `[x]`, wherever it lives (this file or BACKLOG.md).

## Foundations

- [ ] **video-foundation** · core — Registers the `video` category. Shared lazy-loaded video engine: prefer WebCodecs + Mediabunny (MPL-2.0). ffmpeg.wasm core is GPL-2.0 (x264), so if it seems needed, report BLOCKED-DECISION instead of using it. Provide progress events, cancel, and worker execution. ⏳ run-20261016-0951-5f1c @ 2026-10-16T09:55:37Z
- [ ] **ml-runtime-foundation** · core — Shared loader for transformers.js / onnxruntime-web. Use WebGPU when available, falling back to WASM. Cache models in Cache Storage and show download-size and progress UI. Default model source is the HF Hub; only models with permissive licenses are allowed. ⏳ run-20261016-0951-5f1c @ 2026-10-16T09:55:37Z

## Tools

- [ ] **pdf-compress** · pdf — Re-encode or downsample embedded images and clean up streams. Quality presets; show before/after size. ⏳ run-20261016-0951-5f1c @ 2026-10-16T09:55:37Z
- [x] **barcode-generator** · generators — bwip-js or JsBarcode. Code128, EAN-13, UPC-A, Code39, ITF, DataMatrix. SVG and PNG export. ✅ already exists as barcode
- [ ] **qr-scanner** · generators — Camera (getUserMedia) plus image upload. Native BarcodeDetector with jsQR or zxing-wasm fallback. Actions for detected URL, Wi-Fi, or vCard content. ⏳ run-20261016-0947-773b @ 2026-10-16T10:03:21Z
- [ ] **heic-to-jpg** · image — libheif-js / heic2any. Batch mode; JPEG, PNG, and WebP output. ⏳ run-20261016-0947-773b @ 2026-10-16T10:03:21Z
- [ ] **image-strip-metadata** · image — Strip EXIF, GPS, and XMP. Prefer lossless JPEG segment removal; show what was removed. Batch mode. ⏳ run-20261016-0947-773b @ 2026-10-16T10:03:21Z
- [ ] **video-to-gif** · video · after: video-foundation — Time range, fps, width, palette quality. Preview before export.
- [ ] **pdf-sign** · pdf — Draw, type, or upload a signature. Place and resize on the page, then flatten with pdf-lib. ⏳ run-20261016-0957-7c37 @ 2026-10-16T10:22:40Z
- [ ] **code-beautify** · developer — Prettier standalone for JS/TS/CSS/SCSS/HTML/JSON/Markdown/YAML. Lazy-load parsers per language. ⏳ run-20261016-0957-7c37 @ 2026-10-16T10:22:40Z
- [ ] **code-minify** · developer — terser, lightningcss-wasm or csso, html-minifier-terser. Show bytes saved. ⏳ run-20261016-0957-7c37 @ 2026-10-16T10:22:40Z
- [ ] **video-compress** · video · after: video-foundation — Presets by target size or quality. Warn on memory limits for long files.
- [ ] **image-ocr** · image — tesseract.js with a language picker and self-hosted traineddata. Copy or download the text. ⏳ run-20261016-1016-793b @ 2026-10-16T10:23:30Z
- [ ] **background-remover** · image · after: ml-runtime-foundation — Use a permissively licensed model (e.g. MODNet); RMBG-1.4 is non-commercial, so don't use it. Output transparent PNG or a solid-colour background.
- [ ] **screen-recorder** · video — getDisplayMedia + MediaRecorder with a mic toggle. WebM output, plus MP4 where the browser supports it.
- [ ] **webcam-recorder** · video — getUserMedia + MediaRecorder. Share the recording code with screen-recorder.
- [ ] **pdf-organize** · pdf — Thumbnail grid with drag-to-reorder, rotate, delete, and insert blank page.
- [ ] **password-strength** · security — zxcvbn-ts. Show estimated crack time and feedback. The password is never stored or logged. ⏳ run-20261016-1016-793b @ 2026-10-16T10:23:30Z
- [ ] **markdown-preview** · developer — Split-pane live editor: GFM, code highlighting, export to HTML, print to PDF.
- [ ] **percentage-calculator** · misc — X% of Y; X is what % of Y; % change; increase/decrease by %. ⏳ run-20261016-1016-793b @ 2026-10-16T10:23:30Z
- [ ] **gst-calculator** · misc — Add or remove GST; CGST/SGST/IGST split. Verify current slab rates against an official source before shipping.
- [ ] **sip-calculator** · misc — SIP, step-up SIP, and lumpsum, with a growth chart. Add a "not financial advice" note.
- [ ] **compound-interest** · misc — Compounding frequency, periodic contributions, and a yearly schedule table.
- [ ] **webcam-test** · device — Registers the `device` category. Device picker, resolution and fps readout, snapshot. Nothing leaves the device.
- [ ] **mic-test** · device — Level meter, waveform, record and play back.
- [ ] **keyboard-tester** · device — On-screen layout that lights up per key; key/code readout; ghosting test.
- [ ] **video-trim** · video · after: video-foundation — Stream copy when cut points allow, re-encode otherwise. Scrubber preview.
- [ ] **video-extract-audio** · video · after: video-foundation — MP3, AAC, and WAV output.
- [ ] **video-convert** · video · after: video-foundation — MP4, WebM, MOV, and MKV. Remux when possible, transcode when needed.
- [ ] **image-watermark** · image — Text or logo watermark; opacity, position, or tiled. Batch mode.
- [ ] **image-add-text** · image — Captions and meme-style text: fonts, stroke, shadow, drag to position.
- [ ] **image-blur-redact** · image — Draw regions to blur, pixelate, or black out. Strip metadata on export.
- [ ] **pdf-protect** · pdf — Add a password via qpdf-wasm (Apache-2.0). AES-256.
- [ ] **pdf-unlock** · pdf — Remove a password the user already knows (qpdf-wasm). No cracking.
- [ ] **pdf-fill-form** · pdf — Fill AcroForm fields with pdf-lib; option to flatten.
- [ ] **speech-to-text** · audio · after: ml-runtime-foundation — Whisper tiny/base. Timestamps; export TXT, SRT, and VTT. File input and mic input.
- [ ] **text-to-speech** · audio — Web Speech API with voice, rate, and pitch controls.
- [ ] **voice-recorder** · audio — MediaRecorder with WAV or WebM output. Link to audio-trim.
- [ ] **audio-convert** · audio — Generalise audio-to-wav into `audio-convert`: WAV, MP3 (separate-file LGPL encoder is ok), and Opus/OGG. `audio-to-wav` becomes an alias.
- [ ] **file-encrypt** · security — AES-256-GCM, reusing the text-encrypt KDF. Streaming or chunked for large files; versioned file header.
- [ ] **totp-generator** · security — Live 6/8-digit codes from a secret or otpauth URI, with a countdown. Pairs with otp-uri.
- [ ] **sqlite-viewer** · developer — sql.js. Browse tables, run queries, export CSV or JSON.
- [ ] **spreadsheet-viewer** · data — SheetJS installed from the cdn.sheetjs.com tarball (the npm version is stale). Open xlsx/xls/ods/csv; switch sheets; convert to CSV, JSON, or XLSX.
- [ ] **xml-json** · data — XML ↔ JSON in both directions, with attribute and array handling options.
- [ ] **toml-json** · data — TOML ↔ JSON, plus an INI ↔ JSON mode.
- [ ] **jsonpath-tester** · data — JSONPath and JMESPath; highlight matches in the source.
- [ ] **mermaid-renderer** · developer — Live Mermaid editor; export SVG or PNG.
- [ ] **code-to-image** · developer — Shiki highlighting; themes, padding, background, window chrome. PNG or SVG export.
- [ ] **stopwatch** · datetime — Laps and keyboard shortcuts. Compute from timestamps rather than counting intervals, so it stays accurate when the tab sleeps.
- [ ] **countdown-timer** · datetime — Multiple timers; sound and notification on finish.
- [ ] **pomodoro-timer** · datetime — Configurable work/break cycles; notifications.
- [ ] **typing-test** · text — WPM and accuracy, time modes, local history.
- [ ] **signature-maker** · generators — Draw or type a signature; transparent PNG or SVG. Share the signature component with pdf-sign.
- [ ] **invoice-generator** · generators — Form to PDF with pdf-lib: line items, taxes, logo. Drafts saved locally.
- [ ] **image-filters** · image — Brightness, contrast, saturation, grayscale, sepia, sharpen, with live preview.
- [ ] **gif-maker** · image — Images to animated GIF with gifenc; frame delay and loop settings.
- [ ] **image-collage** · image — Grid layouts, spacing, background; export.
- [ ] **svg-optimizer** · image — SVGO browser build; preset toggles; before/after size and preview.
- [ ] **x509-decoder** · security — Decode PEM/DER certificates and CSRs with @peculiar/x509: validity, SANs, issuer fields, fingerprints.
- [ ] **keypair-generator** · security — RSA, ECDSA, and Ed25519 via WebCrypto. PEM and OpenSSH formats.
- [ ] **bcrypt** · security — Hash and verify with a cost factor; bcryptjs in a worker.
- [ ] **pgp-tool** · security — openpgp.js (LGPL, separate chunk): keygen, encrypt/decrypt, sign/verify.
- [ ] **tuner** · audio — Mic pitch detection (YIN or autocorrelation); show note and cents.
- [ ] **spectrogram** · audio — From a file or the mic; FFT; PNG export.
- [ ] **bpm-detector** · audio — Tempo detection from a file via Web Audio.
- [ ] **speaker-test** · device — Left/right/both channels and a frequency sweep. Reuse tone-generator code.
- [ ] **dead-pixel-test** · device — Fullscreen solid colours with cycling.
- [ ] **fancy-text** · text — Unicode styled letters (bold, script, fraktur, etc.). Note that screen readers handle these poorly.
- [ ] **upgrade-text-stats** · text — Add platform limits (X, LinkedIn, Instagram, meta description) and readability scores.
- [ ] **gpa-calculator** · misc — 10-point CGPA and 4.0 scales; CGPA ↔ % conversion with a configurable formula.
- [ ] **upgrade-calculator-scientific** · misc — Add a keypad UI to `calculator`: trig, log, constants, history.
- [ ] **html-playground** · developer — HTML/CSS/JS live preview in a sandboxed iframe without allow-same-origin.
- [ ] **video-frames** · video · after: video-foundation — Extract frames at an interval, or build a thumbnail contact sheet.
- [ ] **pdf-redact** · pdf — True redaction: rasterize affected pages and burn in the boxes. Warn the user that those pages lose their text layer.
- [ ] **pdf-ocr** · pdf · after: image-ocr — Produce a searchable PDF by adding a tesseract.js text layer.
- [ ] **image-upscale** · image · after: ml-runtime-foundation — 2x/4x with a permissively licensed ESRGAN-type model. WebGPU preferred; enforce size limits.
- [ ] **noise-reduction** · audio — RNNoise WASM.
- [ ] **world-clock** · datetime — Pinned cities and a meeting-overlap view. Reuse timezone-convert logic.
- [ ] **online-notepad** · text — Autosave to IndexedDB, multiple notes, export .txt or .md.

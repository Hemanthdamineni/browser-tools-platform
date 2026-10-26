/**
 * Editorial content for the code-to-image tool page.
 *
 * Kept out of ``code-to-image.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a snippet to a shareable image',
      body: 'Paste code and the tool highlights it with Shiki and lays it out as a card, then hands back a self-contained SVG. The workbench shows that vector image on the spot, and the format option steers the download: SVG stays sharp at any size for slides and print, while PNG rasterises the same layout at 2× resolution for pasting anywhere that wants pixels. Alongside the image the stats report the detected language, the image dimensions and the number of code lines.',
    },
    {
      heading: 'Language and theme choices',
      body: 'The language picker names every grammar bundled with this install, from bash and C through TypeScript, Rust and SQL, plus a plaintext fallback that needs no grammar. Choosing auto runs a small heuristic over the first lines of the snippet — a shebang names Python or Ruby, a quoted key brace suggests JSON, a leading <!DOCTYPE names HTML, a function signature with a type annotation suggests TypeScript — and anything it cannot place falls back to plain text. The theme select lists twelve Shiki palettes, from GitHub Dark and Dracula to Nord and Tokyo Night, and both the theme and the grammar are loaded lazily only when they are first used.',
    },
    {
      heading: 'The chrome, the layout, the background',
      body: 'Window chrome is on by default and draws the macOS-style traffic-light dots with a title bar above the code, named by the title option; turn it off for a bare snippet. Padding, line height and font size are each set as a range in pixels and clamp to the listed bounds, and the width caps where long lines wrap. The background defaults to the theme’s own colour but can be overridden with any CSS colour such as #1e1e2e, so the card matches the page you will place it on.',
    },
    {
      heading: 'Where the highlight runs',
      body: 'Shiki executes entirely in this tab. The highlighting core, the Oniguruma WebAssembly engine, the grammar and the theme for the language you pick are downloaded from this same origin on first use and cached, so a page that never highlights ships none of it and nothing you paste is sent to a server. The layout and SVG serialisation are pure and run straight after the token stream comes back, so the finished image is produced locally from your code.',
    },
  ],
  faq: [
    {
      q: 'Does the code leave my browser?',
      a: 'No. Shiki runs entirely in this tab. The highlight grammar and the highlighting engine are downloaded from this same site the first time you use them, and nothing is sent to any server.',
    },
    {
      q: 'Why did the first run take a moment?',
      a: 'The first highlight downloads and compiles the WebAssembly highlighting engine and the grammar for the language you picked. Later runs reuse what is already loaded, so they are instant.',
    },
    {
      q: 'What is the difference between PNG and SVG?',
      a: 'PNG is a bitmap — a fixed grid of pixels, good for sharing or pasting anywhere. SVG is a vector that stays sharp at any size, good for logos, slides and printing.',
    },
  ],
} as const;

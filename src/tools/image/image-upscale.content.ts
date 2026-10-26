/**
 * Editorial content for the image-upscale tool page.
 *
 * Kept out of ``image-upscale.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Algorithmic upscaling, stated plainly',
      body: 'Upscale Image enlarges a PNG, JPEG or WebP by 2x, 4x or a custom percentage, returning a new file in the format you choose. It resamples with a Lanczos3, bicubic or nearest-neighbour kernel, so it keeps a picture sharp but is not AI super-resolution and cannot invent texture the camera never caught. The browser-ready neural models (APISR, Swin2SR) are GPL-3.0, and this project ships only permissive licences, so they are deliberately excluded.',
    },
    {
      heading: 'When enlarging is the right move',
      body: 'Reach for it when a small logo must fill a slide or an old screenshot needs to print legibly; for noisy photos a gentler kernel beats an aggressive one.',
    },
    {
      heading: 'Interpolation, sharpening and format',
      body: 'Lanczos3 preserves the most detail but can halo around hard edges; bicubic is gentler, with less ringing; nearest keeps pixel art blocky and suits icons and textures. Interpolation softens edges, so the unsharp mask adds contrast back, where 0 disables it and about 40 percent suits photos, while detail-preserving sharpening widens the radius as the scale grows. PNG keeps transparency; JPEG and WebP use the quality slider.',
    },
    {
      heading: 'Caps, preview and where the pixels stay',
      body: 'Output is capped at 100 million pixels and 16,384 per side, so an oversized target errors instead of freezing the tab, and because it only enlarges, a custom value below 101 percent is raised to 101. The preview renders on the main thread at reduced resolution and labels itself as scaled down, while the export runs in a worker at full size; JPEG output is composited onto white first. Everything stays on your device with no network request.',
    },
  ],
  faq: [
    {
      q: 'Is this AI super-resolution?',
      a: 'No — this is not AI super-resolution. This tool uses classical resampling — Lanczos3, bicubic or nearest-neighbour interpolation — plus an optional unsharp mask. There is no neural network and no learned model, so it cannot invent detail that is not in the photo, but it is fully offline, instant and licence-clean.',
    },
    {
      q: 'Why is there no AI super-resolution here?',
      a: 'The open super-resolution models that run in a browser tab (APISR, Swin2SR) are GPL-3.0 licensed. This project only ships permissive-licensed code and models, so they are deliberately excluded rather than quietly downloaded. Algorithmic upscaling carries no such restriction and stays on your device.',
    },
    {
      q: 'How large can the output be?',
      a: 'The output is capped by what the browser can safely hold: 100 million pixels and 16,384 pixels per side. A 4000×3000 photo at 2× becomes 8000×6000 (48 MP), which is fine; at 4× it would be 256 MP and is rejected with a suggestion to use 2× instead.',
    },
    {
      q: 'Does upscaling add real detail?',
      a: 'No. Interpolation can only estimate each missing pixel from its neighbours, so it smooths or sharpens what is already there but never creates texture the photo lacks. That is exactly why true super-resolution models exist — and why they are GPL-licensed and not included here.',
    },
    {
      q: 'Which interpolation should I pick?',
      a: 'Lanczos3 for photos and screenshots that need to stay crisp, bicubic when the source is noisy or you want no ringing at all, and nearest-neighbour for pixel art, icons and textures where every source pixel must stay a hard-edged block.',
    },
  ],
} as const;

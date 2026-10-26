/**
 * Editorial content for the dockerignore-generator tool page.
 *
 * Kept out of ``dockerignore-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the generator writes',
      body: 'The tool emits a ready-to-save .dockerignore file with a short header naming the tool, then groups patterns into commented sections such as Version control / CI, Dependencies, Build output and Local env / tools. Every line is a glob the Docker daemon honours when it assembles the build context, so the upload and the build work with far fewer bytes. The result is returned as plain text you can copy, with stats counting the total patterns and how many came from the preset versus your own additions.',
    },
    {
      heading: 'Stack presets and the patterns they carry',
      body: 'Pick a preset that matches the project and you start from a sensible default rather than a blank page. The Node preset excludes node_modules, the npm, yarn and pnpm debug-log patterns, and build output like dist, .next and storybook-static; Python skips __pycache__, .venv and the mypy, pytest and ruff caches; Java drops target and .gradle; Go removes vendor and coverage files; and generic covers the cross-language essentials. Each preset also excludes the Dockerfiles themselves, so the context is not copied back into the image, while .env.example is re-included with a negation so your example file survives.',
    },
    {
      heading: 'Trimming and customising the output',
      body: 'Turning off the include common dotfiles option filters every pattern whose name starts with a dot, which gives a leaner list when you already rely on a separate mechanism for VCS metadata. Section comments can be removed entirely for a minimal file. Anything you add in the Extra patterns box, one glob per line, is appended under a Custom heading and counted separately, so you can layer project-specific exclusions such as local-data/ or build artifacts on top of the preset. Leading and trailing whitespace is trimmed and blank lines are dropped from that box.',
    },
    {
      heading: 'What it will and will not do',
      body: 'A .dockerignore shrinks what Docker sends as the build context; it does not remove files from image layers that earlier Dockerfile steps already added, so a lean ignore list is a starting point, not a substitute for a multi-stage build. Presets are tuned for the most common layouts and are not exhaustive — review the output for anything your stack generates elsewhere. Everything runs on your device from the preset tables shipped with the page, so nothing you generate is uploaded and no network request is made.',
    },
  ],
  faq: [
    {
      q: 'What does a .dockerignore actually do?',
      a: 'It excludes files from the build context sent to the Docker daemon, shrinking the upload and the image build. It does not remove files already in the image from earlier layers.',
    },
    {
      q: 'Do I need .gitignore in it?',
      a: 'Usually yes — .git, .gitignore and other VCS/CI metadata rarely belong in a build context. The preset includes them; you can toggle sections with the options.',
    },
    {
      q: 'Is this the same as a .gitignore?',
      a: 'Related but different: .gitignore keeps files out of version control; .dockerignore keeps them out of the Docker build context. Both are here — check the gitignore tool for the former.',
    },
  ],
} as const;

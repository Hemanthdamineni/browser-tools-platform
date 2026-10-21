# Tool panels

Most tools use the shared text or file workbench (`src/components/workbench/`).
A few need a flow the generic forms cannot express — a live camera preview, a
level meter, a drawing pad, an on-screen keyboard. Those tools opt into a
**panel** instead.

## How it works

1. A panel is an Astro component in this directory, named after the panel id:
   `src/components/panels/<panel-id>.astro`.
2. The tool sets `meta.panel` to that id. The panel **replaces** the generic
   workbench on the tool page.
3. `src/components/workbench/PanelWorkbench.astro` resolves the id with a lazy
   glob, so every panel is its own chunk and a tool page never ships another
   tool's UI. A panel id with no matching file **fails the build**, so a typo
   can never ship an empty page.

## Conventions

- The component receives the tool's metadata as a prop: `{ meta: ToolMeta }`.
- Put the behaviour in a sibling module and import it lazily from the
  component's `<script>` block, so the heavy code is only downloaded when the
  panel is actually on the page. This is the same pattern the camera panel
  uses (`src/components/workbench/CameraPanel.astro` +
  `src/components/workbench/camera-panel.ts`):

  ```astro
  <script>
    document.querySelectorAll<HTMLElement>('[data-my-panel]').forEach((root) => {
      void import('./my-panel').then(({ mountMyPanel }) => mountMyPanel(root));
    });
  </script>
  ```

- The panel collects what the user does and hands it to the tool's own `run()`
  (through `runToolById` from `@/lib/worker/client`), so the logic that is
  worth testing stays in the tool module and can be unit-tested without a DOM.
- Keep the pure logic in the tool's `*.tool.ts` (or a `*.core.ts` next to it)
  and the DOM work in the panel module. A panel must never talk to the network:
  every tool runs on-device.

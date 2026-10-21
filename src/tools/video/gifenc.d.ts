/**
 * Minimal type surface for `gifenc` (MIT).
 *
 * The package ships no types of its own, so we declare only the part the
 * video-to-GIF tool uses. The palette quantiser, the dither and the frame
 * selection are implemented in `gif.ts`; `gifenc` only writes the container.
 */
declare module 'gifenc' {
  export interface GifWriteFrameOptions {
    transparent?: boolean;
    transparentIndex?: number;
    /** Frame delay in milliseconds (stored as hundredths of a second). */
    delay?: number;
    /** Palette entries as `[r, g, b]` triples. */
    palette?: number[][];
    /** 0 = loop forever. */
    repeat?: number;
    /** Bits per pixel of the colour table (the LZW minimum code size). */
    colorDepth?: number;
    dispose?: number;
  }

  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifWriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(options?: {
    initialCapacity?: number;
    auto?: boolean;
  }): GifEncoderInstance;

  export default GIFEncoder;
}

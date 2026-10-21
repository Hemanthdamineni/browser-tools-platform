/**
 * Pure geometry for placing a signature on a PDF page.
 *
 * Two coordinate systems are in play:
 *
 * - **User space** — the PDF's own coordinate system: origin at the bottom
 *   left of the page, y grows upwards, units are points (1/72 inch).
 * - **Display space** — what the reader sees: origin at the top left of the
 *   *rotated* page, y grows downwards. The preview in the browser and the
 *   numbers the user types both live in this space, so the placement stays
 *   meaningful on a landscape or rotated page.
 *
 * The conversion is the same one pdf.js uses to build a page viewport, which
 * is why a signature dropped on the preview lands exactly where it was put.
 */

/** A page rectangle in user space (a media box or a crop box). */
export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangle in display space: origin top-left, y grows downwards, points. */
export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The smallest signature width that is still visible on a page. */
export const MIN_SIGNATURE_WIDTH = 8;
/** Default signature width in points (2.5 inch). */
export const DEFAULT_SIGNATURE_WIDTH = 180;
/** Default margin from the page edge, in points (1 inch). */
export const DEFAULT_MARGIN = 72;

/** Normalise any rotation to one of 0, 90, 180, 270. */
export function normalizeRotation(degrees: number): number {
  const angle = Math.round(degrees / 90) * 90;
  return ((angle % 360) + 360) % 360;
}

/** The size of the page as it is displayed (rotation applied). */
export function displayPageSize(
  box: PageBox,
  rotation: number,
): {
  width: number;
  height: number;
} {
  const angle = normalizeRotation(rotation);
  if (angle === 90 || angle === 270) return { width: box.height, height: box.width };
  return { width: box.width, height: box.height };
}

/**
 * The part of a page that is actually shown: the crop box clipped to the
 * media box.
 *
 * This is exactly what pdf.js uses as its "view" box when it builds a page
 * viewport, so using it here keeps the preview and the signed file in
 * agreement — even for pages whose crop box is smaller than the media box.
 */
export function visiblePageBox(media: PageBox, crop: PageBox): PageBox {
  const left = Math.max(media.x, crop.x);
  const bottom = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width);
  const top = Math.min(media.y + media.height, crop.y + crop.height);
  if (!(right > left) || !(top > bottom)) return crop; // degenerate: keep the crop box
  return { x: left, y: bottom, width: right - left, height: top - bottom };
}

/** The width / height ratio of a signature image. */
export function aspectOf(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  return width / height;
}

/**
 * The size a signature of the given width takes on the page.
 *
 * The height always follows the signature's own aspect ratio — the mark is
 * never stretched. When the result would not fit on the page, both sides are
 * scaled down together.
 */
export function fitSize(
  width: number,
  aspect: number,
  page: { width: number; height: number },
): { width: number; height: number } {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  let w = Math.min(Math.max(width, 0), Math.max(page.width, 0));
  let h = w / ratio;
  if (h > Math.max(page.height, 0)) {
    h = Math.max(page.height, 0);
    w = h * ratio;
  }
  return { width: w, height: h };
}

/**
 * Move a rectangle so it lies fully inside the page and never has a
 * non-positive size.
 */
export function clampRect(rect: DisplayRect, page: { width: number; height: number }): DisplayRect {
  const width = Math.min(Math.max(rect.width, 0), Math.max(page.width, 0));
  const height = Math.min(Math.max(rect.height, 0), Math.max(page.height, 0));
  const x = Math.min(Math.max(rect.x, 0), Math.max(page.width - width, 0));
  const y = Math.min(Math.max(rect.y, 0), Math.max(page.height - height, 0));
  return { x, y, width, height };
}

/** True when `rect` had to be moved or shrunk to fit the page. */
export function wasClamped(before: DisplayRect, after: DisplayRect): boolean {
  return (
    Math.abs(before.x - after.x) > 0.01 ||
    Math.abs(before.y - after.y) > 0.01 ||
    Math.abs(before.width - after.width) > 0.01 ||
    Math.abs(before.height - after.height) > 0.01
  );
}

/**
 * Build a placement from a width: the height follows the signature's own
 * aspect ratio so the image is never stretched, and the whole thing is kept
 * inside the page.
 */
export function placementForWidth(
  x: number,
  y: number,
  width: number,
  aspect: number,
  page: { width: number; height: number },
): DisplayRect {
  const size = fitSize(width, aspect, page);
  return clampRect({ x, y, width: size.width, height: size.height }, page);
}

/** A sensible starting position: bottom left of the page, one inch in. */
export function defaultPlacement(
  page: { width: number; height: number },
  aspect: number,
  width = DEFAULT_SIGNATURE_WIDTH,
): DisplayRect {
  const size = fitSize(width, aspect, page);
  return clampRect(
    {
      x: Math.min(DEFAULT_MARGIN, Math.max(0, page.width - size.width)),
      y: Math.max(0, page.height - size.height - DEFAULT_MARGIN),
      width: size.width,
      height: size.height,
    },
    page,
  );
}

export interface UserSpaceAnchor {
  /** x of the image's bottom-left corner in user space. */
  x: number;
  /** y of the image's bottom-left corner in user space. */
  y: number;
  /** Counter-clockwise rotation to apply to the image, in degrees. */
  rotate: number;
}

/**
 * Convert a display-space rectangle into the anchor + rotation that
 * `page.drawImage()` needs so the image lands exactly there, upright.
 *
 * The page's own `/Rotate` is compensated for: content drawn in user space is
 * rotated with the page, so the image is drawn with the opposite rotation to
 * keep it upright on screen.
 */
export function toUserSpace(rect: DisplayRect, box: PageBox, rotation: number): UserSpaceAnchor {
  const angle = normalizeRotation(rotation);
  const left = rect.x;
  const bottom = rect.y + rect.height;
  const right = box.x + box.width;
  const top = box.y + box.height;
  switch (angle) {
    case 90:
      return { x: bottom + box.x, y: left + box.y, rotate: 90 };
    case 180:
      return { x: right - left, y: bottom + box.y, rotate: 180 };
    case 270:
      return { x: right - bottom, y: top - left, rotate: 270 };
    default:
      return { x: left + box.x, y: top - bottom, rotate: 0 };
  }
}

/**
 * The inverse of {@link toUserSpace}: where a user-space anchor shows up on the
 * displayed page. `size` is the image's own size (width along its own right
 * axis, height along its own up axis).
 */
export function toDisplaySpace(
  anchor: { x: number; y: number },
  box: PageBox,
  rotation: number,
  size: { width: number; height: number },
): DisplayRect {
  const angle = normalizeRotation(rotation);
  const right = box.x + box.width;
  const top = box.y + box.height;
  const width = size.width;
  const height = size.height;
  switch (angle) {
    case 90:
      return {
        x: anchor.y - box.y,
        y: anchor.x - box.x - height,
        width,
        height,
      };
    case 180:
      return {
        x: right - anchor.x,
        y: anchor.y - box.y - height,
        width,
        height,
      };
    case 270:
      return {
        x: top - anchor.y,
        y: right - anchor.x - height,
        width,
        height,
      };
    default:
      return {
        x: anchor.x - box.x,
        y: top - anchor.y - height,
        width,
        height,
      };
  }
}

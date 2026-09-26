// Compose a framed photo pin on a canvas: rounded image, colored border, soft shadow, and an
// optional pointer tail, drawn at device resolution for a crisp marker texture.

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface MarkerImageStyle {
  /** Image edge length in CSS pixels, before border and tail (default 52). */
  size?: number;
  /** Border width in CSS pixels (default 3). */
  borderWidth?: number;
  borderColor?: string;
  /** Corner radius in CSS pixels (default 8). */
  radius?: number;
  /** Pointer tail height in CSS pixels; 0 for none (default 9). */
  tail?: number;
  /** Shadow blur in CSS pixels; 0 for none (default 6). */
  shadow?: number;
  shadowColor?: string;
  /** Resolution multiplier (default 2 for sharp sprites on high-DPI screens). */
  pixelRatio?: number;
  /** Canvas factory; defaults to OffscreenCanvas, then `document.createElement('canvas')`. */
  createCanvas?: (width: number, height: number) => CanvasLike;
}

function defaultCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function roundedRect(context: Context2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

/**
 * Draw `image` (cover-cropped to a square) inside a bordered, rounded frame with an optional tail,
 * returning a canvas ready for `MarkerSpec.image`. Its bottom-center is the pin point.
 */
export function composeMarkerImage(
  image: CanvasImageSource & { width: number; height: number },
  style: MarkerImageStyle = {},
): CanvasLike {
  const size = style.size ?? 52;
  const border = style.borderWidth ?? 3;
  const radius = style.radius ?? 8;
  const tail = style.tail ?? 9;
  const shadow = style.shadow ?? 6;
  const ratio = style.pixelRatio ?? 2;
  const frame = size + border * 2;
  const pad = shadow;
  const width = Math.ceil((frame + pad * 2) * ratio);
  // No padding below the tail: the canvas's bottom-center is exactly the pin point.
  const height = Math.ceil((pad + frame + tail) * ratio);
  const canvas = (style.createCanvas ?? defaultCanvas)(width, height);
  const context = canvas.getContext('2d') as Context2D | null;
  if (context === null) throw new Error('2D canvas context unavailable for marker images');
  context.scale(ratio, ratio);

  const left = pad;
  const top = pad;
  context.save();
  if (shadow > 0) {
    context.shadowColor = style.shadowColor ?? 'rgba(0, 0, 0, 0.35)';
    context.shadowBlur = shadow;
    context.shadowOffsetY = shadow / 3;
  }
  context.fillStyle = style.borderColor ?? '#ffffff';
  roundedRect(context, left, top, frame, frame, radius + border);
  context.fill();
  if (tail > 0) {
    context.beginPath();
    context.moveTo(left + frame / 2 - tail, top + frame - 1);
    context.lineTo(left + frame / 2, top + frame + tail);
    context.lineTo(left + frame / 2 + tail, top + frame - 1);
    context.closePath();
    context.fill();
  }
  context.restore();

  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const side = Math.min(sourceWidth, sourceHeight);
  context.save();
  roundedRect(context, left + border, top + border, size, size, radius);
  context.clip();
  if (side > 0) {
    context.drawImage(
      image,
      (sourceWidth - side) / 2,
      (sourceHeight - side) / 2,
      side,
      side,
      left + border,
      top + border,
      size,
      size,
    );
  }
  context.restore();
  return canvas;
}

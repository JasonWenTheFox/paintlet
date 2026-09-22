// Which image formats Paintlet can read and write.
//
// Both directions are bounded by the webview, not by Rust — read_image_file /
// write_image_file just move bytes and neither knows nor cares about formats.
// WebKit sits on ImageIO, so what it can *decode* is wider than the
// web-standard set (BMP and HEIC come free), while what it can *encode* is
// narrower in one dangerous way: canvas.toBlob() cannot produce WebP and hands
// back PNG instead of failing. Every entry below was verified against
// WKWebView on macOS 26 by round-tripping a canvas through toBlob and
// createImageBitmap.

// Offered in the Open dialog; all of these decode via createImageBitmap.
// TIFF also decodes, but a Paint clone offering it is more clutter than help.
export const OPEN_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "heic",
  "heif",
  "avif",
];

export interface Encoding {
  type: string;
  quality?: number;
}

// Extension → encoder. An extension may only appear here if the canvas can
// genuinely produce that format, because this table decides what bytes get
// written under a given filename: listing a format we can't encode means
// writing PNG bytes into a .webp, which corrupts the file rather than saving
// it. WebP and HEIC are deliberately absent — they open fine, but WebKit
// cannot write either one.
export const ENCODERS: Record<string, Encoding> = {
  png: { type: "image/png" },
  jpg: { type: "image/jpeg", quality: 0.92 },
  jpeg: { type: "image/jpeg", quality: 0.92 },
  gif: { type: "image/gif" },
  bmp: { type: "image/bmp" },
};

export const PNG_ENCODING: Encoding = { type: "image/png" };

// What the save panel's format popup offers, in order — the first is what an
// extension-less name becomes. Uniform type identifiers, because that's what
// NSSavePanel's allowedContentTypes takes; AppKit derives each menu item's
// label and extension from the UTI itself, so there are no display names to
// keep in sync here.
//
// `ext` records which ENCODERS entry each UTI resolves to, so a format can't be
// offered in the popup without something able to write it — a test asserts it.
//
// GIF comes last because it quantizes to 256 colors. It writes a real GIF, but
// a full-color drawing loses color depth doing so, which makes it a deliberate
// pick rather than something that should sit next to PNG at the top.
export const SAVE_FORMATS = [
  { uti: "public.png", ext: "png" },
  { uti: "public.jpeg", ext: "jpeg" },
  { uti: "com.microsoft.bmp", ext: "bmp" },
  { uti: "com.compuserve.gif", ext: "gif" },
];

export const SAVE_UTIS = SAVE_FORMATS.map((f) => f.uti);

// The final path component's extension, lowercased; "" when there is none.
// Anchored past any separator so a dot in a directory name ("~/v1.2/sketch")
// doesn't read as an extension.
export function extOf(path: string): string {
  return path.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? "";
}

// Whether this path's format can be written at all. Drives two decisions: may
// ⌘S re-write the file in place, and does a name typed into the save panel
// keep its extension or gain a .png.
export function canEncode(path: string): boolean {
  return extOf(path) in ENCODERS;
}

export function encodingFor(path: string): Encoding {
  return ENCODERS[extOf(path)] ?? PNG_ENCODING;
}

// WebKit normally rejects undecodable images, but ImageIO can recover a
// truncated AVIF as a correctly sized, fully transparent bitmap. Replacing the
// current drawing with that recovery would turn file damage into silent data
// loss, so do the small amount of container validation we can do locally:
// every top-level ISO BMFF box must fit in the file, and the ftyp box must name
// an AVIF still image or sequence. The decoder remains responsible for the
// image payload and every other format.
export function isCompleteAvifContainer(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let avifBrand = false;

  while (offset < bytes.byteLength) {
    const remaining = bytes.byteLength - offset;
    if (remaining < 8) return false;

    let size = view.getUint32(offset);
    const type = boxString(bytes, offset + 4);
    let headerSize = 8;

    if (size === 1) {
      if (remaining < 16) return false;
      const high = view.getUint32(offset + 8);
      const low = view.getUint32(offset + 12);
      // Number can represent box sizes exactly while the high word is at most
      // 21 bits. Larger images are far beyond what a browser canvas can hold.
      if (high > 0x1fffff) return false;
      size = high * 0x100000000 + low;
      headerSize = 16;
    } else if (size === 0) {
      size = remaining;
    }

    if (size < headerSize || size > remaining) return false;

    if (type === "ftyp") {
      if (size < headerSize + 8) return false;
      avifBrand ||= isAvifBrand(boxString(bytes, offset + headerSize));
      for (let pos = offset + headerSize + 8; pos + 4 <= offset + size; pos += 4) {
        avifBrand ||= isAvifBrand(boxString(bytes, pos));
      }
    }

    offset += size;
  }

  return avifBrand;
}

function boxString(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function isAvifBrand(brand: string): boolean {
  return brand === "avif" || brand === "avis";
}

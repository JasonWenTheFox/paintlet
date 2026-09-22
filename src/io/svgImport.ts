const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const SVG_DEFAULT_SIZE = { width: 300, height: 150 } as const;
export const SVG_MAX_SOURCE_BYTES = 32 * 1024 * 1024;
export const SVG_MAX_DIMENSION = 8192;
export const SVG_MAX_PIXELS = 32 * 1024 * 1024;

const BLOCKED_ELEMENTS = new Set([
  "animate",
  "animatecolor",
  "animatemotion",
  "animatetransform",
  "audio",
  "canvas",
  "discard",
  "embed",
  "foreignobject",
  "iframe",
  "object",
  "script",
  "set",
  "video",
]);

const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp|bmp)(?:;[^,]*)?,/i;
const CSS_URL = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
const XML_ACTIVE_DECLARATION = /<!\s*(?:doctype|entity)\b/i;
const XML_PROCESSING_INSTRUCTION = /<\?(?!xml(?:\s|\?>))/i;

export class SvgImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgImportError";
  }
}

export interface SvgSize {
  width: number;
  height: number;
}

interface ParsedViewBox {
  width: number;
  height: number;
}

export interface PreparedSvg {
  blob: Blob;
  width: number;
  height: number;
}

// Turn the root SVG sizing attributes into a concrete pixel canvas. Paintlet
// cannot leave percentages or viewport-relative units pending because the same
// file must import identically regardless of the editor window size.
export function resolveSvgSize(
  widthAttr: string | null,
  heightAttr: string | null,
  viewBoxAttr: string | null,
): SvgSize {
  const width = parseSvgLength(widthAttr, "width");
  const height = parseSvgLength(heightAttr, "height");
  const viewBox = parseViewBox(viewBoxAttr);

  let resolvedWidth: number;
  let resolvedHeight: number;

  if (width != null && height != null) {
    resolvedWidth = width;
    resolvedHeight = height;
  } else if (width != null && viewBox) {
    resolvedWidth = width;
    resolvedHeight = width * (viewBox.height / viewBox.width);
  } else if (height != null && viewBox) {
    resolvedWidth = height * (viewBox.width / viewBox.height);
    resolvedHeight = height;
  } else if (width != null) {
    resolvedWidth = width;
    resolvedHeight = SVG_DEFAULT_SIZE.height;
  } else if (height != null) {
    resolvedWidth = SVG_DEFAULT_SIZE.width;
    resolvedHeight = height;
  } else if (viewBox) {
    resolvedWidth = viewBox.width;
    resolvedHeight = viewBox.height;
  } else {
    resolvedWidth = SVG_DEFAULT_SIZE.width;
    resolvedHeight = SVG_DEFAULT_SIZE.height;
  }

  const size = {
    width: Math.round(resolvedWidth),
    height: Math.round(resolvedHeight),
  };
  validateCanvasSize(size);
  return size;
}

function parseSvgLength(value: string | null, name: string): number | null {
  if (value == null || value.trim() === "" || value.trim().toLowerCase() === "auto") {
    return null;
  }

  // SVG unitless lengths are CSS px. Other absolute units are intentionally
  // not converted here: accepting only these two forms avoids OS/DPI-dependent
  // imports, while percentages and viewport units have no stable host viewport.
  const match = value
    .trim()
    .match(/^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?$/i);
  if (!match) {
    throw new SvgImportError(
      `SVG ${name} must be a positive pixel value; relative and physical units are not supported.`,
    );
  }

  const length = Number(match[1]);
  if (!Number.isFinite(length) || length <= 0) {
    throw new SvgImportError(`SVG ${name} must be greater than zero.`);
  }
  return length;
}

function parseViewBox(value: string | null): ParsedViewBox | null {
  if (value == null || value.trim() === "") return null;

  const parts = value.trim().split(/[\s,]+/);
  if (parts.length !== 4) {
    throw new SvgImportError("SVG viewBox must contain four numbers.");
  }
  const values = parts.map(Number);
  if (values.some((n) => !Number.isFinite(n)) || values[2] <= 0 || values[3] <= 0) {
    throw new SvgImportError("SVG viewBox width and height must be positive numbers.");
  }
  return { width: values[2], height: values[3] };
}

function validateCanvasSize({ width, height }: SvgSize): void {
  if (width < 1 || height < 1) {
    throw new SvgImportError("SVG dimensions are too small to rasterize.");
  }
  if (
    width > SVG_MAX_DIMENSION ||
    height > SVG_MAX_DIMENSION ||
    width * height > SVG_MAX_PIXELS
  ) {
    throw new SvgImportError(
      `SVG dimensions exceed Paintlet's ${SVG_MAX_DIMENSION} px / ${SVG_MAX_PIXELS.toLocaleString("en-US")} pixel import limit.`,
    );
  }
}

export function validateSvgReference(value: string): void {
  const reference = value.trim();
  if (reference.startsWith("#") && reference.length > 1) return;
  if (SAFE_DATA_IMAGE.test(reference)) return;

  throw new SvgImportError(
    "SVG contains an external or unsupported resource reference. Only local fragments and embedded raster images are allowed.",
  );
}

function validateCss(css: string): void {
  // Backslash escapes can disguise `url` and at-rules from a textual audit.
  // Rejecting them keeps this deliberately small validator fail-closed.
  if (css.includes("\\") || css.includes("@")) {
    throw new SvgImportError("SVG styles contain unsupported external-resource syntax.");
  }

  CSS_URL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CSS_URL.exec(css)) !== null) {
    validateSvgReference(match[2]);
  }
}

function decodeSvgSource(bytes: Uint8Array): string {
  if (bytes.byteLength > SVG_MAX_SOURCE_BYTES) {
    throw new SvgImportError("SVG source is larger than Paintlet's 32 MiB import limit.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SvgImportError("SVG source must be valid UTF-8 text.");
  }
}

// Parse and validate before creating an image decoder. DOMParser builds a
// detached XML tree; it does not put the SVG in a document or execute it. The
// explicit walk then enforces Paintlet's stricter no-script/no-fetch contract.
export function prepareSvgImport(bytes: Uint8Array): PreparedSvg {
  const source = decodeSvgSource(bytes);
  if (XML_ACTIVE_DECLARATION.test(source)) {
    throw new SvgImportError("SVG DTD and entity declarations are not supported.");
  }
  if (XML_PROCESSING_INSTRUCTION.test(source)) {
    throw new SvgImportError("SVG processing instructions are not supported.");
  }

  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    throw new SvgImportError("SVG contains malformed XML.");
  }

  const root = document.documentElement;
  if (root.localName.toLowerCase() !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new SvgImportError("The selected file is not an SVG image.");
  }

  const size = resolveSvgSize(
    root.getAttribute("width"),
    root.getAttribute("height"),
    root.getAttribute("viewBox"),
  );

  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const name = element.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(name)) {
      throw new SvgImportError(`SVG <${element.localName}> content is not supported.`);
    }
    if (name === "style") validateCss(element.textContent ?? "");

    for (const attribute of Array.from(element.attributes)) {
      const attrName = attribute.localName.toLowerCase();
      if (attrName.startsWith("on")) {
        throw new SvgImportError("SVG event-handler attributes are not supported.");
      }
      if (attrName === "base" && attribute.prefix === "xml") {
        throw new SvgImportError("SVG xml:base references are not supported.");
      }
      if (attrName === "href" || attrName === "src") {
        validateSvgReference(attribute.value);
      }
      if (attrName === "style" || attribute.value.toLowerCase().includes("url(")) {
        validateCss(attribute.value);
      }
    }
  }

  // Make the decoder's viewport concrete and window-independent. Serializing
  // this validated detached document also strips the original XML declaration.
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  const serialized = new XMLSerializer().serializeToString(document);
  return {
    blob: new Blob([serialized], { type: "image/svg+xml" }),
    ...size,
  };
}

export async function rasterizeSvg(bytes: Uint8Array): Promise<HTMLImageElement> {
  const prepared = prepareSvgImport(bytes);
  const url = URL.createObjectURL(prepared.blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  if (image.naturalWidth !== prepared.width || image.naturalHeight !== prepared.height) {
    throw new SvgImportError("SVG decoder returned an unexpected image size.");
  }
  return image;
}

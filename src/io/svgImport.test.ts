import { describe, expect, it } from "vitest";
import {
  SVG_DEFAULT_SIZE,
  SVG_MAX_DIMENSION,
  SVG_MAX_PIXELS,
  resolveSvgSize,
  validateSvgReference,
} from "./svgImport";

describe("SVG import sizing", () => {
  it("uses fixed pixel dimensions", () => {
    expect(resolveSvgSize("640", "480px", "0 0 64 48")).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("uses viewBox dimensions when width and height are absent", () => {
    expect(resolveSvgSize(null, null, "-10 -20 320 180")).toEqual({
      width: 320,
      height: 180,
    });
  });

  it("derives a missing dimension from the viewBox ratio", () => {
    expect(resolveSvgSize("800", null, "0 0 16 9")).toEqual({
      width: 800,
      height: 450,
    });
    expect(resolveSvgSize(null, "450", "0 0 16 9")).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("uses the default object size for dimensions with no intrinsic ratio", () => {
    expect(resolveSvgSize(null, null, null)).toEqual(SVG_DEFAULT_SIZE);
    expect(resolveSvgSize("640", null, null)).toEqual({ width: 640, height: 150 });
    expect(resolveSvgSize(null, "480", null)).toEqual({ width: 300, height: 480 });
  });

  it("rejects relative, physical, zero, and malformed dimensions", () => {
    expect(() => resolveSvgSize("100%", "20", null)).toThrow(/positive pixel value/);
    expect(() => resolveSvgSize("2cm", "20", null)).toThrow(/positive pixel value/);
    expect(() => resolveSvgSize("0", "20", null)).toThrow(/greater than zero/);
    expect(() => resolveSvgSize(null, null, "0 0 10")).toThrow(/four numbers/);
    expect(() => resolveSvgSize(null, null, "0 0 -10 20")).toThrow(/positive numbers/);
  });

  it("rejects dimensions that exceed either canvas limit", () => {
    expect(() => resolveSvgSize(String(SVG_MAX_DIMENSION + 1), "1", null)).toThrow(
      /import limit/,
    );
    expect(() => resolveSvgSize("8192", String(SVG_MAX_PIXELS / 8192 + 1), null)).toThrow(
      /import limit/,
    );
  });
});

describe("SVG resource references", () => {
  it("allows same-document fragments and embedded raster images", () => {
    expect(() => validateSvgReference("#gradient")).not.toThrow();
    expect(() =>
      validateSvgReference("data:image/png;base64,iVBORw0KGgo="),
    ).not.toThrow();
    expect(() => validateSvgReference("data:image/jpeg,bytes")).not.toThrow();
  });

  it("rejects network, local-file, script, and nested SVG references", () => {
    for (const value of [
      "https://example.com/a.png",
      "//example.com/a.png",
      "file:///tmp/a.png",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
    ]) {
      expect(() => validateSvgReference(value), value).toThrow(/resource reference/);
    }
  });
});

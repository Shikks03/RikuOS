import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * The rail's brand tile at icon scale: an orange gradient ground with the
 * sunburst glyph. Never a letterform — the product name may change and a
 * monogram would have to change with it.
 *
 * Exported FULL-BLEED: the 7px radius is specified at the rail's 24px tile;
 * at 512px it would be a hairline of a corner, and both iOS and Android mask
 * the icon themselves.
 *
 * ImageResponse renders through satori, whose SVG support is the historically
 * fragile part — a failure surfaces as a broken image rather than a compile
 * error, so look at the generated PNG after the first build.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg, #FF9E5C, #F2622B)",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 24 24" fill="#2A1002">
          <path d="M12 1.6l1.7 6.1 4.5-4.4-2.4 6 6.1-1.7-5.4 3.3 5.4 3.3-6.1-1.7 2.4 6-4.5-4.4L12 22.4l-1.7-6.1-4.5 4.4 2.4-6-6.1 1.7 5.4-3.3-5.4-3.3 6.1 1.7-2.4-6 4.5 4.4z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}

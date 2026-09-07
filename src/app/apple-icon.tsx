import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The same brand tile at the iOS home-screen size. Full-bleed; iOS masks it. */
export default function AppleIcon() {
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
        <svg width="106" height="106" viewBox="0 0 24 24" fill="#2A1002">
          <path d="M12 1.6l1.7 6.1 4.5-4.4-2.4 6 6.1-1.7-5.4 3.3 5.4 3.3-6.1-1.7 2.4 6-4.5-4.4L12 22.4l-1.7-6.1-4.5 4.4 2.4-6-6.1 1.7 5.4-3.3-5.4-3.3 6.1 1.7-2.4-6 4.5 4.4z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}

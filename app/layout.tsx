import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-kr";

import "./globals.css";

// Run before React hydration so a saved dark theme never paints the light shell first.
const themeBootstrapScript = `
(() => {
  try {
    const savedTheme = localStorage.getItem("byeolharu_v2_theme")
      ?? localStorage.getItem("byeolharu_v1_theme");
    if (savedTheme === "dark") {
      document.documentElement.dataset.byeolharuTheme = "dark";
    }
  } catch {
    // Storage may be unavailable; keep the existing light-theme fallback.
  }
})();
`;

export const metadata: Metadata = {
  title: "별하루 — 작은 실천, 반짝이는 하루",
  description:
    "완벽함보다 꾸준함을. 하루의 루틴을 관리하고 1~5개의 별로 실천의 질과 몰입을 기록하는 나만의 습관 트래커, 별하루.",
  applicationName: "별하루",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "별하루" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#19242a",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-kr";

import "./globals.css";

// Resolve the saved selection and OS preference before React hydration.
const themeBootstrapScript = `
(() => {
  let mode = "system";
  try {
    const stored = localStorage.getItem("byeolharu_v3_theme_mode");
    const legacy = localStorage.getItem("byeolharu_v2_theme")
      ?? localStorage.getItem("byeolharu_v1_theme");
    mode = stored === "light" || stored === "dark" || stored === "system"
      ? stored : legacy === "dark" ? "dark" : "system";
  } catch {
    // Blocked optional storage falls back to the device preference.
  }
  const dark = mode === "dark" ||
    (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.byeolharuTheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0C111B" : "#F7F6F2");
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
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#F7F6F2" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

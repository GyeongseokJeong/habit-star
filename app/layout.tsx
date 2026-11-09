import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Noto_Color_Emoji } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-korean",
  display: "swap",
});
const notoEmoji = Noto_Color_Emoji({
  weight: "400",
  subsets: ["emoji"],
  variable: "--font-emoji",
  display: "swap",
});

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#090a0f" },
  ],
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSans.variable} ${notoEmoji.variable}`}>
        {children}
      </body>
    </html>
  );
}

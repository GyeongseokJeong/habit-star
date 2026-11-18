import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SwitchComparison from "./switch-comparison";

export const metadata: Metadata = {
  title: "색상 A/B·스위치 비교 — 별하루 테스트 진단",
  robots: { index: false, follow: false },
};

export default function SwitchDiagnosticPage() {
  // Diagnostic samples are safe to view on Vercel previews; production remains 404.
  if (process.env.NODE_ENV !== "development" && process.env.VERCEL_ENV !== "preview") notFound();
  return <SwitchComparison />;
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SwitchComparison from "./switch-comparison";

export const metadata: Metadata = {
  title: "스위치 색상 비교 — 별하루 개발 진단",
  robots: { index: false, follow: false },
};

export default function SwitchDiagnosticPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SwitchComparison />;
}

import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import ForceDarkProbe from "../probe";

type Variant = "baseline" | "declared" | "optout";
const variants: Variant[] = ["baseline", "declared", "optout"];
type Props = { params: Promise<{ variant: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Samsung Internet Force Dark 비교 — 별하루",
  robots: { index: false, follow: false },
};

// The browser receives a route-specific meta tag in the initial document.
// Baseline keeps the existing root viewport; declared and optout advertise support.
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { variant } = await params;
  return variant === "declared" || variant === "optout"
    ? { colorScheme: "light dark", themeColor: "#111925" }
    : { themeColor: "#111925" };
}

export default async function ForceDarkExperiment({ params }: Props) {
  if (process.env.NODE_ENV !== "development" && process.env.VERCEL_ENV !== "preview") {
    notFound();
  }
  const { variant } = await params;
  if (!variants.includes(variant as Variant)) notFound();
  return <ForceDarkProbe variant={variant as Variant} />;
}

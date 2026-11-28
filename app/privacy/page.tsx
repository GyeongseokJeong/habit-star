import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyContent } from "@/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "별하루 개인정보처리방침",
  description: "별하루의 개인정보 처리 목적, 보관 및 삭제 요청 안내.",
};

export default function PrivacyPage() {
  return <LegalPage title="개인정보처리방침"><PrivacyContent /></LegalPage>;
}

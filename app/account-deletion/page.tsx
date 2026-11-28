import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { AccountDeletionContent } from "@/components/legal/account-deletion-content";

export const metadata: Metadata = {
  title: "별하루 계정 삭제 요청",
  description: "별하루 앱의 회원 계정 및 관련 데이터 삭제를 요청하는 방법.",
};

export default function AccountDeletionPage() {
  return <LegalPage title="계정 삭제 요청"><AccountDeletionContent /></LegalPage>;
}

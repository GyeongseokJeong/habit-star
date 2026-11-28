"use client";

import { useState } from "react";
import { AccountSectionTitle } from "@/components/account/account-design";
import { ACCOUNT_DELETION_MAILTO, ACCOUNT_DELETION_SUBJECT, SUPPORT_EMAIL } from "@/lib/privacy-contact";

export function AccountDeletionContent({ embedded = false, onLogin }: { embedded?: boolean; onLogin?: () => void }) {
  const [copyStatus, setCopyStatus] = useState("");
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopyStatus("문의 이메일을 복사했어요.");
    } catch {
      setCopyStatus("복사할 수 없어요. 위 이메일 주소를 선택해 복사해 주세요.");
    }
  };
  return (
    <article className="legal-copy" aria-label="별하루 계정 삭제 요청 안내">
      <p>별하루 계정과 서버에 저장된 습관 기록을 직접 삭제할 수 있습니다. 앱을 설치하지 않아도 웹에서 탈퇴할 수 있습니다.</p>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>삭제 요청 방법</AccountSectionTitle>
        <ol>
          <li>별하루에 로그인한 뒤 내 계정 → 계정 관리 → 회원 탈퇴를 선택해 주세요.</li>
          <li>현재 비밀번호와 삭제 동의를 확인하면 계정과 관련 기록이 삭제됩니다.</li>
        </ol>
        {onLogin ? <button type="button" className="account-primary-action legal-action" onClick={onLogin}>별하루 계정으로 이동</button> :
          !embedded && <a className="account-primary-action legal-action" href="/">별하루에서 로그인하기</a>}
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>로그인할 수 없나요?</AccountSectionTitle>
        <p>로그인이 어렵다면 가입 이메일 주소로 삭제를 요청해 주세요. 본인 확인 후 계정과 관련 기록을 삭제하고 결과를 이메일로 안내합니다.</p>
        <div className="account-ui-card legal-contact">
          <span>받는 사람</span>
          <strong className="legal-email">{SUPPORT_EMAIL}</strong>
          <span>메일 제목</span>
          <strong>{ACCOUNT_DELETION_SUBJECT}</strong>
          <a className={(embedded && !onLogin ? "account-primary-action" : "account-secondary-action") + " legal-action"} href={ACCOUNT_DELETION_MAILTO}>삭제 요청 메일 작성</a>
          <button type="button" className="account-secondary-action legal-action" onClick={() => void copyEmail()}>이메일 주소 복사</button>
          <p className="legal-feedback" role="status">{copyStatus}</p>
          <p>메일 앱이 열리지 않으면 주소를 복사해 직접 보내 주세요.</p>
        </div>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>삭제되는 정보</AccountSectionTitle>
        <p>회원 인증 정보, 습관, 실천 기록, 별점, 메모 및 관련 동기화 데이터</p>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>삭제 전 확인해 주세요</AccountSectionTitle>
        <ul>
          <li>삭제한 기록은 복구할 수 없습니다. 필요한 기록은 미리 백업해 주세요.</li>
          <li>직접 탈퇴한 기기의 회원 기록은 정리됩니다. 다른 기기의 오프라인 사본, 비회원 기록 및 별도로 저장한 파일은 직접 관리해 주세요.</li>
          <li>비밀번호나 인증번호는 메일에 적지 마세요.</li>
        </ul>
      </section>
    </article>
  );
}

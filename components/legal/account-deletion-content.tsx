"use client";

import { useState } from "react";
import { ACCOUNT_DELETION_MAILTO, ACCOUNT_DELETION_SUBJECT, SUPPORT_EMAIL } from "@/lib/privacy-contact";

export function AccountDeletionContent() {
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
      <p>회원 계정과 회원 기록을 삭제하려면 아래 이메일로 요청해 주세요. 앱을 설치하지 않았거나 로그아웃한 상태에서도 요청할 수 있습니다.</p>
      <section>
        <h2>삭제 요청 방법</h2>
        <ol>
          <li>삭제 전에 필요한 기록을 백업해 주세요. 로그인한 기기가 있다면 요청 전에 로그아웃하여 해당 기기의 회원 캐시를 정리할 수 있습니다. 로그인이나 앱 설치는 삭제 요청의 필수 조건이 아닙니다.</li>
          <li>가입한 이메일 주소로 아래 문의 이메일에 계정 삭제 요청을 보내 주세요. 다른 이메일에서 보내는 경우 가입 이메일 주소를 함께 알려주세요.</li>
          <li>운영자가 본인 확인과 삭제 범위 확인 후 삭제를 처리하고 안내합니다.</li>
        </ol>
        <div className="legal-contact">
          <span>받는 사람</span>
          <strong className="legal-email">{SUPPORT_EMAIL}</strong>
          <span>메일 제목</span>
          <strong>{ACCOUNT_DELETION_SUBJECT}</strong>
          <a className="legal-action" href={ACCOUNT_DELETION_MAILTO}>삭제 요청 메일 작성</a>
          <button type="button" className="legal-action legal-secondary" onClick={() => void copyEmail()}>이메일 주소 복사</button>
          <p className="legal-feedback" role="status">{copyStatus}</p>
          <p>메일 앱이 열리지 않으면 위 주소를 복사하여 이메일 서비스에서 직접 작성해 주세요. 메일을 직접 보내야 요청이 전달됩니다.</p>
        </div>
      </section>
      <section>
        <h2>삭제되는 정보</h2>
        <p>대상 회원 계정의 인증 정보, 습관, 날짜별 실천 기록(완료 여부, 별점, 메모) 및 관련 동기화 데이터가 삭제 대상입니다.</p>
      </section>
      <section>
        <h2>삭제 요청 전 확인해 주세요</h2>
        <ul>
          <li>메일 작성만으로 계정이 즉시 삭제되지는 않습니다. 운영자의 확인 및 완료 안내를 기다려 주세요.</li>
          <li>계정 삭제가 완료되면 삭제한 회원 기록을 복구할 수 없습니다.</li>
          <li>기기에 남은 오프라인 사본, 비회원 기록 및 직접 내보낸 백업 파일은 서버의 회원 데이터 삭제와 별도로 관리해야 합니다.</li>
          <li>비밀번호, 인증번호, 백업 원본이나 습관 메모는 이메일에 첨부하지 마세요.</li>
        </ul>
      </section>
    </article>
  );
}

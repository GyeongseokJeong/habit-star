import { SUPPORT_EMAIL } from "@/lib/privacy-contact";

/**
 * Shared copy for the public web route and the offline-capable Android UI.
 * This is a policy REVIEW draft until the operator confirms retention,
 * processors and deletion operations. Do not submit it to Google Play yet.
 */
export function PrivacyContent({ onDeletion }: { onDeletion?: () => void }) {
  return (
    <article className="legal-copy" aria-label="별하루 개인정보처리방침">
      <p className="legal-draft-note">검토용 초안 · 정식 시행 전 처리 및 보관 기준을 확정합니다.</p>
      <p>별하루는 하루의 습관을 기록하고 관리하는 서비스입니다. 회원가입 없이도 이용할 수 있으며, 로그인하면 회원 기록을 동기화할 수 있습니다.</p>
      <section>
        <h2>1. 개인정보 처리 목적과 항목</h2>
        <ul>
          <li>비회원: 습관 제목, 반복 요일, 예정 시간과 알림 설정, 완료 여부, 별점, 메모 등은 기기 내에 저장합니다.</li>
          <li>회원: 이메일, 사용자 식별자 및 인증 정보를 계정 생성, 로그인, 비밀번호 재설정에 사용합니다. 습관·기록·시간대와 동기화에 필요한 정보를 회원 기록 보관, 가져오기 및 동기화에 사용합니다.</li>
          <li>고객 문의: 문의자가 보내는 이메일 주소와 문의 내용을 본인 확인과 문의 처리에 사용합니다.</li>
        </ul>
        <p>위젯과 알림은 기기에 저장한 습관 정보를 사용합니다. 화면에 표시되는 기록은 위젯 및 알림 설정에서 관리할 수 있습니다.</p>
      </section>
      <section>
        <h2>2. 개인정보의 처리 및 보관</h2>
        <p>별하루는 회원 인증 및 데이터 저장에 Supabase, 웹 서비스 제공에 Vercel을 사용합니다. 처리 목적, 위탁 및 국외 이전에 관한 상세 정보와 서버 로그·백업·문의 정보의 실제 보관 기간은 정식 시행 전에 확정합니다.</p>
        <p>사용자가 직접 내보내거나 공유한 백업과 별빛 카드 등은 선택한 저장·공유 대상에 전달될 수 있으며, 별도로 보관한 사본은 계정 삭제로 자동 제거되지 않습니다.</p>
      </section>
      <section>
        <h2>3. 계정 삭제와 개인정보의 파기</h2>
        <p>계정 삭제를 신청하면 운영자가 본인 확인 후 해당 계정과 연관 회원 기록의 삭제를 처리합니다. 삭제가 완료되면 기록을 복구할 수 없습니다. 법령에 따른 보존이나 서비스 백업의 파기 기준은 실제 운영 정책 확정 후 고지합니다.</p>
        <p>회원 탈퇴와 비회원 기기 기록 삭제는 구분합니다. 필요한 기록은 삭제 신청 전에 백업해 주세요.</p>
        {onDeletion ? (
          <button type="button" className="legal-action" onClick={onDeletion}>계정 삭제 요청 안내</button>
        ) : (
          <a className="legal-action" href="/account-deletion">계정 삭제 요청 안내</a>
        )}
      </section>
      <section>
        <h2>4. 이용자의 권리 및 문의</h2>
        <p>개인정보 열람, 정정, 삭제, 처리정지 및 관련 문의는 별하루 운영자에게 요청할 수 있습니다. 비밀번호나 인증번호를 이메일로 보내지 마세요.</p>
        <p>문의: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </section>
      <section>
        <h2>5. 안전성 확보 및 변경 안내</h2>
        <p>회원 인증과 계정별 접근 제어를 통해 다른 이용자의 회원 기록에 접근하지 못하도록 설계하였습니다. 전송 및 개인정보 보호 관련 운영 기준과 시행일은 정식 시행 전에 확정하여 고지합니다.</p>
      </section>
    </article>
  );
}

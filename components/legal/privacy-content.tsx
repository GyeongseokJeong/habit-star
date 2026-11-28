import { AccountSectionTitle } from "@/components/account/account-design";
import { SUPPORT_EMAIL } from "@/lib/privacy-contact";

export function PrivacyContent({ embedded = false }: { embedded?: boolean }) {
  return (
    <article className="legal-copy" aria-label="별하루 개인정보처리방침">
      <p>별하루는 이용자의 개인정보를 보호하며 다음과 같이 개인정보를 처리합니다.</p>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>1. 개인정보의 처리 항목 및 목적</AccountSectionTitle>
        <ul>
          <li>회원 정보: 이메일, 사용자 식별자 및 인증 정보 (회원가입, 로그인, 비밀번호 재설정)</li>
          <li>습관 기록: 습관 제목, 반복 요일, 예정 시간, 알림 설정, 완료 여부, 별점, 메모, 시간대 및 동기화 정보 (기록 관리 및 동기화)</li>
          <li>문의 정보: 이메일 및 문의 내용 (본인 확인 및 고객 문의 처리)</li>
          <li>접속 및 서비스 이용 로그: IP 주소, 접속 일시, 요청 및 오류 정보 (서비스 보안 및 장애 대응)</li>
        </ul>
        <p>비회원의 습관 기록은 기기에 저장됩니다. 알림과 위젯은 기기에 저장된 정보를 사용합니다.</p>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>2. 개인정보의 보유 및 파기</AccountSectionTitle>
        <p>회원 정보와 서버에 저장된 습관 기록은 회원 탈퇴 처리 시까지, 문의 정보는 문의 처리 및 필요한 후속 조치가 끝날 때까지 보관합니다. 처리 목적을 달성한 개인정보는 지체 없이 파기합니다.</p>
        <p>법령에 따라 보존해야 하는 정보는 해당 기간이 끝나면 파기합니다. 서비스 운영 로그 및 복구용 백업은 각 시스템의 보관 주기에 따라 파기합니다.</p>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>3. 개인정보의 제공 및 처리 위탁</AccountSectionTitle>
        <p>별하루는 이용자의 동의 또는 법령에 따른 근거 없이 개인정보를 제3자에게 제공하지 않습니다. 서비스 제공을 위해 다음 외부 서비스를 이용합니다.</p>
        <ul>
          <li>Supabase: 회원 인증, 데이터 저장 및 동기화</li>
          <li>Vercel: 웹 서비스 제공</li>
          <li>Google(Gmail): 고객 문의 이메일 처리</li>
        </ul>
        <p>외부 서비스의 운영 환경에 따라 개인정보가 국내외에서 처리될 수 있습니다. 회원 인증 및 동기화를 원하지 않는 경우 비회원으로 이용할 수 있습니다.</p>
        <p>이용자가 직접 저장하거나 공유한 백업 및 별빛 카드는 선택한 저장·공유 대상에서 별도로 관리됩니다.</p>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>4. 계정 삭제</AccountSectionTitle>
        <p>앱 또는 웹에서 로그인 후 아래 경로에서 탈퇴할 수 있습니다.</p>
        <p className="legal-deletion-path"><strong>내 계정 → 계정 관리 → 회원 탈퇴</strong></p>
        <p>비밀번호로 본인 확인 후 계정과 서버에 저장된 관련 기록이 삭제되며, 복구할 수 없습니다. 로그인할 수 없는 경우 아래 문의 이메일로 삭제를 요청할 수 있습니다.</p>
        <p>비회원 기록, 다른 기기의 오프라인 사본 및 내보낸 파일은 별도로 관리해 주세요.</p>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>5. 이용자의 권리 및 개인정보 문의</AccountSectionTitle>
        <p>이용자는 개인정보의 열람, 정정, 삭제 및 처리정지를 요청할 수 있습니다.</p>
        <p>개인정보 보호책임자: 별하루 운영자<br /><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </section>
      <section>
        <AccountSectionTitle as={embedded ? "h3" : "h2"}>6. 개인정보의 안전한 관리</AccountSectionTitle>
        <p>별하루는 회원 인증과 계정별 접근 제어를 통해 개인정보를 보호합니다. 방침 변경 사항은 앱과 웹사이트를 통해 안내합니다.</p>
      </section>
      <p>본 방침은 게시일부터 적용됩니다.</p>
    </article>
  );
}

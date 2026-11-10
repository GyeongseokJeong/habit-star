type AuthFailure = { code?: string; status?: number };
export function authErrorMessage(error: unknown) {
  const failure: AuthFailure =
    typeof error === "object" && error !== null ? error : {};
  if (
    failure.status === 429 ||
    failure.code === "over_email_send_rate_limit" ||
    failure.code === "over_request_rate_limit"
  )
    return "요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.";
  if (failure.code === "email_not_confirmed")
    return "이메일 인증이 필요합니다. 받은 메일의 인증 링크를 확인해주세요.";
  if (failure.code === "email_address_not_authorized")
    return "현재 메일 발송 설정으로 이 주소에 전송할 수 없습니다. 서비스의 메일 발송 설정을 확인해야 합니다.";
  if (failure.code === "weak_password")
    return "더 안전한 비밀번호가 필요합니다. 길이와 문자 조합을 바꿔주세요.";
  if (failure.code === "same_password")
    return "기존 비밀번호와 다른 비밀번호를 입력해주세요.";
  if (
    failure.code === "invalid_credentials" ||
    failure.code === "user_already_exists" ||
    failure.code === "email_exists"
  )
    return "요청을 처리하지 못했습니다. 이메일과 비밀번호를 확인해주세요.";
  return "요청 중 예상하지 못한 오류가 발생했습니다. 연결 상태를 확인하고 다시 시도해주세요.";
}

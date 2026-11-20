/**
 * Android-only permission presentation.
 * Opt-in ("want reminders") and OS permission ("may display reminders")
 * must remain independent. Pending Android jobs are not proof of delivery.
 */
export function reminderPermissionPresentation({optIn,permission,pendingCount=0}={}) {
  if (!Number.isInteger(pendingCount) || pendingCount < 0) throw new Error("잘못된 예약 건수");
  if (optIn !== true) {
    return {state:"off",headline:"습관 알림 꺼짐",note:"별하루에서 습관 알림을 사용하지 않아요."};
  }
  if (permission === "denied") {
    return {
      state:"blocked",
      headline:"기기 알림 권한이 차단됐어요",
      note:"별하루 설정은 켜져 있어도 지금은 알림을 받을 수 없어요. 휴대폰 설정 > 앱 > 별하루 > 알림에서 허용해 주세요.",
      queueNote:"Android에 보관된 예약 "+pendingCount+"건 · 현재 알림 표시 불가",
    };
  }
  if (permission === "granted") {
    return {state:"ready",headline:"기기 알림 허용",note:"습관별 알림을 받을 수 있도록 허용되어 있어요."};
  }
  return {
    state:"unknown",
    headline:"기기 알림 권한 확인 중",
    note:"기기 알림 상태를 확인하고 있어요.",
  };
}

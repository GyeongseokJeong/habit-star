/** Android OS permission, separate from user opt-in to individual reminders. */
export const PERMISSION_OFFER_SEEN_KEY = "byeolharu_android_notification_permission_offer_v1";

export function permissionStateFromAndroid(display) {
  if (display === "granted") return "granted";
  if (display === "prompt" || display === "prompt-with-rationale") return "prompt";
  if (display === "denied") return "denied";
  return "unknown";
}

export function shouldShowPermissionOffer({ permission, seen, explicitlyDisabled }) {
  return permission === "prompt" && seen === false && explicitlyDisabled !== true;
}

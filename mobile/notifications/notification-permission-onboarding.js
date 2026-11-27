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

/** Permission-only decision for an explicit habit ON action. Never edits
 * reminder preferences, schedules alerts or opens Android settings itself. */
export async function requestHabitReminderPermission(localNotifications) {
  let before;
  try {
    before = permissionStateFromAndroid((await localNotifications.checkPermissions()).display);
  } catch {
    return { permission: "unknown", route: "retry" };
  }
  if (before === "granted") return { permission: before, route: "enable" };
  if (before === "unknown") return { permission: before, route: "retry" };

  let permission;
  try {
    permission = permissionStateFromAndroid((await localNotifications.requestPermissions()).display);
  } catch {
    // A bridge failure is not evidence of a new permission denial.
    return { permission: before === "denied" ? before : "unknown",
      route: before === "denied" ? "settings" : "retry" };
  }
  if (permission === "granted") return { permission, route: "enable" };
  if (permission === "unknown") return { permission, route: "retry" };
  // Only a previously blocked permission permits settings recovery during
  // this deliberate action. Respect a fresh OS dismissal or denial.
  return { permission, route: before === "denied" && permission === "denied" ? "settings" : "declined" };
}

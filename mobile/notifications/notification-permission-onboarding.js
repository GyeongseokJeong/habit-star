/** Android OS permission, separate from user opt-in to individual reminders. */
// v1 was consumed by the habit editor. v2 covers restored habit intent and
// both Android permissions, independently of the device opt-in preference.
export const PERMISSION_OFFER_SEEN_KEY = "byeolharu_android_notification_permission_offer_v2";

export function permissionStateFromAndroid(display) {
  if (display === "granted") return "granted";
  if (display === "prompt" || display === "prompt-with-rationale") return "prompt";
  if (display === "denied") return "denied";
  return "unknown";
}

export function exactPermissionStateFromAndroid(exact) {
  return exact === "granted" || exact === "denied" ? exact : "unknown";
}

/** Check both permissions even on an empty installation. One bridge failure
 * must not turn the other result into a denial. This method never requests. */
export async function readDeviceReminderPermissions(localNotifications) {
  const [display, exact] = await Promise.all([
    Promise.resolve().then(() => localNotifications.checkPermissions()).catch(() => null),
    Promise.resolve().then(() => localNotifications.checkExactNotificationSetting()).catch(() => null),
  ]);
  return {
    permissionState: permissionStateFromAndroid(display?.display),
    exactPermission: exactPermissionStateFromAndroid(exact?.exact_alarm),
  };
}

/** A related deliberate action may always retry, even after a dismissal. */
export function shouldShowPermissionOffer({ permission }) {
  return permission === "prompt" || permission === "denied";
}

/** One in-app invitation per installation, only with a verified, current
 * snapshot and real demand. An explicit habit OFF does not disable wrap-ups.
 * Empty install/unknown/foreground checks never consume the invitation. */
export function startupPermissionOffer({
  permission, exactPermission, seen, ready, habitIntent, explicitlyDisabled, wrapupEnabled,
}) {
  if (seen !== false || ready !== true ||
      !((habitIntent === true && explicitlyDisabled !== true) || wrapupEnabled === true)) return null;
  if (shouldShowPermissionOffer({ permission })) return "setup";
  if (permission === "granted" && exactPermission === "denied") return "setup";
  return null;
}

/** Permission-only decision for an explicit related action. Never edits
 * reminder preferences, schedules alerts or opens Android settings itself. */
export async function requestHabitReminderPermission(localNotifications, checkedPermission) {
  let before = checkedPermission;
  if (before === undefined) {
    try {
      before = permissionStateFromAndroid((await localNotifications.checkPermissions()).display);
    } catch {
      return { permission: "unknown", route: "retry" };
    }
  }
  if (before === "granted") return { permission: before, route: "enable" };
  if (before === "denied") return { permission: before, route: "settings" };
  if (before !== "prompt") return { permission: "unknown", route: "retry" };

  let permission;
  try {
    permission = permissionStateFromAndroid((await localNotifications.requestPermissions()).display);
  } catch {
    // A bridge failure is not evidence of a new permission denial.
    return { permission: "unknown", route: "retry" };
  }
  if (permission === "granted") return { permission, route: "enable" };
  if (permission === "unknown") return { permission, route: "retry" };
  // Respect a fresh OS dismissal or denial. No automatic Settings redirect.
  return { permission, route: "declined" };
}

/** Single deliberate setup session. Neither an OS activity launch nor an
 * ActivityResult is permission consent. Read both OS states after every return.
 * The caller owns the in-flight lock, scope generation, foreground guard and
 * scheduling. Exact access is optional; it never gates ordinary reminders. */
export async function runReminderPermissionSetup({
  localNotifications, read, openDisplaySettings, checkForeground, waitForForeground, isCurrent,
}) {
  const interrupted = { status: "interrupted", displayGranted: false };
  const result = (status, permissions) => ({
    status, displayGranted: permissions?.permissionState === "granted",
  });
  const canContinue = async () => isCurrent() && await checkForeground() && isCurrent();
  if (!await canContinue()) return interrupted;
  let current = await read();
  if (!await canContinue()) return interrupted;
  const attempt = await requestHabitReminderPermission(localNotifications, current.permissionState);
  if (!isCurrent()) return interrupted;
  if (attempt.route === "declined") {
    await read();
    return result("declined");
  }
  if (attempt.route === "retry") return result("retry");
  if (attempt.route === "settings") {
    try {
      if (!await canContinue()) return interrupted;
      await openDisplaySettings();
    } catch { return result("settings-error"); }
  }
  if (!await waitForForeground() || !isCurrent()) return interrupted;
  current = await read();
  if (!await canContinue()) return interrupted;
  if (current.permissionState !== "granted") {
    return result(current.permissionState === "unknown" ? "retry" : "declined");
  }
  if (current.exactPermission === "granted") return result("complete", current);
  if (current.exactPermission !== "denied") return result("exact-unknown", current);

  // Same explicit CTA, same verified scope, freshly read display grant,
  // and a foreground check after that read, not just before its bridge I/O.
  let exactFailed = false;
  try { await localNotifications.changeExactNotificationSetting(); }
  catch { exactFailed = true; }
  if (!await waitForForeground() || !isCurrent()) return interrupted;
  current = await read();
  if (!await canContinue()) return interrupted;
  if (current.permissionState !== "granted") {
    return result(current.permissionState === "unknown" ? "retry" : "declined");
  }
  if (current.exactPermission === "granted") return result("complete", current);
  if (exactFailed) return result("exact-error", current);
  return result(current.exactPermission === "denied" ? "ordinary" : "exact-unknown", current);
}

// The only account-scoped native preferences outside the member repository.
// Device-level permissions/theme and all guest/other-member preferences survive.
export const WRAPUP_REMINDER_STORAGE_PREFIX = "byeolharu_android_wrapup_reminders_v1:";
export const REMINDER_LATENCY_STORAGE_PREFIX = "byeolharu_android_reminder_latency_v1:";

export function clearDeletedMemberLocalData(storage: Storage, userId: string) {
  if (storage.getItem("byeolharu_verified_user") === userId)
    storage.removeItem("byeolharu_verified_user");
  storage.removeItem(WRAPUP_REMINDER_STORAGE_PREFIX + "member:" + userId);
  storage.removeItem(REMINDER_LATENCY_STORAGE_PREFIX + "member:" + userId);
}

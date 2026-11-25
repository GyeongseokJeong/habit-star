import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { isAndroidReturnUrl } from "../../lib/supabase/android-return";
import { LocalNotifications } from "@capacitor/local-notifications";
import Byeolharu from "../../components/byeolharu";
import { shareStarlightPngOnAndroid } from "./native-starlight-share";
import { exportGuestBackupOnAndroid } from "./native-guest-backup";
import type { Snapshot } from "../../lib/habits/repository";
import { buildWidgetSummary, buildWidgetActionProjection, type WidgetSummary } from "../../lib/habits/widget-summary";
import { seedWidgetRuntimeProbe } from "./widget-runtime-probe";
import type { WidgetPracticeCommand, WidgetPracticeResult } from "../../lib/habits/widget-practice";
import type { PluginListenerHandle } from "@capacitor/core";
import type { NativeReminderControls, WrapupSettings, WrapupGroup } from "../../lib/habits/native-reminder-controls";
import type { TimeGroup } from "../../lib/habits/domain";
import { parseHabitReminder, type HabitReminderNavigation } from "../../lib/habits/reminder-navigation";
import { REMINDER_KIND } from "../notifications/reminder-plan.js";
import { buildScopedReminderPlan } from "../notifications/scoped-reminder-runtime.js";
import { mergeReminderLedger, measureReminderLatency, formatReminderDelay } from "../notifications/reminder-latency.js";
import { WRAPUP_GROUPS, WRAPUP_DEFAULTS, normalizeWrapupSettings, hasEnabledWrapup } from "../notifications/wrapup-reminders.js";
import { createReminderLifecycle } from "../notifications/reminder-lifecycle.js";
import { reconcileWithForegroundRetry } from "../notifications/foreground-reminder-retry.js";
import { guestReminderAction } from "../notifications/guest-reminder-readiness.js";
import { createResumeDispatcher } from "../notifications/native-resume-refresh.js";
import { summarizeGuestPending } from "../notifications/guest-reminder-diagnostics.js";
import { auditGuestReminders } from "../notifications/guest-reminder-audit.js";
import { repairGuestReminders } from "../notifications/guest-reminder-repair.js";
import { reminderPermissionPresentation } from "../notifications/guest-reminder-permission-view.js";
import { reminderSwitchChecked, canManuallyRepairGuestReminders } from "../notifications/guest-reminder-switch-state.js";
import { effectiveHabitReminderOptIn, hasConfiguredHabitReminders } from "../notifications/habit-reminder-intent.js";
import { PERMISSION_OFFER_SEEN_KEY, permissionStateFromAndroid, shouldShowPermissionOffer } from "../notifications/notification-permission-onboarding.js";


// This module is bundled into the isolated Android guest APK only.
// The website's Next.js entrypoint never imports Capacitor or native controls.
const OPT_IN_KEY = "byeolharu_android_guest_reminders_optin_v1";
const WRAPUP_STORAGE_KEY = "byeolharu_android_wrapup_reminders_v1:";
function readWrapupSettings(scope: string): WrapupSettings {
  const stored = localStorage.getItem(WRAPUP_STORAGE_KEY + scope);
  return normalizeWrapupSettings(stored ? JSON.parse(stored) : WRAPUP_DEFAULTS) as WrapupSettings;
}
const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const lifecycle = isAndroid ? createReminderLifecycle({ localNotifications: LocalNotifications }) : null;
const identity = { kind: "guest" as const, verified: true };
type ReminderIdentity =
  | { kind: "guest"; verified: true }
  | { kind: "member"; userId: string; verified: true };
const reminderIdentityKey = (value: ReminderIdentity) =>
  value.kind === "guest" ? "guest" : "member:" + value.userId;
const experimentalWidgetPractice = isAndroid && process.env.NEXT_PUBLIC_ANDROID_RELEASE !== "true";
// Debug-only synthetic marker; no habit, identity, session, or cloud data.
if (experimentalWidgetPractice) void seedWidgetRuntimeProbe(window.location.origin).catch(() => {});
type WidgetPracticeRequest = { requestId: string; actionKey: string; deadline: number };
type DeviceSettings = {
  addListener: (event: "widgetPracticeRequest", listener: (request: WidgetPracticeRequest) => void) => Promise<PluginListenerHandle>;
  claimWidgetPractice: (request: WidgetPracticeRequest) => Promise<{ accepted: boolean }>;
  finishWidgetPractice: (result: { requestId: string; result: string }) => Promise<void>;
  publishWidgetSummary: (summary: WidgetSummary | { ready: false }) => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  getActiveReminderPosts: () => Promise<{ posts: {id: number; postedAt: number}[] }>;
};
const LEDGER_KEY = "byeolharu_android_reminder_latency_v1:";
function readReminderLedger(scope: string): {id:number; at:number}[] {
  try {
    const value = JSON.parse(localStorage.getItem(LEDGER_KEY + scope) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
const deviceSettings = isAndroid ? registerPlugin<DeviceSettings>("ByeolharuDeviceSettings") : null;

function GuestNativeApp() {
  // null: not configured on this installation; false: explicitly opted out.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hasHabitIntent, setHasHabitIntent] = useState(false);
  const [wrapupSettings, setWrapupSettings] = useState<WrapupSettings>(() =>
    normalizeWrapupSettings(WRAPUP_DEFAULTS) as WrapupSettings);
  const [wrapupNavigation, setWrapupNavigation] = useState<{ tab: TimeGroup; serial: number } | null>(null);
  const [habitNavigation, setHabitNavigation] = useState<HabitReminderNavigation | null>(null);
  const habitNavigationSerial = useRef(0);
  const [nativeAuthReturn, setNativeAuthReturn] = useState(0);
  useEffect(() => {
    if (!isAndroid) return;
    let disposed = false;
    let receivedLiveReturn = false;
    const accept = (url: unknown) => {
      if (!disposed && isAndroidReturnUrl(url)) setNativeAuthReturn(n => n + 1);
    };
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      if (isAndroidReturnUrl(url)) receivedLiveReturn = true;
      accept(url);
    }).catch(() => null);
    void listener.then(() => App.getLaunchUrl()).then(result => {
      if (!receivedLiveReturn) accept(result?.url);
    }).catch(() => {});
    return () => {
      disposed = true;
      void listener.then(handle => handle?.remove());
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [permissionState, setPermissionState] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
  const [exactPermission, setExactPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [latencyStatus, setLatencyStatus] = useState("");
  const [permissionOfferSeen, setPermissionOfferSeen] = useState(true);
  const [diagnostic, setDiagnostic] = useState("");
  const [auditStatus, setAuditStatus] = useState("");
  const [repairAvailable, setRepairAvailable] = useState(false);
  const [repairStatus, setRepairStatus] = useState("");
  const auditRevision = useRef(0);
  const snapshot = useRef<Snapshot | null>(null);
  const identityRef = useRef<ReminderIdentity>(identity);
  const enabledRef = useRef<boolean | null>(null);
  const wrapupRef = useRef<WrapupSettings>(normalizeWrapupSettings(WRAPUP_DEFAULTS) as WrapupSettings);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const operation = useRef(Promise.resolve());
  useEffect(() => {
    // Mark the first committed React screen, not merely successful JS parsing.
    (window as Window & { __byeolharuStartupReady?: boolean }).__byeolharuStartupReady = true;
  }, []);

  const schedule = useCallback((value: boolean, next: Snapshot | null) => {
    if (!lifecycle) return Promise.resolve();
    const context = {
      identity: identityRef.current, optIn: effectiveHabitReminderOptIn(value, next), wrapupSettings: wrapupRef.current,
      snapshot: next && {
      day: next.day,
      timeZone: identityRef.current.kind === "member" ? next.state.timezone : undefined,
      habits: next.habits.map(h => ({ ...h, repeatDays: h.repeatDays ? [...h.repeatDays] : undefined })),
    }};
    const task = operation.current.then(async () => {
      if (!mounted.current) return;
      const action = guestReminderAction(context.optIn || hasEnabledWrapup(context.wrapupSettings), context.snapshot);
      // The existing Android queue belongs to this package. Missing or stale
      // IndexedDB hydration must not silently revoke already planned alarms.
      if (action === "await-snapshot" || action === "await-today") {
        if (mounted.current) setStatus(
          action === "await-today"
            ? "날짜가 변경되어 오늘 기록을 확인하고 있어요."
            : "저장된 습관 기록을 불러오고 있어요.",
        );
        return;
      }
      // Android/OEM scheduling occasionally rejects despite valid permission.
      // Reconcile once more while the same verified snapshot is still current,
      // never after a logout, opt-out, stale day or background transition.
      const currentScope = reminderIdentityKey(context.identity);
      const canRetry = async () => {
        if (!mounted.current || document.visibilityState !== "visible" ||
            snapshot.current !== next ||
            currentScope !== reminderIdentityKey(identityRef.current) ||
            guestReminderAction(context.optIn || hasEnabledWrapup(context.wrapupSettings), context.snapshot) !== "sync") {
          return false;
        }
        try { return (await LocalNotifications.checkPermissions()).display === "granted"; }
        catch { return false; }
      };
      const result = await reconcileWithForegroundRetry({
        sync: () => lifecycle.sync(context), canRetry,
      });
      if (context.snapshot && (result.status === "updated" || result.status === "unchanged")) {
        try {
          const scope = reminderIdentityKey(context.identity);
          const plan = buildScopedReminderPlan(context.snapshot, {
            scope, now: new Date(), daysAhead: 8, habitOptIn: context.optIn,
            wrapupSettings: context.wrapupSettings,
          });
          localStorage.setItem(LEDGER_KEY + scope,
            JSON.stringify(mergeReminderLedger(readReminderLedger(scope), plan.notifications)));
        } catch { /* Diagnostics never block delivery. */ }
      }
      if (mounted.current) {
        if (result.status === "updated" || result.status === "unchanged") {
          setExactPermission(result.exactPermission === "granted" ? "granted" :
            result.exactPermission === "denied" ? "denied" : "unknown");
        }
        if (result.status === "permission-required") setStatus("Android 알림 권한을 확인해 주세요.");
        else if (result.status === "snapshot-not-ready") setStatus("오늘 기록을 불러온 후 다시 확인해 주세요.");
        else if (result.status === "updated" || result.status === "unchanged") setStatus("알림 예약을 확인했어요.");
        else if (result.status === "disabled") setStatus("");
      }
    });
    operation.current = task.catch(() => {});
    return task;
  }, []);

  const refreshPermission = useCallback(async () => {
    if (!isAndroid) return;
    try {
      const [current, exact] = await Promise.all([
        LocalNotifications.checkPermissions(),
        LocalNotifications.checkExactNotificationSetting().catch(() => null),
      ]);
      if (mounted.current) {
        setExactPermission(exact?.exact_alarm === "granted" ? "granted" : exact ? "denied" : "unknown");
        const granted = current.display === "granted";
        setPermissionState(permissionStateFromAndroid(current.display));
        if (!granted) setRepairAvailable(false);
        // The OS permission may be granted in Settings without any changes
        // to the hydrated React snapshot. Reconcile on native app resume.
        if (granted && snapshot.current) {
          void schedule(enabledRef.current, snapshot.current).catch(() => {
            if (mounted.current) setStatus("알림 예약을 확인하지 못했어요.");
          });
        }
      }
    } catch {
      if (mounted.current) setPermissionState("unknown");
    }
  }, [schedule]);

  useEffect(() => {
    mounted.current = true;
    void refreshPermission();
    // A previously enabled device setting may survive a process restart.
    // Restore it only in this isolated package; never ask permissions here.
    try {
      const preference = localStorage.getItem(OPT_IN_KEY);
      const saved = preference === "1" ? true : preference === "0" ? false : null;
      // Do not re-prompt existing users with an explicit device preference.
      setPermissionOfferSeen(localStorage.getItem(PERMISSION_OFFER_SEEN_KEY) === "1" || saved !== null);
      const configured = readWrapupSettings("guest");
      enabledRef.current = saved;
      wrapupRef.current = configured;
      setEnabled(saved);
      setWrapupSettings(configured);
      // A fresh APK has no global opt-in key, but cloud habits may already
      // have their own ON switches. Never clear native jobs before hydration.
      if (snapshot.current) {
        void schedule(saved, snapshot.current).catch(() => setStatus("알림을 확인하지 못했어요."));
      }
    } catch {
      // An unreadable preference is not proof of opt-out. Preserve the
      // native queue and ask the user to review settings rather than delete.
      setStatus("알림 설정을 읽지 못했어요. 기기 저장 공간을 확인해 주세요.");
    }
    return () => { mounted.current = false; };
  }, [schedule, refreshPermission]);

  const widgetQueue = useRef(Promise.resolve());
  const widgetCommands = useRef(new Map<string, WidgetPracticeCommand>());
  const widgetHandler = useRef<((command: WidgetPracticeCommand, deadline: number) => Promise<WidgetPracticeResult>) | null>(null);
  const registerWidgetPractice = useCallback<NonNullable<NativeReminderControls["registerWidgetPractice"]>>((handler) => {
    widgetHandler.current = handler;
    return () => { if (widgetHandler.current === handler) widgetHandler.current = null; };
  }, []);
  useEffect(() => {
    if (!experimentalWidgetPractice || !deviceSettings) return;
    const bridge = deviceSettings;
    let disposed = false;
    const listener = bridge.addListener("widgetPracticeRequest", async request => {
      let result: WidgetPracticeResult | "error" = "not-ready";
      try {
        const command = widgetCommands.current.get(request.actionKey);
        if (!disposed && command && widgetHandler.current && Date.now() < request.deadline) {
          const claim = await bridge.claimWidgetPractice(request);
          if (claim.accepted && !disposed && widgetCommands.current.get(request.actionKey) === command && Date.now() < request.deadline) {
            const handler = widgetHandler.current;
            if (handler) result = await handler(command, request.deadline);
          }
        }
      } catch { result = "error"; }
      await bridge.finishWidgetPractice({requestId: request.requestId, result}).catch(() => {});
    }).catch(() => null);
    return () => { disposed = true; widgetCommands.current.clear(); void listener.then(h => h?.remove()); };
  }, []);
  const onSnapshot = useCallback((next: Snapshot | null, memberUserId: string | null) => {
    // Serialize projections, including a clear during auth transitions.
    // Widget failures must never interrupt the primary record/sync path.
    if (deviceSettings) {
      let summary: WidgetSummary | { ready: false } = { ready: false };
      let commands = new Map<string, WidgetPracticeCommand>();
      // Invalidate handles immediately on account/snapshot changes, not only
      // when the asynchronous native publication finishes.
      widgetCommands.current.clear();
      try {
        if (experimentalWidgetPractice && next) {
          const projection = buildWidgetActionProjection(next, memberUserId);
          summary = projection.summary ?? summary;
          commands = projection.commands;
        } else summary = buildWidgetSummary(next, memberUserId) ?? summary;
      } catch {}
      widgetCommands.current = commands;
      widgetQueue.current = widgetQueue.current.catch(() => {}).then(() => {
        if (widgetCommands.current !== commands) return;
        return deviceSettings.publishWidgetSummary(summary);
      }).catch(() => {});
    }
    // A null snapshot with no member identity is the initial/auth transition
    // loading state, not a verified sign-out. Keep prior alarms until a new
    // account's repository has actually hydrated.
    if (!next && !memberUserId) {
      snapshot.current = null; // never allow old account data to be rescheduled during auth hydration
      setHasHabitIntent(false);
      return;
    }
    const nextIdentity: ReminderIdentity = memberUserId
      ? { kind: "member", userId: memberUserId, verified: true }
      : identity;
    const switched = reminderIdentityKey(identityRef.current) !== reminderIdentityKey(nextIdentity);
    identityRef.current = nextIdentity;
    if (switched) {
      try {
        const loaded = readWrapupSettings(reminderIdentityKey(nextIdentity));
        wrapupRef.current = loaded;
        setWrapupSettings(loaded);
      } catch {
        // Do not silently erase old reservations on unreadable preferences.
        setStatus("마무리 알림 설정을 읽지 못했어요. 기기 저장소를 확인해 주세요.");
        return;
      }
    }
    snapshot.current = next;
    setHasHabitIntent(hasConfiguredHabitReminders(next));
    auditRevision.current += 1;
    setRepairAvailable(false);
    if (!mounted.current) return;
    if (!next) {
      // A verified member switch without a ready snapshot must revoke the
      // previous account's alarms. Later hydration can schedule its own.
      if (switched) void schedule(false, null).catch(() =>
        setStatus("계정 전환 중 이전 알림 예약을 정리하지 못했어요."));
      return;
    }
    // Reconcile member/guest scopes even when this device toggle is OFF.
    // No previous account can leave an active scoped reminder behind.
    void schedule(enabledRef.current, next).catch(() =>
      setStatus("알림 예약을 갱신하지 못했어요."));
  }, [schedule]);

  const dismissPermissionOffer = useCallback(() => {
    setPermissionOfferSeen(true);
    try { localStorage.setItem(PERMISSION_OFFER_SEEN_KEY, "1"); }
    catch { setStatus("알림 안내 선택을 기기에 저장하지 못했어요."); }
  }, []);

  // Asking for OS permission is not opting in to any habit or wrap-up alerts.
  // The user may accept the permission while keeping all individual alerts OFF.
  const onRequestPermission = useCallback(async (): Promise<boolean> => {
    if (!isAndroid || busyRef.current) return false;
    dismissPermissionOffer();
    busyRef.current = true;
    setBusy(true);
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "denied") {
        // The Android dialog might no longer be available. Open Settings only
        // because the user deliberately selected the permission action.
        try { await deviceSettings?.openNotificationSettings(); }
        catch { setStatus("휴대폰 설정 → 앱 → 별하루 → 알림에서 허용해 주세요."); }
        return false;
      }
      const result = current.display === "granted"
        ? current : await LocalNotifications.requestPermissions();
      setPermissionState(permissionStateFromAndroid(result.display));
      if (result.display !== "granted") {
        setStatus("알림을 허용하지 않아도 습관 기록은 계속 사용할 수 있어요.");
        return false;
      }
      setStatus("기기 알림이 허용됐어요. 습관별 알림은 별도로 선택해요.");
      if (snapshot.current) void schedule(enabledRef.current, snapshot.current).catch(() => {
        if (mounted.current) setStatus("알림 권한은 허용됐지만 예약은 확인하지 못했어요.");
      });
      return true;
    } catch {
      setStatus("알림 권한을 확인하지 못했어요. 앱 설정에서 다시 시도해 주세요.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [dismissPermissionOffer, schedule]);

  const onRequestExactPermission = useCallback(async (): Promise<boolean> => {
    if (!isAndroid || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const setting = await LocalNotifications.checkExactNotificationSetting();
      if (setting.exact_alarm !== "granted") {
        await LocalNotifications.changeExactNotificationSetting();
        setStatus("기기 설정에서 정확 알림을 허용해 주세요. 앱으로 돌아오면 예약을 갱신해요.");
      } else setExactPermission("granted");
      return true;
    } catch {
      setStatus("정확 알림 설정을 열 수 없어요. 기존 일반 알림은 유지돼요.");
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  }, []);

  const onInspectLatency = useCallback(async (): Promise<void> => {
    if (!deviceSettings) return;
    try {
      const scope = reminderIdentityKey(identityRef.current);
      const posts = await deviceSettings.getActiveReminderPosts();
      const result = measureReminderLatency(posts.posts, readReminderLedger(scope));
      setLatencyStatus(result.count
        ? `알림창에 남아 있는 ${result.count}건 · 평균 ${formatReminderDelay(result.meanMs)} · 최대 ${formatReminderDelay(result.maxMs)}. 닫힌 알림은 측정되지 않아요.`
        : "측정 가능한 알림이 없어요. 알림을 닫지 않은 상태로 다시 확인해 주세요.");
    } catch {
      setLatencyStatus("알림 게시 시각을 확인하지 못했어요. 기기 설정을 확인해 주세요.");
    }
  }, []);

  const onEnabledChange = useCallback(async (next: boolean): Promise<boolean> => {
    if (!lifecycle || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    auditRevision.current += 1;
    setRepairAvailable(false);
    try {
      if (next) {
        if (guestReminderAction(true, snapshot.current && {
          ...snapshot.current,
          timeZone: identityRef.current.kind === "member" ? snapshot.current.state.timezone : undefined,
        }) !== "sync") {
          setStatus("오늘 습관 기록을 준비한 후 다시 시도해 주세요.");
          return false;
        }
        // The toggle is visually OFF when Android denies permission even if
        // the user's previous opt-in remains saved. A new ON press may attempt
        // the runtime permission request, then open the *actual* Android app
        // settings if that system prompt is no longer available.
        let granted = false;
        try {
          const permission = await LocalNotifications.requestPermissions();
          granted = permission.display === "granted";
        } catch {
          // Some OS versions throw rather than return "denied" once
          // notifications have been blocked in the Android app settings.
        }
        setPermissionState(granted ? "granted" : "denied");
        if (!granted) {
          try {
            if (!deviceSettings) throw new Error("Android settings bridge unavailable");
            await deviceSettings.openNotificationSettings();
            setStatus("휴대폰 알림 설정에서 별하루 알림을 허용해 주세요.");
          } catch {
            setStatus("휴대폰 설정 → 앱 → 별하루 → 알림에서 허용해 주세요.");
          }
          return false;
        }
      }
      // On disable, clear pending reminders before persisting the opt-out.
      await schedule(next, snapshot.current);
      localStorage.setItem(OPT_IN_KEY, next ? "1" : "0");
      enabledRef.current = next;
      setEnabled(next);
      if (!next) setStatus("습관 알림을 껐어요.");
      return true;
    } catch {
      setStatus("알림 변경에 실패했습니다. 다시 시도해 주세요.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [schedule]);

  useEffect(() => {
    if (!isAndroid) return;
    let disposed = false;
    const emit = createResumeDispatcher(() => {
      if (!disposed) window.dispatchEvent(new Event("byeolharu:native-resume"));
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshPermission();
        emit();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    // Native onResume can fire when the WebView visibility state does not
    // transition; refresh the committed repository snapshot before scheduling.
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void refreshPermission();
        emit();
      }
    }).catch(() => {
      if (!disposed) setStatus("Android 앱 복귀 감지를 사용할 수 없어요.");
      return null;
    });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      void listener.then(handle => handle?.remove());
    };
  }, [refreshPermission]);

  const onWrapupChange = useCallback(async (
    group: WrapupGroup, patch: { enabled?: boolean; time?: string },
  ): Promise<boolean> => {
    if (!isAndroid || busyRef.current || !WRAPUP_GROUPS.includes(group)) return false;
    const original = wrapupRef.current;
    const next = normalizeWrapupSettings({
      ...original, [group]: { ...original[group], ...patch },
    }) as WrapupSettings;
    // A malformed time must never enable an unexpected alarm.
    if (patch.time !== undefined && next[group].time !== patch.time) return false;
    if (patch.enabled === true && !next[group].enabled) return false;
    const scope = reminderIdentityKey(identityRef.current);
    busyRef.current = true;
    setBusy(true);
    try {
      if (next[group].enabled) {
        let permission = await LocalNotifications.checkPermissions();
        if (permission.display !== "granted") permission = await LocalNotifications.requestPermissions();
        const granted = permission.display === "granted";
        setPermissionState(granted ? "granted" : "denied");
        if (!granted) {
          try { await deviceSettings?.openNotificationSettings(); }
          catch { /* Native settings bridge is optional; show manual instructions below. */ }
          setStatus("휴대폰 설정 → 앱 → 별하루 → 알림에서 허용해 주세요.");
          return false;
        }
      }
      if (hasEnabledWrapup(next) && !snapshot.current) {
        setStatus("오늘 습관 기록이 준비된 뒤 다시 켜주세요.");
        return false;
      }
      wrapupRef.current = next;
      try {
        await schedule(enabledRef.current, snapshot.current);
        if (scope !== reminderIdentityKey(identityRef.current)) throw Error("account changed");
        // Persist only after successful scheduling, per device and identity.
        localStorage.setItem(WRAPUP_STORAGE_KEY + scope, JSON.stringify(next));
        setWrapupSettings(next);
        setStatus("시간대 마무리 알림 설정을 저장했어요.");
        return true;
      } catch {
        wrapupRef.current = original;
        void schedule(enabledRef.current, snapshot.current).catch(() => {});
        setStatus("마무리 알림 설정에 실패했어요. 다시 시도해 주세요.");
        return false;
      }
    } catch {
      setStatus("Android 알림 설정을 확인하지 못했어요.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [schedule]);

  useEffect(() => {
    if (!isAndroid) return;
    let disposed = false;
    const listener = LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      const extra = notification.extra;
      if (disposed) return;
      const habitTarget = parseHabitReminder(extra);
      if (habitTarget) {
        // Do not compare against the initial guest placeholder: a cold launch
        // can receive a member tap before the verified repository hydrates.
        setHabitNavigation({ ...habitTarget, serial: ++habitNavigationSerial.current });
        return;
      }
      const group = extra?.timeGroup;
      if (!disposed && extra?.kind === REMINDER_KIND && extra?.category === "wrapup" &&
          extra?.scope === reminderIdentityKey(identityRef.current) &&
          WRAPUP_GROUPS.includes(group)) {
        setWrapupNavigation(prev => ({ tab: group as TimeGroup, serial: (prev?.serial ?? 0) + 1 }));
      }
    }).catch(() => null);
    return () => {
      disposed = true;
      void listener.then(handle => handle?.remove());
    };
  }, []);

  const onInspectPending = useCallback(async () => {
    if (!isAndroid || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const permission = await LocalNotifications.checkPermissions();
      setPermissionState(permissionStateFromAndroid(permission.display));
      const scope = reminderIdentityKey(identityRef.current);
      const pending = await LocalNotifications.getPending();
      if (scope !== reminderIdentityKey(identityRef.current)) return;
      const report = summarizeGuestPending(pending.notifications, new Date(), scope);
      const next = report.nextAt
        ? new Date(report.nextAt).toLocaleString("ko-KR", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})
        : "없음";
      const presentation = reminderPermissionPresentation({
        optIn: effectiveHabitReminderOptIn(enabledRef.current, snapshot.current),
        permission: permission.display,
        pendingCount: report.total,
      });
      setDiagnostic(permission.display !== "granted"
        ? presentation.headline + " · " + (presentation.queueNote ?? "예약 " + report.total + "건") +
          " · " + (effectiveHabitReminderOptIn(enabledRef.current, snapshot.current) ? "습관 알림 설정은 유지돼요." : "별하루 알림 사용은 꺼져 있어요.")
        : "Android 권한: 허용 · 예약 " + report.total + "건" +
          " · 오늘 남은 알림 " + report.todayRemaining + "건" +
          " · 다음 예약: " + next +
          (report.unknownTime ? " · 예약 시각 확인 불가 " + report.unknownTime + "건" : ""));
    } catch {
      setDiagnostic("예약을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const onAuditPending = useCallback(async () => {
    if (!isAndroid || busyRef.current || identityRef.current.kind !== "guest") return;
    busyRef.current = true;
    setBusy(true);
    const revision = ++auditRevision.current;
    setRepairAvailable(false);
    setRepairStatus("");
    try {
      // This is an observation only: no permission dialog, scheduling, or
      // mutations. The latest committed snapshot is the comparison source.
      const [permissions, queue] = await Promise.all([
        LocalNotifications.checkPermissions(),
        LocalNotifications.getPending(),
      ]);
      setPermissionState(permissionStateFromAndroid(permissions.display));
      const report = auditGuestReminders({
        snapshot: snapshot.current,
        optIn: effectiveHabitReminderOptIn(enabledRef.current, snapshot.current),
        wrapupSettings: wrapupRef.current,
        pending: queue.notifications,
        permission: permissions.display,
        now: new Date(),
      });
      const message = {
        disabled: "알림 사용이 꺼져 있고 대기 예약도 없어요.",
        "unexpected-pending": "알림을 껐지만 남은 예약이 있어요. 알림 끄기를 다시 적용해 주세요.",
        "permission-required": "Android 알림 권한이 필요해요. 기기 설정을 확인해 주세요.",
        "snapshot-not-ready": "오늘 습관 기록 로딩이 완료된 뒤 비교할 수 있어요.",
        synced: "습관 설정과 Android 예약이 일치해요.",
        "out-of-sync": "습관 설정과 Android 예약이 달라요. 앱을 다시 열어 갱신 상태를 확인해 주세요.",
      }[report.status] ?? "예약 상태를 확인할 수 없어요.";
      const counts = report.expectedCount === null
        ? "Android 실제 예약 " + report.actualCount + "건"
        : "예상 " + report.expectedCount + "건 · 실제 " + report.actualCount +
          "건 · 추가/변경 필요 " + report.missingCount + "건 · 취소 필요 " + report.staleCount + "건";
      if (revision === auditRevision.current) {
        setAuditStatus(message + " " + counts +
          (report.truncated ? " · 최대 예약 건수에 도달했어요." : ""));
        setRepairAvailable(canManuallyRepairGuestReminders(report, effectiveHabitReminderOptIn(enabledRef.current, snapshot.current) || hasEnabledWrapup(wrapupRef.current), permissions.display));
      }
    } catch {
      setAuditStatus("예약 비교에 실패했습니다. 습관 데이터와 기기 설정을 확인해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const onRepairPending = useCallback(async () => {
    if (!isAndroid || busyRef.current || !repairAvailable || identityRef.current.kind !== "guest") return;
    busyRef.current = true;
    setBusy(true);
    setRepairAvailable(false);
    setRepairStatus("");
    try {
      // Previous audit can become stale. The repair engine rechecks current
      // opt-in, today's committed snapshot, Android permission and pending.
      const result = await repairGuestReminders({
        localNotifications: LocalNotifications,
        snapshot: snapshot.current,
        optIn: effectiveHabitReminderOptIn(enabledRef.current, snapshot.current),
        wrapupSettings: wrapupRef.current,
        now: new Date(),
      });
      const message = {
        repaired: "알림 예약을 현재 습관 설정에 맞춰 갱신했어요.",
        "already-synced": "이미 습관 설정과 알림 예약이 일치해요.",
        disabled: "알림을 켠 후에 예약을 복구할 수 있어요.",
        "permission-required": "Android 알림 권한을 먼저 허용해 주세요.",
        "snapshot-not-ready": "오늘 습관 기록이 준비된 뒤 다시 시도해 주세요.",
      }[result.status] ?? "알림 복구 결과를 확인할 수 없어요.";
      setRepairStatus(message +
        ((result.status === "repaired") ? " 새 예약 " + result.added + "건 · 기존 예약 정리 " + result.cancelled + "건" : ""));
      // The audit may have changed while performing native writes.
      ++auditRevision.current;
      setAuditStatus("복구 후 예약을 다시 비교해 확인할 수 있어요.");
    } catch {
      setRepairStatus("예약 복구 중 오류가 발생했어요. 예약 비교 후 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [repairAvailable]);

  const nativeReminders: NativeReminderControls | undefined = isAndroid
    ? { exactPermission, onRequestExactPermission, latencyStatus, onInspectLatency,
        enabled: enabled === true || (enabled === null && hasHabitIntent), active: reminderSwitchChecked(enabled === true || (enabled === null && hasHabitIntent), permissionState), busy, status, permissionState, showPermissionOffer: shouldShowPermissionOffer({ permission: permissionState, seen: permissionOfferSeen, explicitlyDisabled: enabled === false }), onRequestPermission, onDismissPermissionOffer: dismissPermissionOffer, diagnostic, auditStatus, repairAvailable, repairStatus, wrapupSettings, onWrapupChange, onInspectPending, onAuditPending, onRepairPending, onEnabledChange, onSnapshot, registerWidgetPractice: experimentalWidgetPractice ? registerWidgetPractice : undefined }
    : undefined;
  return <Byeolharu nativeReminders={nativeReminders} nativeShare={isAndroid ? shareStarlightPngOnAndroid : undefined} nativeBackupExport={isAndroid ? exportGuestBackupOnAndroid : undefined} nativeAuthReturn={isAndroid ? nativeAuthReturn : undefined} nativeReminderNavigation={isAndroid ? wrapupNavigation : null} nativeHabitNavigation={isAndroid ? habitNavigation : null} />;
}

const root = document.getElementById("byeolharu-root");
if (!root) throw new Error("Byeolharu app root missing");
createRoot(root).render(<GuestNativeApp />);

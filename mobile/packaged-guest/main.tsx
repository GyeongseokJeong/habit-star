import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import Byeolharu from "../../components/byeolharu";
import { shareStarlightPngOnAndroid } from "./native-starlight-share";
import { exportGuestBackupOnAndroid } from "./native-guest-backup";
import type { Snapshot } from "../../lib/habits/repository";
import type { NativeReminderControls } from "../../lib/habits/native-reminder-controls";
import { createReminderLifecycle } from "../notifications/reminder-lifecycle.js";
import { guestReminderAction } from "../notifications/guest-reminder-readiness.js";
import { createResumeDispatcher } from "../notifications/native-resume-refresh.js";
import { summarizeGuestPending } from "../notifications/guest-reminder-diagnostics.js";
import { auditGuestReminders } from "../notifications/guest-reminder-audit.js";
import { repairGuestReminders } from "../notifications/guest-reminder-repair.js";
import { reminderPermissionPresentation } from "../notifications/guest-reminder-permission-view.js";
import { reminderSwitchChecked, canManuallyRepairGuestReminders } from "../notifications/guest-reminder-switch-state.js";


// This module is bundled into the isolated Android guest APK only.
// The website's Next.js entrypoint never imports Capacitor or native controls.
const OPT_IN_KEY = "byeolharu_android_guest_reminders_optin_v1";
const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const lifecycle = isAndroid ? createReminderLifecycle({ localNotifications: LocalNotifications }) : null;
const identity = { kind: "guest" as const, verified: true };
type ReminderIdentity =
  | { kind: "guest"; verified: true }
  | { kind: "member"; userId: string; verified: true };
const reminderIdentityKey = (value: ReminderIdentity) =>
  value.kind === "guest" ? "guest" : "member:" + value.userId;
type DeviceSettings = { openNotificationSettings: () => Promise<void> };
const deviceSettings = isAndroid ? registerPlugin<DeviceSettings>("ByeolharuDeviceSettings") : null;

function GuestNativeApp() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [permissionState, setPermissionState] = useState<"unknown" | "granted" | "denied">("unknown");
  const [diagnostic, setDiagnostic] = useState("");
  const [auditStatus, setAuditStatus] = useState("");
  const [repairAvailable, setRepairAvailable] = useState(false);
  const [repairStatus, setRepairStatus] = useState("");
  const auditRevision = useRef(0);
  const snapshot = useRef<Snapshot | null>(null);
  const identityRef = useRef<ReminderIdentity>(identity);
  const enabledRef = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const operation = useRef(Promise.resolve());
  useEffect(() => {
    // Mark the first committed React screen, not merely successful JS parsing.
    (window as Window & { __byeolharuStartupReady?: boolean }).__byeolharuStartupReady = true;
  }, []);

  const schedule = useCallback((value: boolean, next: Snapshot | null) => {
    if (!lifecycle) return Promise.resolve();
    const context = { identity: identityRef.current, optIn: value, snapshot: next && {
      day: next.day,
      habits: next.habits.map(h => ({ ...h, repeatDays: h.repeatDays ? [...h.repeatDays] : undefined })),
    }};
    const task = operation.current.then(async () => {
      if (!mounted.current) return;
      const action = guestReminderAction(value, context.snapshot);
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
      const result = await lifecycle.sync(context);
      if (mounted.current) {
        if (result.status === "permission-required") setStatus("Android 알림 권한을 확인해 주세요.");
        else if (result.status === "snapshot-not-ready") setStatus("오늘 기록을 불러온 후 다시 확인해 주세요.");
        else if (result.status === "updated" || result.status === "unchanged") setStatus("습관 알림이 설정되었어요.");
        else if (result.status === "disabled") setStatus("");
      }
    });
    operation.current = task.catch(() => {});
    return task;
  }, []);

  const refreshPermission = useCallback(async () => {
    if (!isAndroid) return;
    try {
      const current = await LocalNotifications.checkPermissions();
      if (mounted.current) {
        const granted = current.display === "granted";
        setPermissionState(granted ? "granted" : "denied");
        if (!granted) setRepairAvailable(false);
      }
    } catch {
      if (mounted.current) setPermissionState("unknown");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshPermission();
    // A previously enabled device setting may survive a process restart.
    // Restore it only in this isolated package; never ask permissions here.
    try {
      const saved = localStorage.getItem(OPT_IN_KEY) === "1";
      enabledRef.current = saved;
      setEnabled(saved);
      // When enabled, wait for the repository to hydrate before reconciliation.
      // Explicitly disabled users still have old owned alarms cleaned up.
      if (!saved) void schedule(false, null).catch(() => setStatus("알림을 확인하지 못했어요."));
      // React child effects may provide an already-hydrated snapshot before
      // this parent effect restores the device preference. Never miss it.
      else if (snapshot.current) {
        void schedule(true, snapshot.current).catch(() => setStatus("알림을 확인하지 못했어요."));
      }
    } catch {
      // An unreadable preference is not proof of opt-out. Preserve the
      // native queue and ask the user to review settings rather than delete.
      setStatus("알림 설정을 읽지 못했어요. 기기 저장 공간을 확인해 주세요.");
    }
    return () => { mounted.current = false; };
  }, [schedule, refreshPermission]);

  const onSnapshot = useCallback((next: Snapshot | null, memberUserId: string | null) => {
    // A null snapshot with no member identity is the initial/auth transition
    // loading state, not a verified sign-out. Keep prior alarms until a new
    // account's repository has actually hydrated.
    if (!next && !memberUserId) return;
    const nextIdentity: ReminderIdentity = memberUserId
      ? { kind: "member", userId: memberUserId, verified: true }
      : identity;
    const switched = reminderIdentityKey(identityRef.current) !== reminderIdentityKey(nextIdentity);
    identityRef.current = nextIdentity;
    snapshot.current = next;
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

  const onEnabledChange = useCallback(async (next: boolean) => {
    if (!lifecycle || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    auditRevision.current += 1;
    setRepairAvailable(false);
    try {
      if (next) {
        if (guestReminderAction(true, snapshot.current) !== "sync") {
          setStatus("오늘 습관 기록을 준비한 후 다시 시도해 주세요.");
          return;
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
          return;
        }
      }
      // On disable, clear pending reminders before persisting the opt-out.
      await schedule(next, snapshot.current);
      localStorage.setItem(OPT_IN_KEY, next ? "1" : "0");
      enabledRef.current = next;
      setEnabled(next);
      if (!next) setStatus("습관 알림을 껐어요.");
    } catch {
      setStatus("알림 변경에 실패했습니다. 다시 시도해 주세요.");
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

  const onInspectPending = useCallback(async () => {
    if (!isAndroid || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const permission = await LocalNotifications.checkPermissions();
      setPermissionState(permission.display === "granted" ? "granted" : "denied");
      const pending = await LocalNotifications.getPending();
      const report = summarizeGuestPending(pending.notifications, new Date());
      const next = report.nextAt
        ? new Date(report.nextAt).toLocaleString("ko-KR", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})
        : "없음";
      const presentation = reminderPermissionPresentation({
        optIn: enabledRef.current,
        permission: permission.display,
        pendingCount: report.total,
      });
      setDiagnostic(permission.display !== "granted"
        ? presentation.headline + " · " + (presentation.queueNote ?? "예약 " + report.total + "건") +
          " · " + (enabledRef.current ? "알림 사용 설정은 유지돼요." : "별하루 알림 사용은 꺼져 있어요.")
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
      setPermissionState(permissions.display === "granted" ? "granted" : "denied");
      const report = auditGuestReminders({
        snapshot: snapshot.current,
        optIn: enabledRef.current,
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
        setRepairAvailable(canManuallyRepairGuestReminders(report, enabledRef.current, permissions.display));
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
        optIn: enabledRef.current,
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
    ? { enabled, active: reminderSwitchChecked(enabled, permissionState), busy, status, permissionState, diagnostic, auditStatus, repairAvailable, repairStatus, onInspectPending, onAuditPending, onRepairPending, onEnabledChange, onSnapshot }
    : undefined;
  return <Byeolharu nativeReminders={nativeReminders} nativeShare={isAndroid ? shareStarlightPngOnAndroid : undefined} nativeBackupExport={isAndroid ? exportGuestBackupOnAndroid : undefined} />;
}

const root = document.getElementById("byeolharu-root");
if (!root) throw new Error("Byeolharu app root missing");
createRoot(root).render(<GuestNativeApp />);

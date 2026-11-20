import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import Byeolharu from "../../components/byeolharu";
import type { Snapshot } from "../../lib/habits/repository";
import type { NativeReminderControls } from "../../lib/habits/native-reminder-controls";
import { createReminderLifecycle } from "../notifications/reminder-lifecycle.js";
import { guestReminderAction } from "../notifications/guest-reminder-readiness.js";
import { createResumeDispatcher } from "../notifications/native-resume-refresh.js";
import { summarizeGuestPending } from "../notifications/guest-reminder-diagnostics.js";
import { auditGuestReminders } from "../notifications/guest-reminder-audit.js";

// This module is bundled into the isolated Android guest APK only.
// The website's Next.js entrypoint never imports Capacitor or native controls.
const OPT_IN_KEY = "byeolharu_android_guest_reminders_optin_v1";
const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const lifecycle = isAndroid ? createReminderLifecycle({ localNotifications: LocalNotifications }) : null;
const identity = { kind: "guest" as const, verified: true };

function GuestNativeApp() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [auditStatus, setAuditStatus] = useState("");
  const snapshot = useRef<Snapshot | null>(null);
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
    const context = { identity, optIn: value, snapshot: next && {
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

  useEffect(() => {
    mounted.current = true;
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
  }, [schedule]);

  const onSnapshot = useCallback((next: Snapshot | null) => {
    snapshot.current = next;
    // React's committed snapshot is the only scheduling source.
    if (mounted.current && enabledRef.current) {
      void schedule(true, next).catch(() => setStatus("알림 예약을 갱신하지 못했어요."));
    }
  }, [schedule]);

  const onEnabledChange = useCallback(async (next: boolean) => {
    if (!lifecycle || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (next) {
        if (guestReminderAction(true, snapshot.current) !== "sync") {
          setStatus("오늘 습관 기록을 준비한 후 다시 시도해 주세요.");
          return;
        }
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== "granted") {
          setStatus("휴대폰 설정에서 알림 권한을 허용해 주세요.");
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
      if (document.visibilityState === "visible") emit();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Native onResume can fire when the WebView visibility state does not
    // transition; refresh the committed repository snapshot before scheduling.
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) emit();
    }).catch(() => {
      if (!disposed) setStatus("Android 앱 복귀 감지를 사용할 수 없어요.");
      return null;
    });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      void listener.then(handle => handle?.remove());
    };
  }, []);

  const onInspectPending = useCallback(async () => {
    if (!isAndroid || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const permission = await LocalNotifications.checkPermissions();
      const pending = await LocalNotifications.getPending();
      const report = summarizeGuestPending(pending.notifications, new Date());
      const next = report.nextAt
        ? new Date(report.nextAt).toLocaleString("ko-KR", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})
        : "없음";
      setDiagnostic(
        "Android 권한: " + (permission.display === "granted" ? "허용" : "미허용") +
        " · 예약 " + report.total + "건" +
        " · 오늘 남은 알림 " + report.todayRemaining + "건" +
        " · 다음 예약: " + next +
        (report.unknownTime ? " · 예약 시각 확인 불가 " + report.unknownTime + "건" : ""),
      );
    } catch {
      setDiagnostic("예약을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const onAuditPending = useCallback(async () => {
    if (!isAndroid || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // This is an observation only: no permission dialog, scheduling, or
      // mutations. The latest committed snapshot is the comparison source.
      const [permissions, queue] = await Promise.all([
        LocalNotifications.checkPermissions(),
        LocalNotifications.getPending(),
      ]);
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
      setAuditStatus(message + " " + counts +
        (report.truncated ? " · 최대 예약 건수에 도달했어요." : ""));
    } catch {
      setAuditStatus("예약 비교에 실패했습니다. 습관 데이터와 기기 설정을 확인해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const nativeReminders: NativeReminderControls | undefined = isAndroid
    ? { enabled, busy, status, diagnostic, auditStatus, onInspectPending, onAuditPending, onEnabledChange, onSnapshot }
    : undefined;
  return <Byeolharu nativeReminders={nativeReminders} />;
}

const root = document.getElementById("byeolharu-root");
if (!root) throw new Error("Byeolharu app root missing");
createRoot(root).render(<GuestNativeApp />);

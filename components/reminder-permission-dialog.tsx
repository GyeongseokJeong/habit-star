"use client";

import { useEffect, useRef, useState } from "react";
import type { DisplayPermissionState, ReminderPermissionOffer } from "@/lib/habits/native-reminder-controls";
import { ConfirmDialog } from "@/components/confirm-dialog";

/** One shared confirmation surface; no native call on mount or dismissal. */
export function ReminderPermissionDialog({ kind, permissionState, restored = false, exactOptionAvailable = false, busy, onCancel, onConfirm }: {
  kind: ReminderPermissionOffer;
  permissionState: DisplayPermissionState;
  restored?: boolean;
  exactOptionAvailable?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const exact = kind === "exact";
  return <ConfirmDialog
    title={exact ? "더 정확한 시간에 알려드릴까요?" : "습관 알림을 받아볼까요?"}
    description={exact ? "정확 알림을 허용하면 설정한 시간에 더 가깝게 알림을 받을 수 있어요. 나중에 해도 일반 알림은 받을 수 있어요." : restored
      ? "저장된 습관 알림을 이 기기에서도 받으려면 알림 권한이 필요해요. 나중에 해도 기록은 그대로 사용할 수 있어요." +
        (exactOptionAvailable ? " 일반 알림을 허용한 뒤 앱 설정에서 정확 알림도 선택할 수 있어요." : "")
      : "설정한 시간에 실천을 알려드려요. 알림을 허용하지 않아도 습관 기록은 계속 사용할 수 있어요."}
    cancelLabel="나중에"
    confirmLabel={exact ? "정확 알림 설정" : permissionState === "denied" ? "기기 설정 열기" : "알림 허용하기"}
    confirmTone="neutral"
    primaryAction="confirm"
    icon="bell"
    busy={busy}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />;
}

/** Await an explicit choice, including Back/Escape/outside tap. A dismissal
 * never performs a permission call; a second tap cannot start another one. */
export function useReminderPermissionGuide() {
  const [offer, setOffer] = useState<{ kind: ReminderPermissionOffer; permissionState: DisplayPermissionState } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: (accepted: boolean) => void; request: () => Promise<boolean>; dismiss?: () => void } | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => {
    pending.current?.resolve(false);
    pending.current = null;
    busyRef.current = false;
  }, []);
  const settle = (accepted: boolean) => {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    busyRef.current = false;
    setBusy(false);
    setOffer(null);
    current.resolve(accepted);
  };
  const ask = (kind: ReminderPermissionOffer, permissionState: DisplayPermissionState,
    request: () => Promise<boolean>, dismiss?: () => void) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      pending.current = { resolve, request, dismiss };
      setOffer({ kind, permissionState });
    });
  };
  const dialog = offer && <ReminderPermissionDialog
    {...offer}
    busy={busy}
    onCancel={() => {
      if (busyRef.current) return;
      try { pending.current?.dismiss?.(); } finally { settle(false); }
    }}
    onConfirm={() => {
      if (!pending.current || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const current = pending.current;
      void (async () => {
        let accepted = false;
        try { accepted = await current.request(); } catch { /* retry after another deliberate action */ }
        if (pending.current === current) settle(accepted);
      })();
    }}
  />;
  return { ask, dialog };
}

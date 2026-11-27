"use client";

import { useEffect, useRef, useState } from "react";
import type { ReminderPermissionStates, ReminderPermissionScope } from "@/lib/habits/native-reminder-controls";
import { ConfirmDialog } from "@/components/confirm-dialog";

/** One shared confirmation surface; no native call on mount or dismissal. */
export function ReminderPermissionDialog({ permissionState, exactPermission, busy, onCancel, onConfirm }: ReminderPermissionStates & {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const exactOnly = permissionState === "granted";
  return <ConfirmDialog
    title="습관 알림을 설정할까요?"
    description={exactOnly
      ? "설정한 시간에 더 가깝게 알림을 받을 수 있도록 휴대폰 권한을 설정해 주세요. 나중에 해도 알림은 받을 수 있어요."
      : "설정한 시간에 가깝게 습관 알림을 받을 수 있도록 휴대폰 권한을 설정해 주세요." +
        (exactPermission !== "granted" ? " 알림 허용 후 기기 설정 화면이 이어질 수 있어요." : "")}
    cancelLabel="나중에"
    confirmLabel="알림 설정하기"
    confirmTone="neutral"
    primaryAction="confirm"
    initialFocus="heading"
    icon="bell"
    busy={busy}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />;
}

/** Await an explicit choice, including Back/Escape/outside tap. A dismissal
 * never performs a permission call; a second tap cannot start another one. */
export function useReminderPermissionGuide() {
  const [offer, setOffer] = useState<ReminderPermissionStates | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: (accepted: boolean) => void; request: (isCurrent: ReminderPermissionScope) => Promise<boolean>; dismiss?: () => void } | null>(null);
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
  const ask = (permissions: ReminderPermissionStates,
    request: (isCurrent: ReminderPermissionScope) => Promise<boolean>, dismiss?: () => void) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      pending.current = { resolve, request, dismiss };
      setOffer(permissions);
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
        try { accepted = await current.request(() => pending.current === current); } catch { /* retry after another deliberate action */ }
        if (pending.current === current) settle(accepted);
      })();
    }}
  />;
  return { ask, dialog };
}

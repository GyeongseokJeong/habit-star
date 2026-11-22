"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CloudOff, RefreshCw, X } from "lucide-react";
import {
  resolveSyncNotice,
  TRANSIENT_NOTICE_DELAY_MS,
  TRANSIENT_NOTICE_VISIBLE_MS,
  TRANSIENT_NOTICE_SUPPRESS_MS,
} from "@/lib/habits/sync-notice-policy";

/** The card is purely presentational: the underlying outbox/error is never cleared. */
export function SyncNotice({
  error,
  storageWarning,
  scope,
  onRetry,
  onOpenLogin,
  onOpenRecords,
}: {
  error: string;
  storageWarning: boolean;
  scope: string;
  onRetry: () => Promise<void>;
  onOpenLogin: () => void;
  onOpenRecords: () => void;
}) {
  const notice = resolveSyncNotice(error, storageWarning);
  const [visible, setVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const lastShown = useRef<{ key: string; at: number } | null>(null);
  const key = scope + ":" + (notice?.kind ?? "") + ":" + error;

  useEffect(() => {
    if (!notice) {
      setVisible(false);
      return;
    }
    if (!notice.autoDismiss) {
      setVisible(true);
      return;
    }
    const last = lastShown.current;
    if (last?.key === key && Date.now() - last.at < TRANSIENT_NOTICE_SUPPRESS_MS) {
      setVisible(false);
      return;
    }
    setVisible(false);
    // One brief failure can recover on the next automatic sync; avoid a flash.
    const timer = setTimeout(() => {
      lastShown.current = { key, at: Date.now() };
      setVisible(true);
    }, TRANSIENT_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, notice?.kind, notice?.autoDismiss]);

  useEffect(() => {
    if (!visible || !notice?.autoDismiss) return;
    const timer = setTimeout(() => setVisible(false), TRANSIENT_NOTICE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, notice?.kind, notice?.autoDismiss]);

  if (!visible || !notice) return null;
  const critical = !notice.autoDismiss;
  const Icon = critical ? AlertCircle : CloudOff;

  const handleAction = () => {
    if (notice.action === "login") { onOpenLogin(); return; }
    if (notice.action === "records") { onOpenRecords(); return; }
    if (retrying) return;
    setRetrying(true);
    void onRetry().catch(() => {
      // The application's error remains available in Data Management.
    }).finally(() => setRetrying(false));
  };

  return (
    <aside className={"sync-notice" + (critical ? " sync-notice-critical" : "")}
      role={critical ? "alert" : "status"} aria-live={critical ? "assertive" : "polite"}
      aria-label={critical ? "기록 상태 안내" : "동기화 상태 안내"}>
      <div className="sync-notice-content">
        <span className="sync-notice-symbol" aria-hidden="true"><Icon size={18} /></span>
        <div className="sync-notice-copy">
          <strong>{notice.title}</strong>
          <p>{notice.description}</p>
        </div>
        <button type="button" className="sync-notice-dismiss" aria-label="안내 닫기"
          onClick={() => setVisible(false)}><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="sync-notice-actions">
        <button type="button" className="sync-notice-primary" onClick={handleAction}
          disabled={retrying} aria-busy={retrying}>
          {notice.action === "retry"
            ? <><RefreshCw size={15} className={retrying ? "is-spinning" : ""} aria-hidden="true" />{retrying ? "동기화 중…" : "다시 시도"}</>
            : notice.action === "login" ? "로그인 확인" : "기록 확인"}
        </button>
      </div>
    </aside>
  );
}

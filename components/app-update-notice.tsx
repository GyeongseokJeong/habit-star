"use client";

import { ArrowDownToLine } from "lucide-react";
import { updateActionLabel, updateStatusLabel, type NativeUpdateControls } from "@/lib/habits/native-app-update";

export function AppUpdateNotice({ update }: { update: NativeUpdateControls }) {
  return (
    <section className="app-update-notice" aria-label="앱 업데이트 안내">
      <div className="app-update-message">
        <ArrowDownToLine size={19} aria-hidden="true" />
        <span role="status">{updateStatusLabel(update.info, update.error)}</span>
      </div>
      <div className="app-update-actions">
        <button type="button" className="app-update-later" disabled={update.busy} onClick={update.dismiss}>나중에</button>
        <button type="button" className="primary" disabled={update.busy} onClick={update.act}>{updateActionLabel(update.info.status)}</button>
      </div>
    </section>
  );
}

export function AppUpdateSettings({ update, blocked }: { update: NativeUpdateControls; blocked: boolean }) {
  return (
    <div className="app-update-settings">
      <div>
        <strong>앱 업데이트</strong>
        <small role="status">{updateStatusLabel(update.info, update.error)}</small>
      </div>
      <button type="button" className="secondary"
        disabled={blocked || update.busy || update.info.status === "downloading" || update.info.status === "checking"}
        aria-busy={update.busy} onClick={update.act}>{updateActionLabel(update.info.status)}</button>
    </div>
  );
}

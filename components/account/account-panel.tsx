"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ChevronRight, CheckCircle2, CloudOff,
  Database, Download, RefreshCw, Settings2, ShieldCheck, Sparkles, UserRound, CircleHelp,
  AlertCircle, Clock3, Laptop, Moon, Sun, Sunrise, MonitorSmartphone, LoaderCircle, Star, Cloud, LogOut, BellRing,
} from "lucide-react";
import { cloudEnabled } from "@/lib/supabase/client";
import { APP_BUILD_INFO } from "@/lib/build-info";
import { inspectPortableBackup, MAX_GUEST_BACKUP_BYTES } from "@/lib/habits/backup-file";
import type { useHabitApp } from "@/lib/habits/use-habit-app";
import type { Snapshot } from "@/lib/habits/repository";
import type { NativeReminderControls, WrapupGroup } from "@/lib/habits/native-reminder-controls";
import { AuthForm, type AuthMode } from "./auth-form";
import { AccountSectionTitle } from "./account-design";
import type { ThemePreference } from "@/lib/theme-preference";

const wrapupPeriods: { group: WrapupGroup; name: string; range: string; times: string[] }[] = [
  { group: "morning", name: "아침", range: "05:00~10:59", times: ["09:30","10:00","10:30"] },
  { group: "day", name: "낮", range: "11:00~16:59", times: ["15:30","16:00","16:30"] },
  { group: "night", name: "밤", range: "17:00~다음 날 04:59", times: ["21:00","21:30","22:00","22:30"] },
];
type App = ReturnType<typeof useHabitApp>;
export type AccountPage = "home" | "records" | "import" | "settings" | "help" | "security" | AuthMode;

const zoneLabels: Record<string, string> = {
  "Asia/Seoul": "한국 · 서울",
  "Asia/Tokyo": "일본 · 도쿄",
  "Asia/Shanghai": "중국 · 상하이",
  "Asia/Singapore": "싱가포르",
  "Asia/Hong_Kong": "홍콩",
  "America/New_York": "미국 · 뉴욕",
  "America/Los_Angeles": "미국 · 로스앤젤레스",
  "Europe/London": "영국 · 런던",
  "Europe/Paris": "프랑스 · 파리",
  "Australia/Sydney": "호주 · 시드니",
};
function zoneName(zone: string) {
  return zoneLabels[zone] ?? zone.split("/").slice(1).join(" · ").replaceAll("_", " ") + " (" + zone + ")";
}
function guestHasOwnRecords(guest: Snapshot) {
  const raw = guest.state.migration?.backup.raw;
  return Boolean(
    guest.state.hasUserEdits ||
    guest.state.demoConfirmedDailyEntryKeys?.length ||
    (raw && ["byeolharu_v1_habits", "byeolharu_v1_history"].some((key) => {
      const value = raw[key];
      if (!value) return false;
      try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed)
          ? parsed.length > 0
          : Boolean(parsed && typeof parsed === "object" && Object.keys(parsed).length);
      } catch {
        // Corrupt legacy data is recovered through the existing backup flow.
        return false;
      }
    })),
  );
}

export function AccountPanel({
  app, page, onNavigate, theme, onThemeChange, compactView, onCompactViewChange, onInstall, nativeReminders, nativeBackup,
}: {
  app: App;
  page: AccountPage;
  onNavigate: (next: AccountPage) => void;
  theme: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
  compactView: boolean;
  onCompactViewChange: (enabled: boolean) => void;
  onInstall?: () => void;
  nativeReminders?: NativeReminderControls;
  nativeBackup?: boolean;
}) {
  const state = app.snapshot?.state;
  const [message, setMessage] = useState("");
  const [showImportReceipt, setShowImportReceipt] = useState(false);
  const observedReceipt = useRef(app.snapshot?.state.importReceipt?.verifiedAt ?? null);
  const [backupBusy, setBackupBusy] = useState(false);
  const activeAction = useRef<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [guestAvailable, setGuestAvailable] = useState(false);
  const [timezonePicker, setTimezonePicker] = useState(false);
  const [zoneQuery, setZoneQuery] = useState("");
  const [changingZone, setChangingZone] = useState(false);
  const deviceZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul"; }
    catch { return "Asia/Seoul"; }
  }, []);
  const allZones = useMemo(() => {
    const available = typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone") : [];
    return [...new Set([deviceZone, state?.timezone ?? deviceZone, ...Object.keys(zoneLabels), ...available])];
  }, [deviceZone, state?.timezone]);
  const matchingZones = allZones.filter((zone) =>
    (zone + " " + zoneName(zone)).toLocaleLowerCase().includes(zoneQuery.toLocaleLowerCase()),
  ).slice(0, 28);
  const conflicts = state?.conflicts.filter((conflict) => !conflict.resolved) ?? [];
  const unresolved = conflicts.length;
  const pending = state?.outbox.length ?? 0;
  const status = app.user ? app.status : "이 기기에 기록 저장 중";
  const critical = Boolean(app.error || unresolved || state?.importJournal || /실패|만료|충돌/.test(status));
  const syncing = app.user && /동기화 중/.test(status);
  const waiting = app.user && (pending > 0 || /대기/.test(status));
  const statusTone = critical ? "error" : syncing ? "syncing" : waiting ? "waiting" : "success";
  const StatusIcon = critical ? AlertCircle : syncing ? LoaderCircle : waiting ? CloudOff : CheckCircle2;
  // Only show a fresh verification receipt. Old receipts remain in the data
  // model without displaying a repeated success note on every visit.
  useEffect(() => {
    const verifiedAt = state?.importReceipt?.verifiedAt ?? null;
    if (verifiedAt && verifiedAt !== observedReceipt.current && !state?.importJournal) {
      setShowImportReceipt(true);
    }
    observedReceipt.current = verifiedAt;
    if (verifiedAt && !state?.importJournal) setPreview(null);
  }, [state?.importReceipt?.verifiedAt, state?.importJournal]);
  useEffect(() => {
    if ((page !== "home" && page !== "records" && page !== "import") || !app.user) {
      setGuestAvailable(false);
      return;
    }
    let mounted = true;
    void app.previewImport().then((guest) => {
      if (mounted) {
        setGuestAvailable(guestHasOwnRecords(guest));
      }
    }).catch(() => {
      if (mounted) setGuestAvailable(false);
    });
    return () => { mounted = false; };
    // The member identity and destination, not a changing callback identity, gate the scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, app.user?.id]);

  useEffect(() => {
    if (page !== "import" || !app.user) return;
    let mounted = true;
    setPreview(null);
    void app.previewImport().then((guest) => {
      if (mounted) setPreview(guest);
    }).catch(() => {
      if (mounted) setMessage("비회원 기록을 읽지 못했어요. 백업을 확인해주세요.");
    });
    return () => { mounted = false; };
    // Re-read only on entering the dedicated flow or switching identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, app.user?.id]);
  // A ref prevents double taps before React can paint the disabled state.
  const runOnce = async (name: string, task: () => Promise<void>) => {
    if (activeAction.current || app.busy) return;
    activeAction.current = name;
    setWorkingAction(name);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업을 완료하지 못했어요. 다시 시도해주세요.");
    } finally {
      activeAction.current = null;
      setWorkingAction(null);
    }
  };

  const lastSyncAt = state?.sync?.lastSuccessAt
    ? new Date(state.sync.lastSuccessAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const navigate = (to: AccountPage) => {
    if (to !== "records" || page !== "import") setShowImportReceipt(false);
    setMessage("");
    setPreview(null);
    setTimezonePicker(false);
    setZoneQuery("");
    onNavigate(to);
  };
  const setTimezone = async (zone: string) => {
    if (!app.user || app.busy || changingZone || zone === state?.timezone) return;
    setChangingZone(true);
    setMessage("");
    try {
      await app.changeTimezone(zone);
      setTimezonePicker(false);
      setMessage("시간대를 변경했어요. 이전 기록의 날짜는 유지됩니다.");
    } catch {
      setMessage("시간대를 변경하지 못했어요. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setChangingZone(false);
    }
  };
  const exportBackup = async () => {
    if (backupBusy || app.busy) return;
    setBackupBusy(true);
    setMessage("");
    try {
      await app.backup();
      if (nativeBackup) setMessage("파일을 저장할 앱을 선택한 뒤, 실제로 저장되었는지 확인해주세요. 공유창을 열기만 해서는 백업이 완료되지 않습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "기록 백업에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setBackupBusy(false);
    }
  };
  const restoreBackup = async (file: File | undefined) => {
    if (!file || backupBusy || app.busy) return;
    setMessage("");
    setBackupBusy(true);
    try {
      if (nativeBackup) {
        if (!file.name.toLowerCase().endsWith(".json") || file.size > MAX_GUEST_BACKUP_BYTES || !file.size) {
          throw Error("25MB 이하의 별하루 JSON 백업 파일을 선택해주세요.");
        }
      }
      const content = await file.text();
      if (nativeBackup) {
        const expectedScope = app.user ? "member:" + app.user.id : "guest";
        const { habitCount, entryCount } = inspectPortableBackup(content, expectedScope);
        const confirmText = `${app.user ? "현재 회원 계정" : "비회원"} 백업을 복원할까요?\n습관 ${habitCount}개 · 기록 ${entryCount}개\n현재 기기에 기록이 있다면 복원되지 않으며, 원본은 삭제되지 않습니다.`;
        if (!window.confirm(confirmText)) return;
      }
      await app.restore(content);
      setMessage("백업을 복원했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "복원 실패");
    } finally {
      setBackupBusy(false);
    }
  };

  const importPreview = preview ? (
    <div className="account-import-preview">
                  <h4>기록 이전 확인</h4>
                  <p>대상 계정: {app.user?.email ?? "로그인 계정"}</p>
                  <p>현재 습관 {preview.habits.length}개 · 날짜 {Object.keys(preview.history).length}개 · 기록 {Object.values(preview.history).reduce((n,h)=>n+h.length,0)}개</p>
                  <p>원본은 보존하고 같은 ID의 다른 내용은 충돌로 남깁니다.</p>
                  {!!preview.state.migration?.issues.length && !preview.state.recoveryAcknowledged && (
                    <p role="alert">복구 확인이 필요한 항목 {preview.state.migration.issues.length}개가 있습니다. 비회원 모드에서 백업·확인한 후 이전해주세요.</p>
                  )}
                  <div className="account-compact-actions">
                    <button type="button" className="primary" disabled={app.busy || workingAction !== null || (!!preview.state.migration?.issues.length && !preview.state.recoveryAcknowledged)} aria-busy={workingAction === "import"} onClick={() => void runOnce("import", async () => {
                      const result = await app.migrate();
                      if (result?.status === "applied") setPreview(null);
                      if (page === "import" && result) navigate("records");
                    })}>{workingAction === "import" ? "가져오는 중…" : "이 계정으로 병합"}</button>
                    <button type="button" className="text-button" onClick={() => page === "import" ? navigate("home") : setPreview(null)}>나중에</button>
                  </div>
                </div>
  ) : null;

  if (page === "login" || page === "signup" || page === "reset") {
    return <div className="account-panel">
      <AuthForm key={page} mode={page} onModeChange={(next: AuthMode) => navigate(next)} onAuthenticated={() => navigate("home")} />
    </div>;
  }
  return (
    <div className="account-panel account-hub">
      {page === "home" && (
        <>
          <div className="account-hero">
            <span className="account-hero-icon"><Sparkles size={24} aria-hidden="true" /></span>
            <div className="account-hero-text">
              <strong>{app.user ? "별하루 회원" : "나의 별하루"}</strong>
              <span>{app.user ? app.user.email : "비회원으로 사용 중"}</span>
            </div>
          </div>
          <div className={"account-status-line is-" + statusTone} role={critical ? "alert" : "status"} aria-live={critical ? "assertive" : "polite"}>
            <StatusIcon size={18} aria-hidden="true" className={syncing ? "is-spinning" : ""}/>
            <span>{app.error || status}</span>
            {critical && <button type="button" onClick={() => navigate("records")}>상태 확인</button>}
          </div>
          {app.user && guestAvailable && !state?.importReceipt && !state?.importJournal && (
            <button type="button" className="account-import-prompt" onClick={() => navigate("import")}>
              <Database size={18} aria-hidden="true" /><span>남아 있는 비회원 기록<small>확인 후 내 계정으로 가져오기</small></span><ChevronRight size={17} aria-hidden="true"/>
            </button>
          )}
          {!app.user && cloudEnabled() && (
            <div className="account-entry">
              <button type="button" className="account-login-action" onClick={() => navigate("login")}>로그인</button>
              <button type="button" className="account-signup-link" onClick={() => navigate("signup")}>회원가입</button>
            </div>
          )}
          {!app.user && !cloudEnabled() && <p className="account-note">클라우드 연결이 아직 설정되지 않았습니다. 비회원 기록은 계속 사용할 수 있어요.</p>}
          <nav className="account-menu" aria-label="계정 메뉴">
            <button type="button" aria-label="데이터 관리" onClick={() => navigate("records")}><Database size={19} /><span>데이터 관리<small>동기화 · 백업 · 복원</small></span><ChevronRight size={17} /></button>
            <button type="button" aria-label="앱 설정" onClick={() => navigate("settings")}><Settings2 size={19} /><span>앱 설정<small>{nativeReminders ? "알림 · 화면 · 기록" : "테마 · 간편 보기 · 시간대"}</small></span><ChevronRight size={17} /></button>
            {app.user && <button type="button" aria-label="계정 관리" onClick={() => navigate("security")}><UserRound size={19} /><span>계정 관리<small>로그인 정보 · 로그아웃</small></span><ChevronRight size={17} /></button>}
            <button type="button" aria-label="사용 안내" onClick={() => navigate("help")}><CircleHelp size={19} /><span>사용 안내<small>기록 · 성장 · 데이터 보관</small></span><ChevronRight size={17} /></button>
          </nav>
        </>
      )}

      {page === "records" && (
        <section className="account-detail" aria-label="데이터 관리">
          <div className={"account-ui-card account-ui-status-card account-sync-overview is-" + statusTone} role={critical ? "alert" : "status"} aria-live={critical ? "assertive" : "polite"}>
            <div className="account-sync-heading">
              <StatusIcon size={20} aria-hidden="true" className={syncing ? "is-spinning" : ""}/>
              <strong>{app.user ? (app.error || status) : "이 기기에 기록을 저장하고 있어요"}</strong>
            </div>
            <p>{app.user ? "기기 기록 보관 중" : "기기 저장 · 비회원 모드"}</p>
            {app.user && <div className="account-sync-footer">
              <span>마지막 성공 · {lastSyncAt ?? "아직 없음"}</span>
              <button type="button" className="secondary" disabled={app.busy || workingAction !== null} aria-busy={workingAction === "sync"} onClick={() => void runOnce("sync", async () => { await app.sync(); })} aria-label="지금 동기화"><RefreshCw size={16} className={workingAction === "sync" ? "is-spinning" : ""} aria-hidden="true" />{workingAction === "sync" ? "동기화 중…" : "지금 동기화"}</button>
            </div>}
          </div>
          {(pending > 0 || unresolved > 0 || state?.importJournal) && (
            <p className="account-sync-alert" role="alert">{pending > 0 ? "미전송 기록 " + pending + "개 · 기기 보존 중" : ""}
              {unresolved > 0 ? " · 확인할 기록 충돌 " + unresolved + "개" : ""}
              {state?.importJournal ? " · 기록 가져오기 확인 필요" : ""}</p>
          )}
          {!!conflicts.length && (
            <section className="account-extra">
              <h4>기록 충돌 해결</h4>
              {conflicts.map((conflict) => {
                const processing = state?.outbox.some((operation) => operation.conflictId === conflict.id);
                return <div className="account-conflict" key={conflict.id}>
                  <details><summary>이 기기와 클라우드 내용 비교</summary>
                    <h5>이 기기</h5>
                    <pre>{JSON.stringify(conflict.operation.changes.map((x) => ({ date:x.day, deleted:x.deleted, ...x.data })),null,2)}</pre>
                    <h5>클라우드</h5>
                    <pre>{JSON.stringify(conflict.remote.map((x) => ({ date:x.day, deleted:x.deleted, ...x.data })),null,2)}</pre>
                  </details>
                  {processing && <p role="status">선택한 내용을 서버에 확인 중입니다. 연결 후 계속 처리합니다.</p>}
                  <div className="account-compact-actions">
                    <button type="button" className="secondary" disabled={processing || workingAction !== null} aria-busy={workingAction === "resolve"} onClick={() => void runOnce("resolve", () => app.resolve(conflict,true))}>이 기기 기록 사용</button>
                    <button type="button" className="secondary" disabled={processing || workingAction !== null} aria-busy={workingAction === "resolve"} onClick={() => void runOnce("resolve", () => app.resolve(conflict,false))}>클라우드 기록 사용</button>
                  </div>
                </div>;
              })}
            </section>
          )}
          {state?.importJournal && (
            <section className="account-extra" aria-label="가져오기 상태">
              <h4>{state.importJournal.phase === "conflict" ? "가져오기 충돌" : state.importJournal.phase === "auth_required" ? "가져오기 인증 만료" : state.importJournal.phase === "failed" ? "가져오기 실패" : state.importJournal.phase === "verifying" ? "가져오기 검증 중" : "가져오기 대기"}</h4>
              <p>원본과 중단 지점을 보존했습니다. 연결·인증 또는 충돌을 해결한 뒤 재개해주세요.</p>
              <button type="button" className="secondary" disabled={app.busy || workingAction !== null} aria-busy={workingAction === "resume-import"} onClick={() => void runOnce("resume-import", async () => { await app.migrate(); })}>
                {workingAction === "resume-import" ? <><LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> 가져오기 재개 중…</> : "가져오기 재개"}
              </button>
            </section>
          )}
          {showImportReceipt && !state?.importJournal && state?.importReceipt && (
            <p role="status" className="account-note account-import-verified">가져오기 완료 · 서버와 로컬 기록을 확인했습니다.</p>
          )}
          <div className="account-divider" />
          <AccountSectionTitle className="account-section-title">백업 및 복원</AccountSectionTitle>
          <div className="account-ui-card account-action-group">
          <button type="button" className="account-action-row" disabled={backupBusy || app.busy || workingAction !== null || (nativeBackup && !app.snapshot)} aria-busy={workingAction === "backup"} onClick={() => void runOnce("backup", exportBackup)}>
            <Download size={18} /><span>{workingAction === "backup" ? "백업 준비 중…" : nativeBackup ? "기록 백업 파일 내보내기" : "기록 백업 내려받기"}</span><ChevronRight size={16} />
          </button>
          <details className="account-restore-details">
            <summary className="account-action-row"><ArrowDownToLine size={18} /><span>백업 파일 복원</span><ChevronRight size={16} /></summary>
            <p>기록이 없는 같은 계정 또는 비회원 저장 공간에서만 복원할 수 있어요. 기존 기록은 덮어쓰지 않습니다.</p>
            <label className="field account-backup-field">백업 파일 선택
              <input className="account-backup-input" type="file" accept=".json,application/json" disabled={!app.snapshot || app.busy || backupBusy || workingAction !== null} aria-busy={workingAction === "restore"} onChange={async (e) => {
                const file = e.target.files?.[0];
                await runOnce("restore", async () => { await restoreBackup(file); });
                e.target.value = "";
              }} />
            </label>
            {workingAction === "restore" && <p role="status">백업 파일을 확인하고 있어요…</p>}
          </details>
          </div>
          {!!state?.migration?.issues.length && (
            <section className="account-extra">
              <h4>원본 복구 확인 필요</h4>
              <p>원본은 변경하지 않았습니다. 백업을 보관하고 항목을 확인해주세요.</p>
              <details><summary>검증 결과 {state.migration.issues.length}개</summary>
                <pre>{JSON.stringify(state.migration.issues,null,2)}</pre></details>
              {!state.recoveryAcknowledged && <button type="button" className="secondary" disabled={app.busy || workingAction !== null} aria-busy={workingAction === "ack-recovery"} onClick={() => void runOnce("ack-recovery", async () => {
                try { await app.acknowledgeRecovery(); }
                catch { throw Error("백업을 확인해주세요."); }
              })}>{workingAction === "ack-recovery" ? "백업 및 확인 중…" : "원본 백업 후 유효한 기록 사용 확인"}</button>}
            </section>
          )}
          {app.user && (
            <details className="account-advanced-details">
              <summary>기록 이전 · 고급 관리 <ChevronRight size={16} aria-hidden="true"/></summary>
              <button type="button" className="account-action-row" disabled={workingAction !== null} aria-busy={workingAction === "preview-import"} onClick={() => void runOnce("preview-import", async () => {
                // Advanced manual inspection must also work for legacy/demo
                // snapshots, where the guestHasOwnRecords heuristic is false.
                setGuestAvailable(true);
                setPreview(await app.previewImport());
              })}><Database size={18}/><span>{workingAction === "preview-import" ? "기록 확인 중…" : "이 기기의 비회원 기록 확인"}</span><ChevronRight size={16}/></button>
              {importPreview}
            </details>
          )}
        </section>
      )}

      {page === "import" && app.user && (
        <section className="account-detail account-import-flow" aria-label="비회원 기록 가져오기">
          <p className="account-detail-hint">이 기기의 기록을 확인한 뒤 직접 가져올 수 있어요. 원본은 그대로 보존됩니다.</p>
          {!preview && !message && <p role="status" className="account-note">가져올 기록을 확인하고 있어요.</p>}
          {importPreview}
          {!!state?.importJournal && <button type="button" className="secondary" onClick={() => navigate("records")}>충돌 및 가져오기 상태 확인</button>}
        </section>
      )}
      {page === "settings" && (
        <section className="account-detail account-settings-final" aria-label="앱 설정">
          {message && (
            <p className="account-settings-message" role={/실패|오류|못했|확인해 주세요/.test(message) ? "alert" : "status"}>{message}</p>
          )}
          {nativeReminders && <AccountSectionTitle className="account-settings-group-title">알림</AccountSectionTitle>}
          {nativeReminders && (
            <div className="account-ui-card account-ui-status-card account-setting-block android-permission-summary" role="group" aria-label="기기 알림 권한">
              <div className="android-permission-compact">
                <BellRing size={19} aria-hidden="true" className="android-permission-icon" />
                <span className="android-permission-text">
                  <strong>기기 알림</strong>
                  <small>{nativeReminders.permissionState === "denied"
                    ? "권한이 차단되어 알림이 오지 않아요."
                    : nativeReminders.permissionState === "prompt"
                      ? "허용하면 선택한 습관 알림을 받을 수 있어요."
                      : "습관 알림을 받아요."}</small>
                </span>
                {nativeReminders.permissionState === "granted" ? (
                  <span className="android-permission-granted" role="status">
                    <CheckCircle2 size={16} aria-hidden="true" /> 허용됨
                  </span>
                ) : nativeReminders.permissionState === "unknown" ? (
                  <span className="android-permission-unknown" role="status">확인 중…</span>
                ) : (
                  <button type="button" className="secondary android-permission-action"
                    disabled={nativeReminders.busy || workingAction !== null || app.busy}
                    aria-busy={workingAction === "device-permission"}
                    onClick={() => void runOnce("device-permission", async () => {
                      await nativeReminders.onRequestPermission();
                    })}>
                    {nativeReminders.permissionState === "denied" ? "기기 설정 열기" : "알림 허용하기"}
                  </button>
                )}
              </div>
              {!!nativeReminders.status && /실패|못했|확인해 주세요|허용해 주세요|차단/.test(nativeReminders.status) && (
                <p className="android-permission-help" role="status">{nativeReminders.status}</p>
              )}
            </div>
          )}
          {nativeReminders && (
            <div className="account-ui-card account-setting-block android-wrapup-settings" aria-label="시간대 마무리 알림">
              <div className="account-setting-heading">
                <span>마무리 알림</span>
                <small>완료하지 않은 습관이 있을 때만 알려드려요.</small>
              </div>
              {wrapupPeriods.map(({ group, name, times }) => {
                const choice = nativeReminders.wrapupSettings[group];
                const working = nativeReminders.busy || workingAction !== null || app.busy;
                const PeriodIcon = group === "morning" ? Sunrise : group === "day" ? Sun : Moon;
                return (
                  <div className="android-wrapup-period" key={group}>
                    <div className="android-wrapup-inline-row">
                      <span className="android-wrapup-label"><PeriodIcon size={19} aria-hidden="true" /><strong>{name}</strong></span>
                      <label className="android-wrapup-time" htmlFor={"wrapup-time-" + group}>
                        <span className="sr-only">{name} 마무리 알림 시간</span>
                        <select id={"wrapup-time-" + group} value={choice.time} disabled={!choice.enabled || working}
                          aria-label={name + " 마무리 알림 시간"}
                          onChange={(event) => void runOnce("wrapup-time-" + group, async () => {
                            if (!await nativeReminders.onWrapupChange(group, { time: event.target.value })) {
                              throw Error("알림 시간을 변경하지 못했어요.");
                            }
                          })}>
                          {times.map(time => <option key={time} value={time}>{time}</option>)}
                        </select>
                      </label>
                      <button type="button" role="switch" className="compact-setting-toggle android-wrapup-toggle"
                        aria-label={name + " 마무리 알림"} aria-checked={choice.enabled}
                        disabled={working} aria-busy={workingAction === "wrapup-" + group}
                        onClick={() => void runOnce("wrapup-" + group, async () => {
                          if (!await nativeReminders.onWrapupChange(group, { enabled: !choice.enabled })) {
                            throw Error("알림 설정을 저장하지 못했어요. Android 알림 권한을 확인해 주세요.");
                          }
                        })}>
                        <span className="compact-switch-track" aria-hidden="true"><span className="compact-switch-thumb" /></span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {(nativeReminders.busy || workingAction?.startsWith("wrapup")) && <p className="account-note" role="status">알림 설정을 확인하고 있어요…</p>}
            </div>
          )}

          <AccountSectionTitle className="account-settings-group-title">화면</AccountSectionTitle>
          <div className="account-setting-block">
            <div className="account-setting-heading"><span>화면 테마</span></div>
            <div className="account-theme-options" role="group" aria-label="화면 테마">
              <button type="button" aria-pressed={theme === "system"} onClick={() => onThemeChange("system")}><MonitorSmartphone size={19} aria-hidden="true"/><span>시스템</span></button>
              <button type="button" aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><Sun size={19} aria-hidden="true"/><span>라이트</span></button>
              <button type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><Moon size={19} aria-hidden="true"/><span>다크</span></button>
            </div>

          </div>
          <div className="account-setting-block">
            <button
              type="button"
              className="compact-setting-row compact-setting-toggle account-setting-pressable"
              role="switch"
              aria-label="간편 보기"
              aria-checked={compactView}
              onClick={() => onCompactViewChange(!compactView)}
            >
              <span className="account-setting-heading"><span>간편 보기</span><small>습관을 한 줄로 보고, 완료한 습관은 접어요</small></span>
              <span className="compact-switch-track" aria-hidden="true"><span className="compact-switch-thumb" /></span>
            </button>
          </div>

          <AccountSectionTitle className="account-settings-group-title">기록</AccountSectionTitle>
          <div className="account-setting-block">
            <div className="account-setting-heading"><span>기록 시간대</span><small>{app.user ? "습관 기록의 날짜 기준" : "기기의 시간대를 사용해요"}</small></div>
            {app.user ? (
              <button type="button" className="account-timezone-trigger"
                aria-expanded={timezonePicker} aria-controls="account-timezone-picker"
                disabled={changingZone || app.busy} onClick={() => setTimezonePicker(!timezonePicker)}>
                <span>{zoneName(state?.timezone ?? deviceZone)}</span>
                <ChevronRight size={18} aria-hidden="true" className={timezonePicker ? "is-expanded" : ""} />
              </button>
            ) : (
              <div className="account-timezone-static"><span>{zoneName(deviceZone)}</span></div>
            )}
            {app.user && timezonePicker && (
              <div id="account-timezone-picker" className="account-timezone-picker" aria-busy={changingZone}>
                <button type="button" className="account-device-timezone" disabled={app.busy || changingZone || deviceZone === state?.timezone} onClick={() => void setTimezone(deviceZone)}>
                  <Laptop size={17}/><span>기기 시간대 사용<small>{zoneName(deviceZone)}</small></span>
                  {deviceZone === state?.timezone ? "선택됨" : <ChevronRight size={16}/>}
                </button>
                <label className="field">도시 또는 시간대 검색
                  <input type="search" value={zoneQuery} placeholder="예: 서울, Tokyo, London" onChange={(e) => setZoneQuery(e.target.value)} />
                </label>
                {changingZone && <p className="account-note" role="status">시간대를 변경하고 있어요…</p>}
                <div className="account-timezone-list" role="group" aria-label="시간대 선택">
                  {matchingZones.map((zone) => (
                    <button type="button" key={zone} disabled={app.busy || changingZone} aria-pressed={zone === state?.timezone} onClick={() => void setTimezone(zone)}>
                      <span>{zoneName(zone)}<small>{zone}</small></span>
                      {zone === state?.timezone && <CheckCircle2 size={16}/>}
                    </button>
                  ))}
                  {matchingZones.length === 0 && <p>일치하는 도시가 없어요. 도시 이름이나 IANA 시간대를 검색해주세요.</p>}
                </div>
              </div>
            )}
          </div>
          {onInstall && <button type="button" className="account-action-row" onClick={onInstall}><ArrowDownToLine size={18}/><span>별하루 앱 설치</span><ChevronRight size={16}/></button>}
          <details className="account-app-info">
            <summary>앱 정보 <ChevronRight size={16} aria-hidden="true"/></summary>
            <p className="account-note" data-testid="build-info" aria-label="앱 빌드 정보">{nativeReminders ? "Android" : "Web"} · v{APP_BUILD_INFO.version} · 빌드 {APP_BUILD_INFO.shortSha}</p>
          </details>
        </section>
      )}

      {page === "help" && (
        <section className="account-detail account-help" aria-label="사용 안내">
          <div className="account-help-intro">
            <Sparkles size={23} aria-hidden="true" />
            <h3>작은 실천이 별빛이 되는 곳</h3>
          </div>
          <div className="account-ui-card account-help-list">
            <details className="account-help-group">
              <summary className="account-help-trigger">
                <span className="account-help-icon" aria-hidden="true"><Star size={20} /></span>
                <h3>오늘의 실천</h3>
                <ChevronRight size={17} className="account-help-chevron" aria-hidden="true" />
              </summary>
              <div className="account-help-copy">
                <p><span>습관을 실천한 날 별 1~5개로 기록해요.</span><span>같은 별을 다시 누르면 기록을 취소할 수 있어요.</span></p>
              </div>
            </details>
            <details className="account-help-group">
              <summary className="account-help-trigger">
                <span className="account-help-icon" aria-hidden="true"><Sparkles size={20} /></span>
                <h3>별자리 성장</h3>
                <ChevronRight size={17} className="account-help-chevron" aria-hidden="true" />
              </summary>
              <div className="account-help-copy">
                <p><span>실천이 쌓이면 나만의 별자리가 성장해요.</span><span>최근 7일 돌아보기에서 지난 실천을 살펴볼 수 있어요.</span></p>
              </div>
            </details>
            <details className="account-help-group">
              <summary className="account-help-trigger">
                <span className="account-help-icon" aria-hidden="true"><Cloud size={20} /></span>
                <h3>기록 보관과 동기화</h3>
                <ChevronRight size={17} className="account-help-chevron" aria-hidden="true" />
              </summary>
              <div className="account-help-copy">
                <p>
                  <span>비회원 기록은 현재 기기에만 보관돼요.</span>
                  <span>로그인하면 회원 기록을 클라우드에 동기화해요.</span>
                  <span>비회원 기록은 확인 후 직접 가져올 수 있어요.</span>
                </p>
              </div>
            </details>
          </div>
          {(nativeReminders?.permissionState === "denied" || nativeReminders?.permissionState === "prompt" || !nativeReminders) && (
          <button type="button" className="account-help-support" onClick={() => navigate(nativeReminders ? "settings" : "records")}>
            <CircleHelp size={18} aria-hidden="true" />
            <span>{nativeReminders ? "알림 권한 설정" : "기록 저장에 문제가 있나요?"}</span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          )}
        </section>
      )}

      {page === "security" && app.user && (
        <section className="account-detail" aria-label="계정 관리">
          <div className="account-record-card">
            <div className="account-record-row"><ShieldCheck size={18}/><span>로그인 계정</span><strong className="account-email">{app.user.email}</strong></div>
          </div>
          <div className="account-security-actions">
            <button type="button" className="account-logout" disabled={workingAction !== null || app.busy} aria-busy={workingAction === "logout"} onClick={() => void runOnce("logout", app.logout)}>
              {workingAction === "logout" ? <LoaderCircle size={18} className="is-spinning" aria-hidden="true"/> : <LogOut size={18} aria-hidden="true"/>}
              {workingAction === "logout" ? "로그아웃 중…" : "로그아웃"}
            </button>
            <p className="account-note">{pending || unresolved || state?.importJournal ? "미전송 기록이나 충돌이 있어요. 백업을 확인한 후 로그아웃합니다." : "로그아웃하면 이 기기의 회원 캐시가 정리됩니다."}</p>
          </div>
        </section>
      )}
      {(message || app.error) && <p role="status" aria-live="polite" className="auth-feedback">{message || app.error}</p>}
    </div>
  );
}

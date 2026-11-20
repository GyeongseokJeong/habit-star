"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ChevronRight, CheckCircle2, CloudOff,
  Database, Download, RefreshCw, Settings2, ShieldCheck, Sparkles, UserRound, CircleHelp,
  AlertCircle, Clock3, Laptop, Moon, Sun, LoaderCircle,
} from "lucide-react";
import { cloudEnabled } from "@/lib/supabase/client";
import type { useHabitApp } from "@/lib/habits/use-habit-app";
import type { Snapshot } from "@/lib/habits/repository";
import type { NativeReminderControls } from "@/lib/habits/native-reminder-controls";
import { AuthForm, type AuthMode } from "./auth-form";

type App = ReturnType<typeof useHabitApp>;
export type AccountPage = "home" | "records" | "import" | "settings" | "security" | AuthMode;

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
  app, page, onNavigate, theme, onThemeChange, compactView, onCompactViewChange, onHelp, onInstall, nativeReminders,
}: {
  app: App;
  page: AccountPage;
  onNavigate: (next: AccountPage) => void;
  theme: "light" | "dark";
  onThemeChange: (next: "light" | "dark") => void;
  compactView: boolean;
  onCompactViewChange: (enabled: boolean) => void;
  onHelp: () => void;
  onInstall?: () => void;
  nativeReminders?: NativeReminderControls;
}) {
  const state = app.snapshot?.state;
  const [message, setMessage] = useState("");
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
  // An import can finish through conflict resolution or background resume,
  // not only through the "merge" button. Retire its stale preview after verification.
  useEffect(() => {
    if (state?.importReceipt && !state.importJournal) setPreview(null);
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
  const lastSyncAt = state?.sync?.lastSuccessAt
    ? new Date(state.sync.lastSuccessAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const navigate = (to: AccountPage) => {
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
  const restoreBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      await app.restore(await file.text());
      setMessage("백업을 복원했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "복원 실패");
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
                    <button type="button" className="primary" disabled={app.busy || (!!preview.state.migration?.issues.length && !preview.state.recoveryAcknowledged)} onClick={async () => {
                      const result = await app.migrate();
                      if (result?.status === "applied") setPreview(null);
                      if (page === "import" && result) navigate("records");
                    }}>이 계정으로 병합</button>
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
            <button type="button" aria-label="앱 설정" onClick={() => navigate("settings")}><Settings2 size={19} /><span>앱 설정<small>화면 테마 · 시간대</small></span><ChevronRight size={17} /></button>
            <button type="button" aria-label="사용 안내" onClick={onHelp}><CircleHelp size={19} /><span>사용 안내<small>별점 기록 · 데이터 보관</small></span><ChevronRight size={17} /></button>
            {app.user && <button type="button" aria-label="계정 관리" onClick={() => navigate("security")}><UserRound size={19} /><span>계정 관리<small>계정 정보 · 로그아웃</small></span><ChevronRight size={17} /></button>}
          </nav>
        </>
      )}

      {page === "records" && (
        <section className="account-detail" aria-label="데이터 관리">
          <div className={"account-sync-overview is-" + statusTone} role={critical ? "alert" : "status"}>
            <div className="account-sync-heading">
              <StatusIcon size={20} aria-hidden="true" className={syncing ? "is-spinning" : ""}/>
              <strong>{app.user ? (app.error || status) : "이 기기에 기록을 저장하고 있어요"}</strong>
            </div>
            <p>{state?.localSavedAt ? "기기 저장 완료" : "기기 기록 확인됨"}{app.user ? " · " + (status === "클라우드 동기화 완료" ? "클라우드 동기화 완료" : "클라우드 상태 확인 중") : " · 비회원 모드"}</p>
            {app.user && <div className="account-sync-footer">
              <span>마지막 성공 · {lastSyncAt ?? "아직 없음"}</span>
              <button type="button" className="secondary" disabled={app.busy} onClick={() => void app.sync()} aria-label="지금 동기화"><RefreshCw size={16} aria-hidden="true" /> 지금 동기화</button>
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
                    <button type="button" className="secondary" disabled={processing} onClick={() => void app.resolve(conflict,true).catch(() => setMessage("해결하지 못했습니다. 다시 동기화해주세요."))}>이 기기 기록 사용</button>
                    <button type="button" className="secondary" disabled={processing} onClick={() => void app.resolve(conflict,false).catch(() => setMessage("해결하지 못했습니다. 다시 동기화해주세요."))}>클라우드 기록 사용</button>
                  </div>
                </div>;
              })}
            </section>
          )}
          {state?.importJournal && (
            <section className="account-extra" aria-label="가져오기 상태">
              <h4>{state.importJournal.phase === "conflict" ? "가져오기 충돌" : state.importJournal.phase === "auth_required" ? "가져오기 인증 만료" : state.importJournal.phase === "failed" ? "가져오기 실패" : state.importJournal.phase === "verifying" ? "가져오기 검증 중" : "가져오기 대기"}</h4>
              <p>원본과 중단 지점을 보존했습니다. 연결·인증 또는 충돌을 해결한 뒤 재개해주세요.</p>
              <button type="button" className="secondary" disabled={app.busy} onClick={() => void app.migrate()}>가져오기 재개</button>
            </section>
          )}
          {!state?.importJournal && state?.importReceipt && <p role="status" className="account-note">가져오기 완료 · 서버와 로컬 기록을 확인했습니다.</p>}
          <div className="account-divider" />
          <h4 className="account-section-title">백업 및 복원</h4>
          <button type="button" className="account-action-row" onClick={() => void app.backup().catch(() => setMessage("백업을 읽지 못했습니다. 브라우저 저장 설정을 확인해주세요."))}>
            <Download size={18} /><span>기록 백업 내려받기</span><ChevronRight size={16} />
          </button>
          <details className="account-restore-details">
            <summary className="account-action-row"><ArrowDownToLine size={18} /><span>백업 파일 복원</span><ChevronRight size={16} /></summary>
            <p>기록이 없는 같은 계정 또는 비회원 저장 공간에서만 복원할 수 있어요. 원본은 먼저 백업합니다.</p>
            <label className="field">백업 복원 (기록이 없는 같은 계정·브라우저)
              <input type="file" accept="application/json" disabled={!app.snapshot || app.busy} onChange={async (e) => {
                const file = e.target.files?.[0];
                await restoreBackup(file);
                e.target.value = "";
              }} />
            </label>
          </details>
          {!!state?.migration?.issues.length && (
            <section className="account-extra">
              <h4>원본 복구 확인 필요</h4>
              <p>원본은 변경하지 않았습니다. 백업을 보관하고 항목을 확인해주세요.</p>
              <details><summary>검증 결과 {state.migration.issues.length}개</summary>
                <pre>{JSON.stringify(state.migration.issues,null,2)}</pre></details>
              {!state.recoveryAcknowledged && <button type="button" className="secondary" onClick={() => void app.acknowledgeRecovery().catch(() => setMessage("백업을 확인해주세요."))}>원본 백업 후 유효한 기록 사용 확인</button>}
            </section>
          )}
          {app.user && (
            <details className="account-advanced-details">
              <summary>고급 데이터 관리 <ChevronRight size={16} aria-hidden="true"/></summary>
              <p className="account-note">다른 저장 공간의 비회원 기록을 수동으로 확인할 수 있어요.</p>
              <button type="button" className="account-action-row" onClick={async () => {
                try { setGuestAvailable(true); setPreview(await app.previewImport()); }
                catch { setMessage("비회원 기록을 읽지 못했습니다. 백업을 확인해주세요."); }
              }}><Database size={18}/><span>이 기기의 비회원 기록 가져오기</span><ChevronRight size={16}/></button>
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
        <section className="account-detail" aria-label="앱 설정">
          <p className="account-detail-hint">별하루가 편안하게 느껴지도록 설정해요.</p>
          <div className="account-setting-block">
            <div className="account-setting-heading"><span>화면 테마</span><small>앱에서 선택한 테마를 유지해요</small></div>
            <div className="account-theme-options" role="group" aria-label="화면 테마">
              <button type="button" aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><Sun size={18}/>라이트</button>
              <button type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><Moon size={18}/>다크</button>
            </div>
          </div>
          <div className="account-setting-block">
            <div className="compact-setting-row">
              <span className="account-setting-heading"><span>간편 보기</span><small>습관을 한 줄로 보고, 완료한 습관은 접어요</small></span>
              <button
                type="button"
                className="compact-setting-toggle"
                role="switch"
                aria-label="간편 보기"
                aria-checked={compactView}
                onClick={() => onCompactViewChange(!compactView)}
              ><span className="compact-switch-track" aria-hidden="true"><span className="compact-switch-thumb" /></span></button>
            </div>
          </div>
          {nativeReminders && (
            <div className="account-setting-block">
              <div className="compact-setting-row">
                <span className="account-setting-heading">
                  <span>습관 알림</span>
                  <small>Android 앱에서 선택한 습관을 알려드려요</small>
                </span>
                <button
                  type="button"
                  className="compact-setting-toggle"
                  role="switch"
                  aria-label="습관 알림"
                  aria-checked={nativeReminders.enabled}
                  disabled={nativeReminders.busy}
                  onClick={() => void nativeReminders.onEnabledChange(!nativeReminders.enabled)}
                ><span className="compact-switch-track" aria-hidden="true"><span className="compact-switch-thumb" /></span></button>
              </div>
              {nativeReminders.enabled && nativeReminders.permissionState === "denied" && (
                <p className="account-note" role="status">
                  <strong>기기 알림 권한 차단됨</strong> · 습관 알림 설정은 유지되지만 현재 알림이 표시되지 않아요.
                  휴대폰 설정 → 앱 → 별하루 → 알림에서 허용해 주세요.
                </p>
              )}
              {!!nativeReminders.status && !(nativeReminders.enabled && nativeReminders.permissionState === "denied") && (
                <p className="account-note" role="status">{nativeReminders.status}</p>
              )}
              <details className="android-reminder-details">
                <summary>알림 예약 및 문제 해결 <ChevronRight size={16} aria-hidden="true" /></summary>
                <div className="android-reminder-details-body">
                  <p className="account-note">예약이 궁금하거나 알림이 오지 않을 때 확인해요.</p>
                  <div className="android-reminder-detail-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={nativeReminders.busy}
                      onClick={() => void nativeReminders.onInspectPending()}
                    >알림 예약 확인</button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={nativeReminders.busy}
                      onClick={() => void nativeReminders.onAuditPending()}
                    >습관 설정과 예약 비교</button>
                  </div>
                  {!!nativeReminders.diagnostic && (
                    <p className="account-note" role="status">{nativeReminders.diagnostic}</p>
                  )}
                  {!!nativeReminders.auditStatus && (
                    <p className="account-note" role="status">{nativeReminders.auditStatus}</p>
                  )}
                  {nativeReminders.repairAvailable && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={nativeReminders.busy}
                      onClick={() => void nativeReminders.onRepairPending()}
                    >알림 예약 다시 맞추기</button>
                  )}
                  {!!nativeReminders.repairStatus && (
                    <p className="account-note" role="status">{nativeReminders.repairStatus}</p>
                  )}
                </div>
              </details>
            </div>
          )}
          <div className="account-setting-block">
            <div className="account-setting-heading"><span>시간대</span><small>{app.user ? "습관 기록의 날짜 기준" : "기기의 시간대를 사용해요"}</small></div>
            <div className="account-timezone-row"><Clock3 size={19}/><span><strong>{zoneName(state?.timezone ?? deviceZone)}</strong><small>{state?.timezone ?? deviceZone}</small></span>
              {app.user && <button type="button" className="secondary" aria-expanded={timezonePicker} onClick={() => setTimezonePicker(!timezonePicker)}>변경</button>}
            </div>
            {app.user && timezonePicker && (
              <div className="account-timezone-picker">
                <button type="button" className="account-device-timezone" disabled={app.busy || changingZone || deviceZone === state?.timezone} onClick={() => void setTimezone(deviceZone)}>
                  <Laptop size={17}/><span>기기 시간대 사용<small>{zoneName(deviceZone)}</small></span>
                  {deviceZone === state?.timezone ? "선택됨" : <ChevronRight size={16}/>}
                </button>
                <label className="field">도시 또는 시간대 검색
                  <input type="search" value={zoneQuery} placeholder="예: 서울, Tokyo, London" onChange={(e) => setZoneQuery(e.target.value)} />
                </label>
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
        </section>
      )}

      {page === "security" && app.user && (
        <section className="account-detail" aria-label="계정 관리">
          <p className="account-detail-hint">내 계정과 로그인 상태를 확인해요.</p>
          <div className="account-record-card">
            <div className="account-record-row"><ShieldCheck size={18}/><span>로그인 계정</span><strong className="account-email">{app.user.email}</strong></div>
          </div>
          <button type="button" className="account-action-row" onClick={() => navigate("login")}><UserRound size={18}/><span>다시 로그인</span><ChevronRight size={16}/></button>
          <div className="account-divider" />
          <button type="button" className="account-logout" onClick={() => void app.logout().catch(() => setMessage("로그아웃하지 못했습니다. 다시 시도해주세요."))}>로그아웃</button>
          <p className="account-note">미전송 기록이나 충돌이 남아 있으면 백업 및 확인 후 로그아웃해요.</p>
        </section>
      )}
      {(message || app.error) && <p role="status" aria-live="polite" className="auth-feedback">{message || app.error}</p>}
    </div>
  );
}

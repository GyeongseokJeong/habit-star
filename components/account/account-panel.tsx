"use client";
import { useState, useEffect, type ReactNode } from "react";
import { cloudEnabled } from "@/lib/supabase/client";
import { AuthForm } from "./auth-form";
import type { useHabitApp } from "@/lib/habits/use-habit-app";
import type { Snapshot } from "@/lib/habits/repository";
type App = ReturnType<typeof useHabitApp>;
export function AccountPanel({
  app,
  settings,
}: {
  app: App;
  settings?: ReactNode;
}) {
  const [message, setMessage] = useState(""),
    [preview, setPreview] = useState<Snapshot | null>(null),
    [reauth, setReauth] = useState(false);
  const state = app.snapshot?.state;
  useEffect(() => {
    if (state?.importReceipt && !state.importJournal) setPreview(null);
  }, [state?.importReceipt?.verifiedAt, state?.importJournal]);
  return (
    <div className="account-panel">
      <div className="account-identity">
        <div className="account-identity-label">
          {app.user ? "내 계정" : "비회원으로 함께하고 있어요"}
        </div>
        {app.user ? (
          <strong className="account-email">{app.user.email}</strong>
        ) : (
          <p>로그인 없이 이 기기에서 사용할 수 있어요.</p>
        )}
      </div>
      {state && (
        <dl className="storage-status">
          <dt>기기 저장</dt>
          <dd>{state.localSavedAt ? "로컬 저장 완료" : "로컬 기록 확인됨"}</dd>
          {app.user && (
            <>
              <dt>클라우드</dt>
              <dd>{app.status}</dd>
              <dt>마지막 동기화 성공</dt>
              <dd>
                {state.sync?.lastSuccessAt
                  ? new Date(state.sync.lastSuccessAt).toLocaleString("ko-KR")
                  : "아직 확인되지 않았어요"}
              </dd>
            </>
          )}
        </dl>
      )}
      {!!state?.outbox.length && (
        <p className="sync-warning" role="alert">
          미전송 기록 {state.outbox.length}개 · 기기에는 보존되어 있어요. 연결
          후 동기화해주세요.
        </p>
      )}
      {app.user && !reauth ? (
        <>
          <h3>동기화</h3>
          <button
            className="secondary full"
            disabled={app.busy}
            onClick={() => void app.sync()}
          >
            지금 동기화
          </button>
          <button
            className="secondary full"
            onClick={async () => {
              try {
                setPreview(await app.previewImport());
              } catch {
                setMessage(
                  "비회원 기록을 읽지 못했습니다. 백업을 확인해주세요.",
                );
              }
            }}
          >
            이 기기의 비회원 기록 가져오기
          </button>
          {preview && (
            <section>
              <h3>기록 이전 확인</h3>
              <p>대상 계정: {app.user.email}</p>
              <p>
                현재 습관 {preview.habits.length}개 · 날짜{" "}
                {Object.keys(preview.history).length}개 · 기록{" "}
                {Object.values(preview.history).reduce(
                  (n, h) => n + h.length,
                  0,
                )}
                개
              </p>
              <p>원본은 보존하고 같은 ID의 다른 내용은 충돌로 남깁니다.</p>
              {!!preview.state.migration?.issues.length &&
                !preview.state.recoveryAcknowledged && (
                  <p role="alert">
                    복구 확인이 필요한 항목{" "}
                    {preview.state.migration.issues.length}개가 있습니다. 비회원
                    모드에서 백업·확인한 후 이전해주세요.
                  </p>
                )}
              <button
                className="primary full"
                disabled={
                  app.busy ||
                  (!!preview.state.migration?.issues.length &&
                    !preview.state.recoveryAcknowledged)
                }
                onClick={async () => {
                  const result = await app.migrate();
                  if (result?.status === "applied") setPreview(null);
                }}
              >
                이 계정으로 병합
              </button>
              <button
                className="text-button full"
                onClick={() => setPreview(null)}
              >
                나중에
              </button>
            </section>
          )}
          {state?.importJournal && (
            <section aria-label="가져오기 상태">
              <h3>
                {state.importJournal.phase === "conflict"
                  ? "가져오기 충돌"
                  : state.importJournal.phase === "auth_required"
                    ? "가져오기 인증 만료"
                    : state.importJournal.phase === "failed"
                      ? "가져오기 실패"
                      : state.importJournal.phase === "verifying"
                        ? "가져오기 검증 중"
                        : "가져오기 대기"}
              </h3>
              <p>
                원본과 중단 지점을 보존했습니다. 충돌을 해결하거나 연결·인증을
                복구한 후 재개해주세요.
              </p>
              <button
                className="secondary full"
                disabled={app.busy}
                onClick={() => void app.migrate()}
              >
                가져오기 재개
              </button>
            </section>
          )}
          {!state?.importJournal && state?.importReceipt && (
            <p role="status">
              가져오기 완료 · 서버와 로컬 기록을 확인했습니다.
            </p>
          )}
          <details>
            <summary>계정 시간대 설정</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await app.changeTimezone(
                    new FormData(e.currentTarget).get("timezone") as string,
                  );
                  setMessage(
                    "계정 시간대를 변경했습니다. 이전 기록의 날짜는 유지됩니다.",
                  );
                } catch {
                  setMessage(
                    "시간대를 바꾸지 못했습니다. 연결 및 IANA 시간대 이름을 확인해주세요.",
                  );
                }
              }}
            >
              <label className="field">
                계정 시간대
                <input
                  key={state?.timezone}
                  name="timezone"
                  defaultValue={state?.timezone}
                  required
                  placeholder="Asia/Seoul"
                />
              </label>
              <button className="secondary full" disabled={app.busy}>
                시간대 변경
              </button>
            </form>
          </details>
          {state?.conflicts
            .filter((c) => !c.resolved)
            .map((c) => (
              <section key={c.id}>
                <h3>동시에 변경된 기록</h3>
                <details>
                  <summary>이 기기와 클라우드 내용 비교</summary>
                  <h4>이 기기</h4>
                  <pre>
                    {JSON.stringify(
                      c.operation.changes.map((x) => ({
                        date: x.day,
                        deleted: x.deleted,
                        ...x.data,
                      })),
                      null,
                      2,
                    )}
                  </pre>
                  <h4>클라우드</h4>
                  <pre>
                    {JSON.stringify(
                      c.remote.map((x) => ({
                        date: x.day,
                        deleted: x.deleted,
                        ...x.data,
                      })),
                      null,
                      2,
                    )}
                  </pre>
                </details>
                {state.outbox.some((op) => op.conflictId === c.id) && (
                  <p role="status">
                    선택한 내용을 서버에 확인 중입니다. 연결 후 계속 처리합니다.
                  </p>
                )}
                <button
                  className="secondary full"
                  disabled={state.outbox.some((op) => op.conflictId === c.id)}
                  onClick={() =>
                    void app
                      .resolve(c, true)
                      .catch(() =>
                        setMessage("해결하지 못했습니다. 다시 동기화해주세요."),
                      )
                  }
                >
                  이 기기 기록 사용
                </button>
                <button
                  className="secondary full"
                  disabled={state.outbox.some((op) => op.conflictId === c.id)}
                  onClick={() =>
                    void app
                      .resolve(c, false)
                      .catch(() =>
                        setMessage("해결하지 못했습니다. 다시 동기화해주세요."),
                      )
                  }
                >
                  클라우드 기록 사용
                </button>
              </section>
            ))}
          <button className="secondary full" onClick={() => setReauth(true)}>
            다시 로그인
          </button>
          <button
            className="text-button full"
            onClick={() =>
              void app
                .logout()
                .catch(() =>
                  setMessage("로그아웃하지 못했습니다. 다시 시도해주세요."),
                )
            }
          >
            로그아웃
          </button>
        </>
      ) : cloudEnabled() ? (
        <AuthForm onAuthenticated={() => setReauth(false)} />
      ) : (
        <p>
          클라우드 연결이 아직 설정되지 않았습니다. 비회원 기록은 계속 사용할 수
          있어요.
        </p>
      )}
      {settings}
      <section aria-label="내 데이터">
        <h3>내 데이터</h3>
        <button
          className="secondary full"
          onClick={() =>
            void app
              .backup()
              .catch(() =>
                setMessage(
                  "백업을 읽지 못했습니다. 브라우저 저장 설정을 확인해주세요.",
                ),
              )
          }
        >
          기록 백업 내려받기
        </button>
        {!!state?.migration?.issues.length && (
          <section>
            <h3>원본 복구 확인 필요</h3>
            <p>
              원본은 수정하지 않았습니다. 아래 항목을 확인하고 백업을
              보관해주세요.
            </p>
            <details>
              <summary>검증 결과 {state.migration.issues.length}개</summary>
              <pre>{JSON.stringify(state.migration.issues, null, 2)}</pre>
            </details>
            {!state.recoveryAcknowledged && (
              <button
                className="secondary full"
                onClick={() =>
                  void app
                    .acknowledgeRecovery()
                    .catch(() => setMessage("백업을 확인해주세요."))
                }
              >
                원본 백업 후 유효한 기록 사용 확인
              </button>
            )}
          </section>
        )}
        <label className="field">
          백업 복원 (기록이 없는 같은 계정·브라우저)
          <input
            type="file"
            disabled={!app.snapshot || app.busy}
            accept="application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await app.restore(await file.text());
                setMessage("백업을 복원했습니다.");
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "복원 실패",
                );
              }
              e.target.value = "";
            }}
          />
        </label>
      </section>
      {(message || app.error) && (
        <p role="status" className="auth-feedback">
          {message || app.error}
        </p>
      )}
    </div>
  );
}

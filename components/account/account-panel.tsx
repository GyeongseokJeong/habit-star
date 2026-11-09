"use client";
import { useState } from "react";
import { cloudEnabled, supabase } from "@/lib/supabase/client";
import type { useHabitApp } from "@/lib/habits/use-habit-app";
import type { Snapshot } from "@/lib/habits/repository";
type App = ReturnType<typeof useHabitApp>;
export function AccountPanel({ app }: { app: App }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<Snapshot | null>(null),
    [reauth, setReauth] = useState(false);
  const state = app.snapshot?.state;
  return (
    <div className="account-panel">
      <p>
        {app.user
          ? app.user.email
          : "로그인 없이 이 기기에서 사용할 수 있어요."}
      </p>
      {app.user && !reauth ? (
        <>
          <button className="secondary full" onClick={() => void app.sync()}>
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
                  await app.migrate();
                  setPreview(null);
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
            <button className="secondary full">시간대 변경</button>
          </form>
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
                <button
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
        <>
          <div className="account-modes">
            <button onClick={() => setMode("login")}>로그인</button>
            <button onClick={() => setMode("signup")}>회원가입</button>
            <button onClick={() => setMode("reset")}>비밀번호 찾기</button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const form = new FormData(e.currentTarget),
                email = form.get("email") as string,
                password = form.get("password") as string;
              try {
                const client = supabase(),
                  redirect = `${location.origin}/auth/confirm`;
                const result =
                  mode === "signup"
                    ? await client.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo: redirect },
                      })
                    : mode === "reset"
                      ? await client.auth.resetPasswordForEmail(email, {
                          redirectTo: `${redirect}?next=/auth/reset`,
                        })
                      : await client.auth.signInWithPassword({
                          email,
                          password,
                        });
                if (result.error) throw result.error;
                if (mode === "login") setReauth(false);
                setMessage(
                  mode === "login"
                    ? "로그인했습니다."
                    : mode === "signup"
                      ? "가입 요청을 처리했습니다. 이메일의 인증 링크를 확인해주세요."
                      : "요청을 처리했습니다. 이메일을 확인해주세요.",
                );
              } catch {
                setMessage(
                  "요청을 처리하지 못했습니다. 입력 정보와 연결 상태를 확인해주세요.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              이메일
              <input type="email" name="email" required autoComplete="email" />
            </label>
            {mode !== "reset" && (
              <label className="field">
                비밀번호
                <input
                  type="password"
                  name="password"
                  minLength={8}
                  required
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
            )}
            <button className="primary full" disabled={busy}>
              {mode === "login"
                ? "로그인"
                : mode === "signup"
                  ? "이메일로 회원가입"
                  : "재설정 메일 보내기"}
            </button>
          </form>
          <button
            className="text-button full"
            disabled={busy}
            onClick={async () => {
              const email = window.prompt(
                "인증 메일을 다시 받을 이메일을 입력해주세요.",
              );
              if (!email) return;
              setBusy(true);
              try {
                await supabase().auth.resend({
                  type: "signup",
                  email,
                  options: {
                    emailRedirectTo: `${location.origin}/auth/confirm`,
                  },
                });
                setMessage("요청을 처리했습니다. 이메일을 확인해주세요.");
              } finally {
                setBusy(false);
              }
            }}
          >
            인증 메일 다시 보내기
          </button>
        </>
      ) : (
        <p>
          클라우드 연결이 아직 설정되지 않았습니다. 비회원 기록은 계속 사용할 수
          있어요.
        </p>
      )}
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
          accept="application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await app.restore(await file.text());
              setMessage("백업을 복원했습니다.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "복원 실패");
            }
            e.target.value = "";
          }}
        />
      </label>
      <p role="status">{message || app.error}</p>
    </div>
  );
}

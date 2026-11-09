"use client";
import { syncStatus } from "./sync-status";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloudEnabled, supabase } from "../supabase/client";
import { type Habit, type Conflict } from "./domain";
import {
  LocalRepository,
  GuestRepository,
  MemberRepository,
  type Snapshot,
} from "./repository";
import { SyncEngine, SupabaseTransport, importGuest } from "./sync";
export function downloadBackup(content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `byeolharu-backup-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useHabitApp(samples: () => Habit[]) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(""),
    [statusMessage, setStatus] = useState("준비 중"),
    [busy, setBusy] = useState(false);
  const repo = useRef<LocalRepository | null>(null),
    engine = useRef<SyncEngine | null>(null),
    cloud = useRef<SupabaseTransport | null>(null),
    epoch = useRef(0),
    running = useRef<{ engine: SyncEngine; promise: Promise<void> } | null>(
      null,
    );
  const refresh = useCallback(async (r = repo.current) => {
    if (!r) return;
    const s = await r.load();
    if (repo.current === r) {
      setSnapshot(s);
    }
  }, []);
  const activeIdentity = useRef<string | null | undefined>(undefined);
  const failures = useRef(0),
    retryAt = useRef(0);
  const sync = useCallback(
    async (force = true) => {
      if (!force && Date.now() < retryAt.current) return;
      const current = repo.current,
        activeEngine = engine.current;
      if (!current || !activeEngine) return;
      if (running.current?.engine === activeEngine)
        return running.current.promise;
      const task = async () => {
        try {
          const result = await activeEngine.run();
          if (repo.current === current && engine.current === activeEngine) {
            if (result?.status !== "skipped") {
              failures.current = 0;
              retryAt.current = 0;
              setError("");
            }
            await refresh(current);
          }
        } catch (e) {
          if (repo.current === current && engine.current === activeEngine) {
            const message = e instanceof Error ? e.message : "동기화 실패";
            failures.current++;
            retryAt.current = /auth_required|invalid_|operation_id_reused/.test(
              message,
            )
              ? Infinity
              : Date.now() +
                Math.min(300000, 1000 * 2 ** Math.min(failures.current, 9)) *
                  (0.8 + Math.random() * 0.4);
            setError(
              message === "auth_required"
                ? "인증이 만료되었습니다. 다시 로그인해주세요. 미전송 기록은 보존됩니다."
                : "동기화하지 못했습니다. 로컬 기록은 보존됩니다. 연결을 확인하고 다시 시도해주세요.",
            );
            await refresh(current);
          }
        }
      };
      const promise = task();
      running.current = { engine: activeEngine, promise };
      try {
        await promise;
      } finally {
        if (running.current?.promise === promise) running.current = null;
      }
    },
    [refresh],
  );
  useEffect(() => {
    let disposed = false,
      unsubscribe: undefined | (() => void);
    const switchTo = async (u: User | null) => {
      const identity = u?.id ?? null;
      if (activeIdentity.current === identity && repo.current) {
        retryAt.current = 0;
        void sync();
        return;
      }
      activeIdentity.current = identity;
      const token = ++epoch.current;
      engine.current?.stop();
      engine.current = null;
      cloud.current = null;
      repo.current?.close();
      repo.current = null;
      setSnapshot(null);
      setBusy(false);
      setUser(null);
      setError("");
      setStatus("준비 중");
      try {
        const r = u ? new MemberRepository(u.id) : new GuestRepository(samples);
        await r.initialize();
        if (disposed || epoch.current !== token) {
          r.close();
          return;
        }
        repo.current = r;
        setUser(u);
        unsubscribe?.();
        unsubscribe = r.subscribe(() => {
          void refresh(r).catch(() => {
            if (repo.current === r) {
              engine.current?.stop();
              setSnapshot(null);
              setStatus("로그인 필요");
            }
          });
        });
        if (u) {
          const transport = new SupabaseTransport(supabase(), u.id);
          cloud.current = transport;
          await refresh(r);
          engine.current = new SyncEngine(r, transport);
          try {
            await engine.current.run();
          } catch {
            setStatus("동기화 대기");
          }
        }
        if (disposed || epoch.current !== token || repo.current !== r) return;
        await r.ensureDay();
        await refresh(r);
        void sync(false);
      } catch (e) {
        if (!disposed && epoch.current === token) {
          setError(e instanceof Error ? e.message : "저장소를 열지 못했어요.");
          setStatus("저장 확인 필요");
        }
      }
    };
    let subscription: { unsubscribe: () => void } | undefined;
    if (cloudEnabled()) {
      // getUser verifies server identity; never select a namespace from an unverified session.
      const verified = async () => {
        const {
          data: { user },
          error,
        } = await supabase().auth.getUser();
        if (user?.email_confirmed_at) return user;
        if (error) {
          // Offline reload may unlock only a previously verified local account.
          // This is not server authorization: every RPC still verifies with getUser + RLS.
          const {
            data: { session },
          } = await supabase().auth.getSession();
          try {
            if (
              session?.user.id ===
              localStorage.getItem("byeolharu_verified_user")
            )
              return session.user;
          } catch {}
        }
        return null;
      };
      let verification = 0;
      const refreshIdentity = async () => {
        const id = ++verification;
        const u = await verified().catch(() => null);
        if (!disposed && id === verification) {
          if (u) {
            try {
              localStorage.setItem("byeolharu_verified_user", u.id);
            } catch {}
          }
          await switchTo(u);
        }
      };
      void refreshIdentity();
      subscription = supabase().auth.onAuthStateChange((event) => {
        if (
          [
            "SIGNED_IN",
            "SIGNED_OUT",
            "USER_UPDATED",
            "TOKEN_REFRESHED",
          ].includes(event)
        )
          setTimeout(() => {
            if (!disposed) void refreshIdentity();
          }, 0);
      }).data.subscription;
    } else void switchTo(null);

    const tick = async () => {
      const r = repo.current;
      if (!r) return;
      try {
        await r.ensureDay();
        await refresh(r);
        await sync(false);
      } catch {}
    };
    const timer = setInterval(() => {
      void tick();
    }, 30000);
    const online = () => {
        retryAt.current = 0;
        void tick();
      },
      visible = () => {
        if (document.visibilityState === "visible") void tick();
      };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      ++epoch.current;
      clearInterval(timer);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      unsubscribe?.();
      subscription?.unsubscribe();
      engine.current?.stop();
      repo.current?.close();
    };
  }, [samples, refresh, sync]);
  const setHabits = useCallback(
    async (update: Habit[] | ((h: Habit[]) => Habit[])) => {
      const r = repo.current;
      if (!r || !snapshot) throw Error("저장소 준비를 기다려주세요.");
      try {
        await r.ensureDay();
        await r.changeHabits((h) =>
          typeof update === "function" ? update(h) : update,
        );
        await refresh(r);
        void sync(false);
      } catch (e) {
        setError(
          e instanceof Error && e.message === "conflict"
            ? "계정 메뉴에서 충돌을 먼저 해결해주세요."
            : "저장하지 못했습니다. 백업을 내려받고 저장 공간을 확인해주세요.",
        );
        throw e;
      }
    },
    [snapshot, refresh, sync],
  );
  const ensureDay = useCallback(async () => {
    const r = repo.current;
    if (r) {
      await r.ensureDay();
      await refresh(r);
    }
  }, [refresh]);
  const backup = async () => {
    const target = repo.current,
      token = epoch.current;
    if (target) {
      const content = await target.exportBackup();
      if (repo.current === target && epoch.current === token)
        downloadBackup(content);
    } else {
      const { captureLegacy } = await import("./migration");
      if (!repo.current && epoch.current === token)
        downloadBackup(JSON.stringify(captureLegacy(localStorage), null, 2));
    }
  };
  const previewImport = async () => {
    const guest = new GuestRepository(samples);
    try {
      await guest.initialize();
      return await guest.load();
    } finally {
      guest.close();
    }
  };
  const migrate = async () => {
    const target = repo.current,
      transport = cloud.current,
      token = epoch.current;
    const active = () => repo.current === target && epoch.current === token;
    if (!target?.member || !transport) return;
    setBusy(true);
    const guest = new GuestRepository(samples);
    try {
      await guest.initialize();
      if (!active()) return;
      await sync();
      if (!active()) return;
      const result = await importGuest(guest, target, transport, active);
      if (active()) {
        await refresh(target);
        if (result.status === "applied") setError("");
      }
      return result;
    } catch (e) {
      if (active()) {
        const code = e instanceof Error ? e.message : "";
        setError(
          code === "auth_required"
            ? "인증이 만료되었습니다. 다시 로그인 후 가져오기를 재개해주세요."
            : code.startsWith("import_verification")
              ? "서버와 기기의 기록을 확인하지 못했습니다. 원본과 중단 지점을 보존했으니 동기화 후 재개해주세요."
              : /[가-힣]/.test(code)
                ? code
                : "가져오기에 실패했습니다. 원본과 중단 지점은 보존됩니다. 연결을 확인하고 재개해주세요.",
        );
        await refresh(target);
      }
      return undefined;
    } finally {
      guest.close();
      if (active()) setBusy(false);
    }
  };
  const resolve = async (c: Conflict, local: boolean) => {
    const target = repo.current,
      token = epoch.current;
    if (!target) return;
    await target.resolve(c, local);
    if (repo.current !== target || epoch.current !== token) return;
    await refresh(target);
    await sync();
    if (
      repo.current === target &&
      epoch.current === token &&
      (await target.state()).importJournal
    )
      await migrate();
  };
  const acknowledgeRecovery = async () => {
    const target = repo.current,
      token = epoch.current;
    if (!target) return;
    await backup();
    if (repo.current !== target || epoch.current !== token) return;
    if (
      window.confirm(
        "백업한 원본은 보존됩니다. 유효한 행만 사용하고 복구 항목은 백업에 남긴 상태로 이전을 허용할까요?",
      )
    ) {
      if (repo.current !== target || epoch.current !== token) return;
      await target.acknowledgeRecovery();
      await refresh(target);
    }
  };
  const restore = async (content: string) => {
    if (!repo.current) throw Error("저장소 준비가 끝난 뒤 복원해주세요.");
    const target = repo.current,
      token = epoch.current;
    await backup();
    if (repo.current !== target || epoch.current !== token)
      throw Error("계정이 변경되어 작업을 중단했습니다.");
    await target.restoreBackup(content);
    if (repo.current !== target || epoch.current !== token)
      throw Error("계정이 변경되어 작업을 중단했습니다.");
    await refresh(target);
    void sync(false);
  };
  const changeTimezone = async (timezone: string) => {
    const target = repo.current,
      transport = cloud.current,
      token = epoch.current;
    if (!target || !transport) return;
    const { data, error } = await supabase()
      .from("profiles")
      .select("version")
      .single();
    if (error) throw error;
    if (repo.current !== target || epoch.current !== token)
      throw Error("계정이 변경되어 작업을 중단했습니다.");
    await transport.rpc("change_timezone", {
      p_timezone: timezone,
      p_version: data.version,
    });
    if (repo.current !== target || epoch.current !== token)
      throw Error("계정이 변경되어 작업을 중단했습니다.");
    await sync();
    await ensureDay();
  };
  const logout = async () => {
    const r = repo.current;
    if (!r?.member) return;
    const token = epoch.current;
    await sync();
    if (repo.current !== r || epoch.current !== token) return;
    const s = await r.state();
    if (
      s.outbox.length ||
      s.conflicts.some((c) => !c.resolved) ||
      s.importJournal
    ) {
      await backup();
      if (
        !window.confirm(
          "미전송 기록 또는 충돌 사본을 백업했습니다. 이 기기의 회원 캐시를 지우고 로그아웃할까요?",
        )
      )
        return;
    }
    if (repo.current !== r || epoch.current !== token) return;
    engine.current?.stop();
    setSnapshot(null);
    try {
      localStorage.removeItem("byeolharu_verified_user");
    } catch {}
    const { error: logoutError } = await supabase().auth.signOut({
      scope: "local",
    });
    if (logoutError) {
      if (repo.current === r && epoch.current === token && cloud.current) {
        engine.current = new SyncEngine(r, cloud.current);
        try {
          localStorage.setItem(
            "byeolharu_verified_user",
            r.scope.slice("member:".length),
          );
        } catch {}
        await refresh(r);
      }
      throw logoutError;
    }
    await LocalRepository.purgeScope(r.scope);
  };
  return {
    snapshot,
    user,
    error,
    status: snapshot ? syncStatus(!!user, snapshot.state) : statusMessage,
    busy,
    setHabits,
    ensureDay,
    backup,
    sync,
    previewImport,
    migrate,
    resolve,
    logout,
    acknowledgeRecovery,
    restore,
    changeTimezone,
  };
}

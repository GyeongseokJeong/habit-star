"use client";
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
    [status, setStatus] = useState("준비 중"),
    [busy, setBusy] = useState(false);
  const repo = useRef<LocalRepository | null>(null),
    engine = useRef<SyncEngine | null>(null),
    cloud = useRef<SupabaseTransport | null>(null),
    epoch = useRef(0),
    syncing = useRef(false);
  const refresh = useCallback(async (r = repo.current) => {
    if (!r) return;
    const s = await r.load();
    if (repo.current === r) {
      setSnapshot(s);
      setStatus(
        r.member && !s.state.hydrated
          ? "초기 연결 필요"
          : s.state.conflicts.some((c) => !c.resolved)
            ? "충돌 확인 필요"
            : s.state.outbox.length
              ? "동기화 대기"
              : r.member
                ? "동기화 완료"
                : "이 기기에 저장됨",
      );
    }
  }, []);
  const activeIdentity = useRef<string | null | undefined>(undefined);
  const failures = useRef(0),
    retryAt = useRef(0);
  const sync = useCallback(
    async (force = true) => {
      if (!force && Date.now() < retryAt.current) return;
      if (syncing.current || !engine.current) return;
      syncing.current = true;
      const current = repo.current;
      try {
        await engine.current.run();
        failures.current = 0;
        retryAt.current = 0;
        if (repo.current === current) {
          setError("");
          await refresh(current);
        }
      } catch (e) {
        if (repo.current === current) {
          const message = e instanceof Error ? e.message : "동기화 실패";
          failures.current++;
          retryAt.current = /auth_required|invalid_|operation_id_reused/.test(
            message,
          )
            ? Infinity
            : Date.now() +
              Math.min(300000, 1000 * 2 ** Math.min(failures.current, 9)) *
                (0.8 + Math.random() * 0.4);
          setStatus(
            message === "auth_required" ? "로그인 필요" : "동기화 대기",
          );
          setError(
            message === "auth_required"
              ? "다시 로그인해주세요. 미전송 기록은 이 계정에 보존됩니다."
              : "연결 후 다시 동기화합니다. 이 기기의 기록은 보존됩니다.",
          );
        }
      } finally {
        syncing.current = false;
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
        if (user?.email_confirmed_at) {
          try {
            localStorage.setItem("byeolharu_verified_user", user.id);
          } catch {}
          return user;
        }
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
        if (!disposed && id === verification) await switchTo(u);
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
    if (repo.current) downloadBackup(await repo.current.exportBackup());
    else {
      const { captureLegacy } = await import("./migration");
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
    if (!repo.current?.member || !cloud.current) return;
    setBusy(true);
    try {
      const guest = new GuestRepository(samples);
      try {
        await guest.initialize();
        await importGuest(guest, repo.current, cloud.current);
        await sync();
        await refresh();
      } finally {
        guest.close();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "이전 실패. 원본은 보존됩니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  const resolve = async (c: Conflict, local: boolean) => {
    if (!repo.current) return;
    await repo.current.resolve(c, local);
    await refresh();
    await sync();
  };
  const acknowledgeRecovery = async () => {
    if (!repo.current) return;
    await backup();
    if (
      window.confirm(
        "백업한 원본은 보존됩니다. 유효한 행만 사용하고 복구 항목은 백업에 남긴 상태로 이전을 허용할까요?",
      )
    ) {
      await repo.current.acknowledgeRecovery();
      await refresh();
    }
  };
  const restore = async (content: string) => {
    if (!repo.current) return;
    await backup();
    await repo.current.restoreBackup(content);
    await refresh();
    void sync(false);
  };
  const changeTimezone = async (timezone: string) => {
    if (!cloud.current || !repo.current) return;
    const { data, error } = await supabase()
      .from("profiles")
      .select("version")
      .single();
    if (error) throw error;
    await cloud.current.rpc("change_timezone", {
      p_timezone: timezone,
      p_version: data.version,
    });
    await sync();
    await ensureDay();
  };
  const logout = async () => {
    const r = repo.current;
    if (!r?.member) return;
    await sync();
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
    engine.current?.stop();
    setSnapshot(null);
    try {
      localStorage.removeItem("byeolharu_verified_user");
    } catch {}
    await r.clear();
    await supabase().auth.signOut({ scope: "local" });
  };
  return {
    snapshot,
    user,
    error,
    status,
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

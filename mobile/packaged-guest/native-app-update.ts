import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { updateNoticeKey, updateOfferKey, shouldShowUpdateNotice, rememberUpdateOffer, type UpdateInfo, type NativeUpdateControls } from "../../lib/habits/native-app-update";

interface PlayUpdatePlugin {
  check(): Promise<UpdateInfo>;
  start(): Promise<{ status: "started" | "canceled"; versionCode: number }>;
  complete(): Promise<void>;
  addListener(event: "updateChanged", listener: () => void): Promise<PluginListenerHandle>;
}

function readDismissed(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(updateNoticeKey) ?? "[]");
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : [];
  } catch { return []; }
}

export function usePlayAppUpdate(android: boolean): NativeUpdateControls | undefined {
  const plugin = useRef<PlayUpdatePlugin | null>(null);
  const [info, setInfo] = useState<UpdateInfo>({ status: "checking" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const working = useRef(false);
  const pending = useRef(false);
  const active = useRef(false);
  const dismiss = useCallback((offer: string | null) => {
    if (!offer) return;
    setDismissed(previous => {
      const next = rememberUpdateOffer(previous, offer);
      try { localStorage.setItem(updateNoticeKey, JSON.stringify(next)); } catch { /* session dismissal still works */ }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!active.current || !plugin.current) return;
    if (working.current) { pending.current = true; return; }
    working.current = true;
    setBusy(true);
    try {
      do {
        pending.current = false;
        const next = await plugin.current.check().catch((): UpdateInfo => ({ status: "unknown" }));
        if (active.current) setInfo(next);
      } while (active.current && pending.current);
    } finally { working.current = false; if (active.current) setBusy(false); }
  }, []);

  useEffect(() => {
    if (!android) return;
    active.current = true;
    const bridge = registerPlugin<PlayUpdatePlugin>("ByeolharuAppUpdate");
    plugin.current = bridge;
    const updateListener = bridge.addListener("updateChanged", () => void refresh()).catch(() => null);
    const appListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void refresh();
    }).catch(() => null);
    void refresh();
    return () => {
      active.current = false;
      void updateListener.then(handle => handle?.remove()).catch(() => {});
      void appListener.then(handle => handle?.remove()).catch(() => {});
    };
  }, [android, refresh]);

  const offer = updateOfferKey(info);
  const act = useCallback(async () => {
    if (!plugin.current || working.current) return;
    setError(false);
    if (info.status !== "available" && info.status !== "downloaded") {
      setBusy(true);
      try { await refresh(); } finally { setBusy(false); }
      return;
    }
    working.current = true;
    setBusy(true);
    try {
      if (info.status === "available") {
        const result = await plugin.current.start();
        dismiss(updateOfferKey({ status: "available", versionCode: result.versionCode }) ?? offer);
      } else {
        await plugin.current.complete();
      }
    } catch {
      setError(true);
      dismiss(offer);
    } finally {
      working.current = false;
      await refresh();
      setBusy(false);
    }
  }, [info.status, offer, dismiss, refresh]);

  if (!android || info.status === "unavailable" || info.status === "checking") return undefined;
  return { info, busy, error, notice: shouldShowUpdateNotice(info, dismissed), dismiss: () => dismiss(offer), act: () => void act() };
}

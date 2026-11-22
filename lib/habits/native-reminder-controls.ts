import type { Snapshot } from "./repository";

/**
 * Passed only by the bundled Android guest entrypoint.
 * The public website never instantiates native notification controls.
 * A committed snapshot plus verified guest/member identity is the only scheduling source.
 */
export type WrapupGroup = "morning" | "day" | "night";
export type WrapupSettings = Record<WrapupGroup, { enabled: boolean; time: string }>;

export type NativeReminderControls = {
  enabled: boolean;
  active: boolean;
  permissionState: "unknown" | "granted" | "denied";
  busy: boolean;
  status: string;
  /** True only when the native setting and permission request succeeded. */
  onEnabledChange: (next: boolean) => Promise<boolean>;
  onInspectPending: () => Promise<void>;
  onAuditPending: () => Promise<void>;
  onRepairPending: () => Promise<void>;
  /** Local-only, per-device and per-verified-identity alert settings. */
  wrapupSettings: WrapupSettings;
  onWrapupChange: (group: WrapupGroup, patch: { enabled?: boolean; time?: string }) => Promise<boolean>;
  repairAvailable: boolean;
  repairStatus: string;
  auditStatus: string;
  diagnostic: string;
  /** Verified account identity comes from the shared app repository, never raw storage. */
  onSnapshot: (snapshot: Snapshot | null, memberUserId: string | null) => void;
};
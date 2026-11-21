import type { Snapshot } from "./repository";

/**
 * Passed only by the bundled Android guest entrypoint.
 * The public website never instantiates native notification controls.
 * A committed snapshot plus verified guest/member identity is the only scheduling source.
 */
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
  repairAvailable: boolean;
  repairStatus: string;
  auditStatus: string;
  diagnostic: string;
  /** Verified account identity comes from the shared app repository, never raw storage. */
  onSnapshot: (snapshot: Snapshot | null, memberUserId: string | null) => void;
};
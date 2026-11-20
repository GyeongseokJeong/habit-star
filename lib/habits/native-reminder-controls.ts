import type { Snapshot } from "./repository";

/**
 * Passed only by the bundled Android guest entrypoint.
 * The public website never instantiates native notification controls.
 * A committed guest snapshot is the only source of schedule changes.
 */
export type NativeReminderControls = {
  enabled: boolean;
  active: boolean;
  permissionState: "unknown" | "granted" | "denied";
  busy: boolean;
  status: string;
  onEnabledChange: (next: boolean) => Promise<void>;
  onInspectPending: () => Promise<void>;
  onAuditPending: () => Promise<void>;
  onRepairPending: () => Promise<void>;
  repairAvailable: boolean;
  repairStatus: string;
  auditStatus: string;
  diagnostic: string;
  onSnapshot: (snapshot: Snapshot | null) => void;
};
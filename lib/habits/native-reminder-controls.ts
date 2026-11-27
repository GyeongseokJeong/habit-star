import type { Snapshot } from "./repository";
import type { WidgetPracticeCommand, WidgetPracticeResult } from "./widget-practice";

/**
 * Passed only by the bundled Android guest entrypoint.
 * The public website never instantiates native notification controls.
 * A committed snapshot plus verified guest/member identity is the only scheduling source.
 */
export type WrapupGroup = "morning" | "day" | "night";
export type WrapupSettings = Record<WrapupGroup, { enabled: boolean; time: string }>;
export type DisplayPermissionState = "unknown" | "prompt" | "granted" | "denied";
export type ExactPermissionState = "unknown" | "granted" | "denied";
export type ReminderPermissionOffer = "display" | "exact";
export type ReminderPermissionStates = { permissionState: DisplayPermissionState; exactPermission: ExactPermissionState };

export type NativeReminderControls = {
  enabled: boolean;
  active: boolean;
  permissionState: DisplayPermissionState;
  /** Once per installation, only for verified, restored reminder intent. */
  startupPermissionOffer: ReminderPermissionOffer | null;
  onDismissStartupPermissionOffer: () => void;
  onRequestStartupPermission: () => Promise<boolean>;
  /** Read both OS states without requesting permission or opening settings. */
  onCheckPermissions: () => Promise<ReminderPermissionStates>;
  onRequestPermission: () => Promise<boolean>;
  exactPermission: ExactPermissionState;
  onRequestExactPermission: () => Promise<boolean>;
  latencyStatus: string;
  onInspectLatency: () => Promise<void>;
  onDismissPermissionOffer: () => void;
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
  registerWidgetPractice?: (handler: (command: WidgetPracticeCommand, deadline: number) => Promise<WidgetPracticeResult>) => () => void;
};

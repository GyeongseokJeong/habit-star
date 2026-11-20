import type { Snapshot } from "./repository";

/**
 * Passed only by the bundled Android guest entrypoint.
 * The public website never instantiates native notification controls.
 * A committed guest snapshot is the only source of schedule changes.
 */
export type NativeReminderControls = {
  enabled: boolean;
  busy: boolean;
  status: string;
  onEnabledChange: (next: boolean) => Promise<void>;
  onInspectPending: () => Promise<void>;
  diagnostic: string;
  onSnapshot: (snapshot: Snapshot | null) => void;
};

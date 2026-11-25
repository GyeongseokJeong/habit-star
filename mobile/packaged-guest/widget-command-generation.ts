import { openDB } from "idb";
import { validWidgetCommandGeneration, type WidgetCommandGeneration } from "../../lib/habits/widget-command-recovery";

const DB = "byeolharu-widget-command-generation-v1";
const STORE = "generation";
const KEY = "current";

/** One replaceable generation; not a queue, identity store, or authoritative record. */
export async function writeWidgetCommandGeneration(origin: string, value: WidgetCommandGeneration | null): Promise<void> {
  if (origin !== "https://localhost") throw Error("widget_generation_origin");
  if (value && !validWidgetCommandGeneration(value)) throw Error("widget_generation_invalid");
  const db = await openDB(DB, 1, { upgrade(db) { db.createObjectStore(STORE); } });
  try {
    if (value) await db.put(STORE, { nonce: value.nonce, expiresAt: value.expiresAt }, KEY);
    else await db.delete(STORE, KEY);
  } finally { db.close(); }
}

export async function readWidgetCommandGeneration(origin: string, now = Date.now()): Promise<WidgetCommandGeneration | null> {
  if (origin !== "https://localhost") return null;
  // Abort creation if no generation DB exists; a reader never seeds data.
  try {
    const db = await openDB(DB, 1, { upgrade(_db, _old, _new, tx) { tx.abort(); } });
    try {
      const value: unknown = await db.get(STORE, KEY);
      return validWidgetCommandGeneration(value, now) ? { nonce: value.nonce, expiresAt: value.expiresAt } : null;
    } finally { db.close(); }
  } catch { return null; }
}

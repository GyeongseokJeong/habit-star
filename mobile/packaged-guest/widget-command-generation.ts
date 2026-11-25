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
    const db = await openDB(DB, 1, {
      upgrade(_db, _old, _new, tx) {
        // Handle the expected rejection of the aborted upgrade as well as
        // the open request; never create a database on the read path.
        void tx.done.catch(() => {});
        tx.abort();
      },
    });
    try {
      const value: unknown = await db.get(STORE, KEY);
      return validWidgetCommandGeneration(value, now) ? { nonce: value.nonce, expiresAt: value.expiresAt } : null;
    } finally { db.close(); }
  } catch { return null; }
}


// A separate navigation-only secret survives a projection refresh during app
// startup. It never authorizes writes and contains no account or habit data.
const DETAIL_KEY = "detail-secret";
export async function widgetDetailSecret(origin: string, create = false): Promise<string | null> {
  if (origin !== "https://localhost") return null;
  try {
    const db = await openDB(DB, 1, { upgrade(_db, _old, _new, tx) {
      if (!create) { void tx.done.catch(() => {}); tx.abort(); return; }
      _db.createObjectStore(STORE);
    } });
    try {
      const tx = db.transaction(STORE, create ? "readwrite" : "readonly");
      const existing: unknown = await tx.store.get(DETAIL_KEY);
      if (typeof existing === "string" && /^[0-9a-f-]{36}$/.test(existing)) { await tx.done; return existing; }
      if (!create) { await tx.done; return null; }
      const secret = crypto.randomUUID();
      await tx.store.put(secret, DETAIL_KEY);
      await tx.done;
      return secret;
    } finally { db.close(); }
  } catch { return null; }
}

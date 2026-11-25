/** Synthetic same-origin storage capability marker, not a user record. */
export function seedWidgetRuntimeProbe(origin: string, factory: IDBFactory = indexedDB): Promise<boolean> {
  if (origin !== "https://localhost") return Promise.resolve(false);
  return new Promise(resolve => {
    let blocked = false;
    let request: IDBOpenDBRequest;
    try { request = factory.open("byeolharu-widget-runtime-probe-v1", 1); }
    catch { resolve(false); return; }
    request.onblocked = () => { blocked = true; resolve(false); };
    request.onerror = () => resolve(false);
    request.onupgradeneeded = () => {
      if (blocked) { request.transaction?.abort(); return; }
      request.result.createObjectStore("markers");
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      try {
        const tx = db.transaction("markers", "readwrite");
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onabort = () => { db.close(); resolve(false); };
        tx.objectStore("markers").put("ready-v1", "seed");
      } catch { db.close(); resolve(false); }
    };
  });
}

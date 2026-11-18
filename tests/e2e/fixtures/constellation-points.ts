import type { Page } from "@playwright/test";

export async function seedConstellationPoints(page: Page, points: number) {
  await page.evaluate(async (targetPoints) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("byeolharu-v2");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction("scopes", "readwrite");
      const store = tx.objectStore("scopes");
      const state = await new Promise<{ entities: Record<string, unknown> }>((resolve, reject) => {
        const request = store.get("guest");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      for (const key of Object.keys(state.entities)) {
        if (key.includes(":growth-fixture-")) delete state.entities[key];
      }
      for (let index = 1; index <= targetPoints; index += 1) {
        const day = new Date(Date.UTC(2026, 10, 17 - index)).toISOString().slice(0, 10);
        const id = `growth-fixture-${index}`;
        state.entities[`days:${day}:${day}`] = {
          key: `days:${day}:${day}`, kind: "days", id: day, day,
          data: { timezone: "UTC" }, version: 1, deleted: false,
        };
        state.entities[`habit_entries:${day}:${id}`] = {
          key: `habit_entries:${day}:${id}`, kind: "habit_entries", id, day,
          data: { title: "별빛 기록", icon: "", timeGroup: "day", alarmEnabled: false,
            position: 0, completed: true, rating: 0, memo: "" },
          version: 1, deleted: false,
        };
      }
      store.put(state, "guest");
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, points);
  await page.reload();
}

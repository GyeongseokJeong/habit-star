import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const read = p => readFileSync(resolve(root, p), "utf8");

test("Android guest backup exports through user-selected FileProvider destination", () => {
  const exporter = read("mobile/packaged-guest/native-guest-backup.ts");
  const main = read("mobile/packaged-guest/main.tsx");
  const hook = read("lib/habits/use-habit-app.ts");
  const app = read("components/byeolharu.tsx");
  const account = read("components/account/account-panel.tsx");
  assert.match(exporter,/inspectGuestBackup\(content\)/);
  assert.match(exporter,/MAX_GUEST_BACKUP_BYTES/);
  assert.match(exporter,/Directory\.Cache/);
  assert.match(exporter,/Filesystem\.writeFile/);
  assert.match(exporter,/Share\.share/);
  assert.doesNotMatch(exporter,/Directory\.Documents|Directory\.ExternalStorage|SUPABASE|fetch\(/);
  assert.match(main,/nativeBackupExport=\{isAndroid \? exportGuestBackupOnAndroid : undefined\}/);
  assert.match(hook,/nativeBackupExport\?: \(content: string\) => Promise<void>/);
  assert.match(hook,/if \(nativeBackupExport\) await nativeBackupExport\(content\)/);
  assert.match(app,/nativeBackup=\{Boolean\(nativeBackupExport\)\}/);
  assert.match(account,/실제로 저장되었는지 확인해주세요/);
  assert.match(account,/25MB 이하의 별하루 JSON 백업 파일/);
  assert.match(account,/inspectGuestBackup\(content\)/);
  assert.match(account,/window\.confirm\(confirmText\)/);
  // Existing local repository remains the final authority for detailed
  // entity checks and refuses overwriting a nonempty data store.
  const repository = read("lib/habits/repository.ts");
  assert.match(repository,/parsed\.scope !== this\.scope/);
  assert.match(repository,/기록이 없는 같은 계정·새 브라우저에서 복원해주세요/);
  assert.doesNotMatch(read("app/page.tsx"),/Filesystem|Share\.share|nativeBackupExport/);
});

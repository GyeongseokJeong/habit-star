import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  guestBackupFilename,
  memberBackupFilename,
  inspectPortableBackup,
  MAX_GUEST_BACKUP_BYTES,
} from "../../lib/habits/backup-file";

/**
 * A guest or member must explicitly tap Backup, then choose an external destination in
 * Android's share sheet. App Cache is ONLY a temporary FileProvider source:
 * it is neither a durable archive nor an automatic cloud backup.
 */
export async function exportGuestBackupOnAndroid(content: string): Promise<void> {
  const { scope } = inspectPortableBackup(content);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  if (blob.size > MAX_GUEST_BACKUP_BYTES) {
    throw new Error("백업 파일이 너무 큽니다. 기록을 확인해주세요.");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("백업 파일 변환에 실패했습니다."));
        return;
      }
      const offset = reader.result.indexOf(",");
      if (offset < 0) reject(new Error("백업 파일 변환에 실패했습니다."));
      else resolve(reader.result.slice(offset + 1));
    };
    reader.onerror = () => reject(new Error("백업 파일 변환에 실패했습니다."));
    reader.readAsDataURL(blob);
  });
  const filename = scope === "guest" ? guestBackupFilename() : memberBackupFilename();
  await Filesystem.writeFile({ directory: Directory.Cache, path: filename, data });
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
  await Share.share({
    title: scope === "guest" ? "별하루 비회원 기록 백업" : "별하루 회원 기록 백업",
    files: [uri],
    dialogTitle: "백업 파일 저장 또는 공유",
  });
  // Share chooser completion does not prove that a backup reached Files/Drive.
  // UI must ask the user to verify the external file before uninstalling.
}

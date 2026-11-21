import { ANDROID_RETURN_INTENT, RELEASE_RETURN_INTENT } from "@/lib/supabase/android-return";
export function AndroidReturnLink({ release = false }: { release?: boolean }) {
  return <a className="primary full" href={release ? RELEASE_RETURN_INTENT : ANDROID_RETURN_INTENT} referrerPolicy="no-referrer">별하루 앱으로 돌아가기</a>;
}

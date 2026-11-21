import { ANDROID_RETURN_INTENT } from "@/lib/supabase/android-return";
export function AndroidReturnLink() {
  return <a className="primary full" href={ANDROID_RETURN_INTENT} referrerPolicy="no-referrer">별하루 앱으로 돌아가기</a>;
}

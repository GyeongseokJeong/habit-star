/** Navigation only; authentication credentials are never in this URL. */
export const ANDROID_RETURN_URL = "byeolharu-return://auth/return";
export const ANDROID_RETURN_INTENT = "intent://auth/return#Intent;scheme=byeolharu-return;package=io.github.gyeongseokjeong.byeolharu.packagedgueststep9;end";
export const RELEASE_RETURN_INTENT = "intent://auth/return#Intent;scheme=byeolharu-return;package=app.byeolharu.android;end";
export function isAndroidReturnUrl(url: unknown): boolean { return url === ANDROID_RETURN_URL; }

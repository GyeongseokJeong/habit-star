/**
 * Foreground-only best-effort recovery for transient Android scheduling errors.
 * The caller must check permission, current identity/snapshot and visibility.
 * Never requests OS permissions, polls in the background or changes user data.
 */
export async function reconcileWithForegroundRetry({
  sync,
  canRetry,
  wait = () => new Promise(resolve => setTimeout(resolve, 800)),
} = {}) {
  if (typeof sync !== "function" || typeof canRetry !== "function" || typeof wait !== "function") {
    throw new TypeError("Invalid Android reminder recovery adapter");
  }
  try {
    return await sync();
  } catch (initialError) {
    // Never retry a blocked device, disabled reminder or stale account.
    let permitted = false;
    try { permitted = (await canRetry()) === true; }
    catch { /* No retries when state cannot be verified. */ }
    if (!permitted) throw initialError;
    await wait();
    try { permitted = (await canRetry()) === true; }
    catch { permitted = false; }
    if (!permitted) throw initialError;
    // Exactly one retry. Subsequent errors propagate to the existing caller.
    return sync();
  }
}

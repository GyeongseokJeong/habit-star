/** Public support contact only. Never attach a user's email, ID or session. */
export const SUPPORT_EMAIL = "jasset.biz@gmail.com";
export const ACCOUNT_DELETION_SUBJECT = "별하루 계정 삭제 요청";
export const ACCOUNT_DELETION_MAILTO =
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(ACCOUNT_DELETION_SUBJECT)}`;

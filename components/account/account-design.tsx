import type { ReactNode } from "react";

/** Account functional pages share heading hierarchy and spacing. */
export function AccountSectionTitle({ children, className = "" }: {
  children: ReactNode;
  className?: string;
}) {
  return <h3 className={["account-ui-section-title", className].filter(Boolean).join(" ")}>{children}</h3>;
}

import type { ReactNode } from "react";

/** Account functional pages share heading hierarchy and spacing. */
export function AccountSectionTitle({ children, className = "", as: Heading = "h3" }: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return <Heading className={["account-ui-section-title", className].filter(Boolean).join(" ")}>{children}</Heading>;
}

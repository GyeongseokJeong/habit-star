import type { EmailOtpType } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase/server";
import { applicationOrigin, authDestination } from "@/lib/supabase/redirect";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    token_hash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  let origin: string;
  try {
    const production = process.env.NODE_ENV === "production",
      protocol =
        request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1),
      host =
        request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        url.host;
    origin = applicationOrigin(
      process.env.NEXT_PUBLIC_SITE_URL,
      production,
      production ? undefined : `${protocol}://${host}`,
    );
  } catch {
    return new Response("Application URL is not configured", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (
    process.env.NEXT_PUBLIC_CLOUD_ENABLED !== "true" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const response = NextResponse.redirect(
      new URL("/?auth=unavailable", origin),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const client = await serverClient();
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : token_hash && ["signup", "recovery", "email"].includes(type ?? "")
      ? await client.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
      : { error: true };
  const recovery =
    type === "recovery" ||
    ("data" in result &&
      result.data !== null &&
      "redirectType" in result.data &&
      result.data.redirectType === "recovery");
  const target = authDestination(url.searchParams, !!result.error, recovery);
  const response = NextResponse.redirect(new URL(target, origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

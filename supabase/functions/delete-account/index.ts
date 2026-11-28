import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createDeleteAccountHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, authOptions);

Deno.serve(createDeleteAccountHandler({
  async identify(token) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user?.email) return null;
    return { id: user.id, email: user.email, confirmed: Boolean(user.email_confirmed_at) };
  },
  async verifyPassword(email, password) {
    const verifier = createClient(url, anonKey, authOptions);
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "invalid_credentials") return null;
      throw Error("reauthentication_failed");
    }
    if (!data.user) return null;
    // This short-lived reauthentication session is only used for verification.
    // Delete the session on failure/success without touching other devices.
    await verifier.auth.signOut({ scope: "local" });
    return data.user.id;
  },
  async hardDelete(id) {
    const { error } = await admin.auth.admin.deleteUser(id, false);
    return !error;
  },
}));

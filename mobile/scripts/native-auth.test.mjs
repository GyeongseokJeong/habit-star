import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"../..");
const read=p=>readFileSync(resolve(root,p),"utf8");

test("Android ships public Supabase config with isolated persistent local session",()=>{
 const conf=JSON.parse(read("mobile/public-auth-config.json"));
 assert.match(conf.supabaseUrl,/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
 assert.match(conf.supabasePublishableKey,/^sb_publishable_[A-Za-z0-9_-]+$/);
 assert.match(conf.siteOrigin,/^https:\/\/[a-z0-9.-]+$/);
 assert.doesNotMatch(JSON.stringify(conf),/service_role|sb_secret_|refresh_token|password/i);
 const client=read("lib/supabase/client.ts");
 for(const mark of ['NEXT_PUBLIC_ANDROID_PACKAGED_GUEST === "true"','createClient(','storageKey: "byeolharu_android_auth_v1"','persistSession: true','autoRefreshToken: true','detectSessionInUrl: false','createBrowserClient('])
   assert.ok(client.includes(mark), "Missing auth boundary: "+mark);
});
test("Android uses existing website email-confirm redirect and never auto-imports guest records",()=>{
 const form=read("components/account/auth-form.tsx");
 const build=read("mobile/scripts/build-packaged-guest.mjs");
 const hook=read("lib/habits/use-habit-app.ts");
 assert.match(form,/androidPackaged \? process\.env\.NEXT_PUBLIC_SITE_URL!/);
 assert.match(form,/웹 브라우저에서 인증한 뒤 앱에서 로그인해주세요/);
 assert.match(build,/"process\.env\.NEXT_PUBLIC_CLOUD_ENABLED": '"true"'/);
 assert.match(build,/"process\.env\.NEXT_PUBLIC_SITE_URL": JSON\.stringify\(publicAuth\.siteOrigin\)/);
 assert.match(hook,/new MemberRepository\(u\.id\) : new GuestRepository\(samples\)/);
 assert.match(hook,/const migrate = async \(\) =>/);
 assert.doesNotMatch(hook,/if \(u\) await migrate\(/);
 const android=read("mobile/packaged-guest/main.tsx");
 assert.match(android,/identity: identityRef\.current/);
 assert.match(android,/kind: "member", userId: memberUserId, verified: true/);
 assert.match(android,/if \(!next && !memberUserId\) return/);
 assert.match(android,/if \(switched\) void schedule\(false, null\)/);
 const backup=read("mobile/packaged-guest/native-guest-backup.ts");
 assert.match(backup,/inspectPortableBackup\(content\)/);
 assert.match(backup,/memberBackupFilename\(\)/);
});

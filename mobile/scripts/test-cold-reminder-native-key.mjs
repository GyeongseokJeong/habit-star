/** Cross-language identity vectors in a real JVM (JDK 21 in Android CI).
 * No Android mocks, no claim of OS delivery. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildScopedReminderPlan, diffScopedNotifications } from "../notifications/scoped-reminder-runtime.js";
const root=mkdtempSync(join(tmpdir(),"cold-reminder-key-"));
try {
  const policy=readFileSync(new URL("../native/widgets/ByeolharuColdReminderKey.java.template",import.meta.url),"utf8")
    .replaceAll("__PACKAGE__","coldreminder");
  const vectors=[];
  for(const scope of ["guest","member:02db6620-233a-4f39-ba51-923561137db6"])
    for(const timeZone of ["Asia/Seoul","America/New_York"])
      for(const [habitId,title] of [["reading","독서 ✦"],["habit-🪐","하루 🌟 기록"]])
        for(const exact of [false,true]) {
          const day="2026-11-27",now=new Date("2026-11-27T07:00:00Z");
          // NY is 02:00; Seoul is 16:00; both before 20:00.
          const scheduledTime="20:00";
          const plan=buildScopedReminderPlan({day,timeZone,habits:[{id:habitId,title,alarmEnabled:true,scheduledTime,completed:false}]},
            {scope,now,daysAhead:1});
          const n=diffScopedNotifications([],plan,{exact}).schedule[0];
          const args=[scope,habitId,day,title,scheduledTime].map(s=>JSON.stringify(s));
          vectors.push(`check(${args.join(",")},${n.schedule.at.getTime()}L,${exact},${n.id},${JSON.stringify(n.extra.fingerprint)});`);
        }
  writeFileSync(join(root,"ByeolharuColdReminderKey.java"),policy);
  writeFileSync(join(root,"Vectors.java"),`package coldreminder;
public final class Vectors {
  static void check(String scope,String habit,String day,String title,String local,long at,boolean exact,int id,String fp){
    if(ByeolharuColdReminderKey.id(scope,habit,day)!=id ||
      !ByeolharuColdReminderKey.fingerprint(scope,habit,day,title,local,at,exact).equals(fp))
      throw new AssertionError("Cold reminder native identity mismatch");
  }
  public static void main(String[] args){${vectors.join("\n")}}
}`);
  execFileSync("javac",["-encoding","UTF-8","-d",root,join(root,"ByeolharuColdReminderKey.java"),join(root,"Vectors.java")],{stdio:"inherit"});
  execFileSync("java",["-cp",root,"coldreminder.Vectors"],{stdio:"inherit"});
  console.log("PASS: "+vectors.length+" cross-language cold reminder identity vectors");
} finally {rmSync(root,{recursive:true,force:true});}

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

  // Compile the two pure Java canonicality helpers verbatim from the native
  // adapter. This exercises JVM timezone offsets/trim semantics independently
  // of the JS planner without pretending to compile Android framework code.
  const adapter=readFileSync(new URL("../native/widgets/ByeolharuColdReminder.java.template",import.meta.url),"utf8");
  const canonicalHelpers=adapter.match(/(    private static boolean trimSpace\(char c\) \{[\s\S]*?\n    \})[\s\S]*?(    private static boolean firstWallMinute\(long time,TimeZone zone\) \{[\s\S]*?\n    \})/);
  if(!canonicalHelpers)throw Error("Native wall minute/trim helper extraction failed");
  writeFileSync(join(root,"CanonicalVectors.java"),`package coldreminder;
import java.time.Instant;
import java.util.TimeZone;
public final class CanonicalVectors {
${canonicalHelpers[1]}
${canonicalHelpers[2]}
  static void minute(String time,String zone,boolean expected){
    if(firstWallMinute(Instant.parse(time).toEpochMilli(),TimeZone.getTimeZone(zone))!=expected)
      throw new AssertionError("Wall minute canonicality mismatch");
  }
  public static void main(String[] args){
    minute("2026-11-01T05:30:00Z","America/New_York",true);
    minute("2026-11-01T06:30:00Z","America/New_York",false);
    minute("2026-11-01T07:30:00Z","America/New_York",true);
    minute("2026-04-04T14:45:00Z","Australia/Lord_Howe",true);
    minute("2026-04-04T15:15:00Z","Australia/Lord_Howe",false);
    minute("2026-11-27T11:00:00Z","Asia/Seoul",true);
    for(char c:new char[]{9,10,13,32,0x00a0,0x1680,0x2000,0x200a,0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff})
      if(!trimSpace(c))throw new AssertionError("Missing JS trim boundary");
    for(char c:new char[]{0,0x0085,0x180e,0x200b,0x2605,0xac00})
      if(trimSpace(c))throw new AssertionError("Extra JS trim boundary");
  }
}`);
  execFileSync("javac",["-encoding","UTF-8","-d",root,join(root,"CanonicalVectors.java")],{stdio:"inherit"});
  execFileSync("java",["-cp",root,"coldreminder.CanonicalVectors"],{stdio:"inherit"});
  console.log("PASS: native canonical repeated wall-minute and JS trim vectors (isolated helpers)");

  // Real Java worker lifecycle, independent of Android/Capacitor. The
  // application never joins a worker; this isolated test fixture may do so.
  const lease=readFileSync(new URL("../native/widgets/ByeolharuWidgetBridgeLease.java.template",import.meta.url),"utf8")
    .replaceAll("__PACKAGE__","coldreminder");
  writeFileSync(join(root,"ByeolharuWidgetBridgeLease.java"),lease);
  writeFileSync(join(root,"LeaseVectors.java"),`package coldreminder;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
public final class LeaseVectors {
  static void check(ByeolharuWidgetBridgeLease book,String expected){
    String actual=book.state();
    if(!expected.equals(actual))throw new AssertionError("Bridge lease "+actual+" != "+expected);
  }
  static class Worker {
    final CountDownLatch captured=new CountDownLatch(1),stop=new CountDownLatch(1);
    final Thread thread;
    Worker(ByeolharuWidgetBridgeLease book,ByeolharuWidgetBridgeLease.Lease lease) throws Exception {
      thread=new Thread(()->{
        book.workerCaptured(lease,Thread.currentThread()); captured.countDown();
        try{stop.await();}catch(InterruptedException e){Thread.currentThread().interrupt();}
      });
      thread.setDaemon(true);thread.start();
      if(!captured.await(5,TimeUnit.SECONDS))throw new AssertionError("Test worker failed to capture");
    }
    void finish() throws Exception {
      stop.countDown();thread.join(5000);
      if(thread.isAlive())throw new AssertionError("Test worker failed to stop");
    }
  }
  public static void main(String[] args) throws Exception {
    ByeolharuWidgetBridgeLease book=new ByeolharuWidgetBridgeLease();
    check(book,"new-process");
    var first=book.started();var w1=new Worker(book,first);
    check(book,"live-activity");book.destroyed(first);check(book,"worker-draining");
    var second=book.started();var w2=new Worker(book,second);
    check(book,"live-activity");book.destroyed(second);w2.finish();check(book,"worker-draining");
    w1.finish();check(book,"drained-process");
    var late=book.started();book.destroyed(late);check(book,"worker-unknown");
    var w3=new Worker(book,late);check(book,"worker-draining");w3.finish();check(book,"drained-process");
    var failedDestroy=book.started();var w4=new Worker(book,failedDestroy);w4.finish();
    check(book,"live-activity");book.destroyed(failedDestroy);check(book,"drained-process");
    var unknown=book.started();book.destroyed(unknown);
    var later=book.started();var w5=new Worker(book,later);book.destroyed(later);w5.finish();
    check(book,"worker-unknown");
    var ambiguousBook=new ByeolharuWidgetBridgeLease();var ambiguous=ambiguousBook.started();
    var a=new Worker(ambiguousBook,ambiguous);var b=new Worker(ambiguousBook,ambiguous);
    ambiguousBook.destroyed(ambiguous);a.finish();b.finish();check(ambiguousBook,"worker-unknown");
    var invalidBook=new ByeolharuWidgetBridgeLease();var invalid=invalidBook.started();
    invalidBook.workerCaptured(invalid,new Thread());invalidBook.destroyed(invalid);check(invalidBook,"worker-unknown");
  }
}`);
  execFileSync("javac",["-encoding","UTF-8","-d",root,join(root,"ByeolharuWidgetBridgeLease.java"),join(root,"LeaseVectors.java")],{stdio:"inherit"});
  execFileSync("java",["-cp",root,"coldreminder.LeaseVectors"],{stdio:"inherit"});
  console.log("PASS: process-local bridge worker lifecycle vectors (not an Android lifecycle test)");
} finally {rmSync(root,{recursive:true,force:true});}

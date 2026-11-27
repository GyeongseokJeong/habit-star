/** Compile-time evidence only: inspect the installed, compiled dependency
 * from the Debug build. No Android execution, private preference keys, app
 * records, or reflection at runtime. The adapter is compiled separately. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobile = fileURLToPath(new URL("../", import.meta.url));
const moduleDir = resolve(mobile, "node_modules/@capacitor/local-notifications");
const version = JSON.parse(readFileSync(join(moduleDir,"package.json"),"utf8")).version;
assert.equal(version, "8.3.1", "Re-audit cold reminder transport on a notification dependency change");
const gradle = process.env.GRADLE_USER_HOME || join(homedir(), ".gradle");
const roots = [
  join(moduleDir, "android/build"),
  join(gradle, "caches/modules-2/files-2.1/com.capacitorjs/local-notifications", version),
].filter(existsSync);
const files = roots.flatMap(root => readdirSync(root,{recursive:true,withFileTypes:true})
  .filter(f=>f.isFile()).map(f=>join(f.parentPath,f.name)));
const prefix = "com.capacitorjs.plugins.localnotifications.";
const temp = mkdtempSync(join(tmpdir(),"byeolharu-cold-api-"));
const jars = files.filter(f=>f.endsWith(".jar"));
try {
  // The plugin can be built from sources or distributed as a versioned AAR.
  for(const archive of files.filter(f=>f.endsWith(".aar"))) {
    const jar=join(temp,"aar-"+jars.length+".jar");
    writeFileSync(jar,execFileSync("unzip",["-p",archive,"classes.jar"],{maxBuffer:32*1024*1024}));
    jars.push(jar);
  }
  function signatures(name) {
    const entry = prefix.replaceAll(".","/")+name+".class";
    const direct = files.find(f=>f.endsWith("/"+entry));
    if (direct) return execFileSync("javap",["-public","-s",direct],{encoding:"utf8"});
    for (const jar of jars) {
      const entries=execFileSync("jar",["tf",jar],{encoding:"utf8",maxBuffer:16*1024*1024});
      if(entries.split(/\r?\n/).includes(entry)) {
        return execFileSync("javap",["-public","-s","-classpath",jar,prefix+name],{encoding:"utf8"});
      }
    }
    throw Error("Compiled notification API unavailable: "+name);
  }
  const base = "Lcom/capacitorjs/plugins/localnotifications/";
  for (const [name, required] of [
    ["NotificationStorage",[
      ["NotificationStorage(android.content.Context)", "(Landroid/content/Context;)V"],
      ["getSavedNotificationIds()", "()Ljava/util/List;"],
      ["getSavedNotifications()", "()Ljava/util/List;"],
      ["getSavedNotificationAsJSObject(java.lang.String)", "(Ljava/lang/String;)Lcom/getcapacitor/JSObject;"],
      ["appendNotifications(", "(Ljava/util/List;)V"],
    ]],
    ["LocalNotificationManager",[
      ["LocalNotificationManager(", "("+base+"NotificationStorage;Landroid/app/Activity;Landroid/content/Context;Lcom/getcapacitor/CapConfig;)V"],
      ["schedule(com.getcapacitor.PluginCall,", "(Lcom/getcapacitor/PluginCall;Ljava/util/List;)Lorg/json/JSONArray;"],
      ["cancel(com.getcapacitor.PluginCall)", "(Lcom/getcapacitor/PluginCall;)V"],
      ["currentlyVisibleIds()", "()Ljava/util/Set;"],
      ["isCurrentlyScheduled(", "("+base+"LocalNotification;)Z"],
      ["areNotificationsEnabled()", "()Z"],
    ]],
    ["LocalNotification$Companion",[
      ["buildNotificationFromJSObject(com.getcapacitor.JSObject)", "(Lcom/getcapacitor/JSObject;)"+base+"LocalNotification;"],
    ]],
    ["LocalNotification",[
      ["getId()", "()Ljava/lang/Integer;"], ["getExtra()", "()Ljava/lang/Object;"],
      ["getSchedule()", "()"+base+"LocalNotificationSchedule;"], ["isExactNotification()", "()Z"],
      ["getCancelled()", "()Z"],
    ]],
    ["TimedNotificationPublisher",[[ "onReceive(android.content.Context, android.content.Intent)", "(Landroid/content/Context;Landroid/content/Intent;)V"]]],
    ["LocalNotificationSchedule",[
      ["getAt()", "()Ljava/util/Date;"], ["isPerpetual()", "()Z"], ["allowWhileIdle()", "()Z"],
    ]],
  ]) {
    const lines=signatures(name).split("\n");
    for(const [signature,descriptor] of required) {
      const index=lines.findIndex(line=>line.includes(signature));
      assert.ok(index>=0 && lines[index+1]?.trim() === "descriptor: "+descriptor,
        name+": missing JVM method "+signature+" "+descriptor);
      console.log(lines[index].trim()+" "+descriptor);
    }
  }
  console.log("PASS: compiled LocalNotifications 8.3.1 API shape for STEP 4B-2 (not a transport or OS alarm test)");
} finally { rmSync(temp,{recursive:true,force:true}); }

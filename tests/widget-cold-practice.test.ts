import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { LocalRepository } from "../lib/habits/repository";
import { buildWidgetActionProjection } from "../lib/habits/widget-summary";
import { newWidgetCommandGeneration, recoverableWidgetProjection } from "../lib/habits/widget-command-recovery";
import { readWidgetCommandGeneration, writeWidgetCommandGeneration } from "../mobile/packaged-guest/widget-command-generation";
import { coldWidgetIdentity, runColdWidgetPractice } from "../mobile/packaged-guest/widget-cold-practice";
import { SyncEngine, type CloudTransport, type SyncResult } from "../lib/habits/sync";
import type { Entity } from "../lib/habits/domain";
import { planColdWidgetReminder } from "../mobile/notifications/cold-widget-reminder.js";
import { buildScopedReminderPlan, diffScopedNotifications } from "../mobile/notifications/scoped-reminder-runtime.js";
import { HABIT_REMINDER_OPT_IN_KEY, WRAPUP_REMINDER_STORAGE_PREFIX } from "../mobile/packaged-guest/reminder-preferences";
import type { ColdReminderInventory } from "../mobile/packaged-guest/cold-reminder-transport";
import type { toNativeNotification } from "../mobile/notifications/reminder-plan.js";

const origin = "https://localhost";
const auth = "byeolharu_android_auth_v1", verified = "byeolharu_verified_user";
function storage(values: Record<string,string> = {}) { return { getItem: (k:string) => values[k] ?? null }; }
async function setup(member: boolean) {
  const id = member ? crypto.randomUUID() : null;
  const scope = id ? "member:"+id : "guest";
  const r = new LocalRepository(scope, () => [], {getItem:()=>null});
  await r.initialize();
  if (id) { await r.mutate(s=>{s.hydrated=true;});await r.ensureDay(); }
  const habit={id:crypto.randomUUID(),title:"독서",icon:"📚",timeGroup:"night" as const,alarmEnabled:false,completed:false,rating:0,memo:"보존"};
  await r.create(habit);
  // Creating a habit intentionally starts a blank daily entry. Save the
  // existing memo through the ordinary record editor before publishing.
  await r.update(habit.id, { memo: "보존" });
  expect((await r.load()).habits[0]).toMatchObject({ completed: false, rating: 0, memo: "보존" });
  const values:Record<string,string> = id ? {[verified]:id,[auth]:JSON.stringify({user:{id,email_confirmed_at:"2026-01-01"},expires_at:Math.floor(Date.now()/1000)+3600,access_token:"test"})} : {};
  const projection=buildWidgetActionProjection(await r.load(),id);
  const generation=newWidgetCommandGeneration(projection.summary!);
  const recovered=await recoverableWidgetProjection(projection,generation);
  await writeWidgetCommandGeneration(origin,generation);
  return {r,id,values,key:recovered.summary!.rows[0].actionKey!};
}
describe("debug cold widget practice",()=>{
  // Each scenario starts with a genuinely empty fake database. Never purge
  // before the repository has created its schema (openDB without upgrade
  // would otherwise create a version-1 database with no object stores).
  beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("reads a missing generation without creating a database or leaking an abort rejection", async () => {
    expect(await readWidgetCommandGeneration(origin)).toBeNull();
    await vi.waitFor(async () => expect(await indexedDB.databases()).toEqual([]));
  });

  it("rejects a cold request without creating the missing original database", async () => {
    await writeWidgetCommandGeneration(origin, {
      nonce: crypto.randomUUID(), expiresAt: Date.now() + 60000,
    });
    const result = await runColdWidgetPractice({
      origin, actionKey: crypto.randomUUID(), deadline: Date.now() + 7500,
      storage: storage(), nativeAllowed: () => true,
    });
    expect(result.status).not.toBe("saved");
    await vi.waitFor(async () => {
      expect((await indexedDB.databases()).map(db => db.name)).not.toContain("byeolharu-v2");
    });
    // A later ordinary startup can still initialize the correct schema.
    const repo = new LocalRepository("guest", () => [], storage());
    try {
      await repo.initialize();
      expect((await repo.state()).entities).toBeDefined();
    } finally { repo.close(); }
  });
  for (const member of [false,true]) it("commits and undoes through the existing store, member="+member,async()=>{
    const {r,values,key}=await setup(member);
    try{
      const before=await r.state();
      const input={origin,actionKey:key,deadline:Date.now()+7500,storage:storage(values),nativeAllowed:()=>true};
      const result=await runColdWidgetPractice(input);
      expect(result.status).toBe("saved");
      expect((await r.load()).habits[0]).toMatchObject({completed:true,rating:5,memo:"보존"});
      expect((await r.state()).outbox).toHaveLength(before.outbox.length+(member?1:0));
      expect(result.summary?.rows[0].completed).toBe(true);
      expect((await runColdWidgetPractice(input)).status).not.toBe("saved");
      expect((await runColdWidgetPractice({...input,actionKey:result.summary!.rows[0].actionKey!,deadline:Date.now()+7500})).status).toBe("saved");
      expect((await r.load()).habits[0]).toMatchObject({completed:false,rating:0,memo:"보존"});
      expect((await r.state()).outbox).toHaveLength(before.outbox.length+(member?2:0));
    }finally{r.close();await writeWidgetCommandGeneration(origin,null);}
  });
  it("rejects mismatched or expired auth, revoked native guard, stale snapshot and malformed origin without writes",async()=>{
    const {r,values,key}=await setup(true);
    try{
      const before=await r.state();
      const input={origin,actionKey:key,deadline:Date.now()+7500,storage:storage(values),nativeAllowed:()=>true};
      expect((await runColdWidgetPractice({...input,storage:storage({...values,[verified]:crypto.randomUUID()})})).status).toBe("not-ready");
      expect((await runColdWidgetPractice({...input,nativeAllowed:()=>false})).status).toBe("not-ready");
      expect((await runColdWidgetPractice({...input,origin:"https://example.com"})).status).toBe("not-ready");
      expect((await runColdWidgetPractice({...input,deadline:Date.now()-1})).status).toBe("not-ready");
      expect(await r.state()).toEqual(before);
      const habit=(await r.load()).habits[0];
      await r.update(habit.id,{completed:true,rating:3});
      const edited=await r.state();
      expect((await runColdWidgetPractice(input)).status).toBe("stale");
      expect(await r.state()).toEqual(edited);
    }finally{r.close();await writeWidgetCommandGeneration(origin,null);}
  });
  it("reopens committed cold records, retries the same outbox operation after lost acknowledgement, and derives today's reminder plan",async()=>{
    // Control wall clock only: fake IndexedDB still uses real async events.
    vi.useFakeTimers({toFake:["Date"]});
    vi.setSystemTime(new Date(2026,10,25,8,0,0));
    const {r,id,values}=await setup(true);
    let resumed: LocalRepository | undefined;
    try {
      const habit=(await r.load()).habits[0];
      await r.update(habit.id,{alarmEnabled:true,scheduledTime:"20:00"});
      const scope=r.scope;
      // Simulated idempotent cloud transport, not a real Supabase/RLS test.
      const remote=new Map<string,Entity>(), seen=new Map<string,SyncResult>();
      let cursor=0, loseAck=false;
      const attempts:string[]=[];
      const cloud:CloudTransport={
        pull:async()=>({entities:structuredClone([...remote.values()]),cursor,conflicts:[]}),
        apply:async op=>{
          attempts.push(op.id);
          let result=seen.get(op.id);
          if(!result){
            const entities=op.changes.map(c=>({
              key:c.key,kind:c.kind,id:c.id,day:c.day,data:structuredClone(c.data),
              deleted:c.deleted,version:(remote.get(c.key)?.version??0)+1,
            }));
            for(const e of entities) remote.set(e.key,e);
            result={status:"applied",entities,revision:++cursor};
            seen.set(op.id,result);
          }
          if(loseAck){loseAck=false;throw Error("network_unavailable");}
          return structuredClone(result);
        },
      };
      await new SyncEngine(r,cloud).run();
      const before=await r.load();
      expect(before.state.outbox).toEqual([]);
      const plan=(s:typeof before)=>buildScopedReminderPlan(
        {day:s.day,timeZone:s.state.timezone,habits:s.habits},
        {scope,now:new Date(),daysAhead:2,habitOptIn:true},
      );
      const hasToday=(s:typeof before)=>plan(s).notifications.some(n=>n.day===s.day&&n.habitId===habit.id);
      const booked: ReturnType<typeof toNativeNotification>[] = diffScopedNotifications([], plan(before), {exact:true}).schedule;
      const target=booked.find(n=>n.extra.day===before.day&&n.extra.habitId===habit.id)!;
      const inventory=(saved:typeof booked)=>({saved, storedIds:saved.map(n=>n.id), scheduledIds:saved.map(n=>n.id), visibleIds:[]});
      const reminderArgs={memberId:id, optInRaw:"1", wrapupRaw:null, permissionGranted:true, exact:true, now:new Date()};
      expect(hasToday(before)).toBe(true);
      const projected=buildWidgetActionProjection(before,id);
      const generation=newWidgetCommandGeneration(projected.summary!);
      const handles=await recoverableWidgetProjection(projected,generation);
      await writeWidgetCommandGeneration(origin,generation);
      const input={origin,actionKey:handles.summary!.rows[0].actionKey!,deadline:Date.now()+7500,storage:storage(values),nativeAllowed:()=>true};
      r.close();
      const completed=await runColdWidgetPractice(input);
      expect(completed.status).toBe("saved");
      // A new repository instance models the ordinary app reopening.
      resumed=new LocalRepository(scope,()=>[],storage(values));
      await resumed.initialize();
      const after=await resumed.load();
      expect(after.habits[0]).toMatchObject({completed:true,rating:5,memo:"보존"});
      expect(after.state.outbox).toHaveLength(1);
      expect(hasToday(after)).toBe(false);
      // The decision sees the actual committed IndexedDB snapshot, but does
      // not run a native alarm call. Scope/day/revision are from the command.
      const command=[...projected.commands.values()].find(c=>c.habitId===habit.id)!;
      expect(planColdWidgetReminder({...reminderArgs,snapshot:after,command,queue:inventory(booked)}))
        .toEqual({kind:"cancel",expected:target});
      expect(plan(after).notifications.some(n=>n.day!==after.day&&n.habitId===habit.id)).toBe(true);
      const opId=after.state.outbox[0].id;
      loseAck=true;
      await expect(new SyncEngine(resumed,cloud).run()).rejects.toThrow("network_unavailable");
      expect((await resumed.state()).outbox.map(op=>op.id)).toEqual([opId]);
      await new SyncEngine(resumed,cloud).run();
      expect(attempts.filter(x=>x===opId)).toHaveLength(2);
      expect((await resumed.state()).outbox).toEqual([]);
      expect((await resumed.state()).sync?.phase).toBe("succeeded");
      const sent=seen.get(opId);
      expect(sent?.status).toBe("applied");
      expect([...remote.values()].find(e=>e.kind==="habit_entries"&&e.id===habit.id&&e.day===after.day)?.data).toMatchObject({completed:true,rating:5,memo:"보존"});

      // Publish a fresh generation after sync (versions changed) and undo.
      const latest=await resumed.load();
      const undoProjection=buildWidgetActionProjection(latest,id);
      const undoGeneration=newWidgetCommandGeneration(undoProjection.summary!);
      const undoHandles=await recoverableWidgetProjection(undoProjection,undoGeneration);
      await writeWidgetCommandGeneration(origin,undoGeneration);
      resumed.close();resumed=undefined;
      expect((await runColdWidgetPractice({...input,actionKey:undoHandles.summary!.rows[0].actionKey!,deadline:Date.now()+7500})).status).toBe("saved");
      resumed=new LocalRepository(scope,()=>[],storage(values));
      await resumed.initialize();
      const undone=await resumed.load();
      expect(undone.habits[0]).toMatchObject({completed:false,rating:0,memo:"보존"});
      expect(hasToday(undone)).toBe(true);
      const undoCommand=[...undoProjection.commands.values()].find(c=>c.habitId===habit.id)!;
      expect(planColdWidgetReminder({...reminderArgs,snapshot:undone,command:undoCommand,
        queue:inventory(booked.filter(n=>n.id!==target.id))})).toEqual({kind:"restore",notification:target});
      await new SyncEngine(resumed,cloud).run();
      expect((await resumed.state()).outbox).toEqual([]);
      expect([...remote.values()].find(e=>e.kind==="habit_entries"&&e.id===habit.id&&e.day===undone.day)?.data).toMatchObject({completed:false,rating:0,memo:"보존"});
    }finally{
      resumed?.close();r.close();
      await writeWidgetCommandGeneration(origin,null);
      vi.useRealTimers();
    }
  });
  async function setupAlarm(member: boolean) {
    const ctx=await setup(member);
    const before=await ctx.r.load();
    const habit=before.habits[0];
    await ctx.r.update(habit.id,{alarmEnabled:true,scheduledTime:"20:00"});
    const snap=await ctx.r.load();
    const projection=buildWidgetActionProjection(snap,ctx.id);
    const generation=newWidgetCommandGeneration(projection.summary!);
    const recovered=await recoverableWidgetProjection(projection,generation);
    await writeWidgetCommandGeneration(origin,generation);
    const booked:ReturnType<typeof toNativeNotification>[]=diffScopedNotifications([],buildScopedReminderPlan(
      {day:snap.day,timeZone:ctx.id?snap.state.timezone:undefined,habits:snap.habits},
      {scope:ctx.r.scope,now:new Date(),daysAhead:2,habitOptIn:true}),{exact:true}).schedule;
    const target=booked.find(n=>n.extra.day===snap.day)!;
    const inventory=(rows:typeof booked):ColdReminderInventory=>({permissionGranted:true,exact:true,
      queue:{saved:JSON.parse(JSON.stringify(rows)),storedIds:rows.map(n=>n.id),scheduledIds:rows.map(n=>n.id),visibleIds:[]}});
    return {...ctx, key:recovered.summary!.rows[0].actionKey!, habit, snap, booked, target, inventory,generation};
  }

  for(const member of [false,true]) it("runs the request-scoped reminder decision after the real commit, member="+member,async()=>{
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(2026,10,25,8,0,0));
    const f=await setupAlarm(member);
    try {
      const prepare=vi.fn(async (target: {scope:string;habitId:string;day:string;completed:boolean})=>{
        expect(target).toMatchObject({scope:f.r.scope,habitId:f.habit.id,day:f.snap.day,completed:true});
        expect((await f.r.load()).habits[0]).toMatchObject({completed:true,rating:5,memo:"보존"});
        return f.inventory(f.booked);
      });
      const input={origin,actionKey:f.key,deadline:Date.now()+7500,storage:storage(f.values),nativeAllowed:()=>true};
      const saved=await runColdWidgetPractice({...input,reminderTransport:{prepare}});
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(saved.status).toBe("saved");
      expect(saved.summary?.rows[0].completed).toBe(true);
      expect(saved.alarm).toEqual({kind:"cancel",expected:f.target});
      const restore=vi.fn(async()=>f.inventory(f.booked.filter(n=>n.id!==f.target.id)));
      const undone=await runColdWidgetPractice({...input,actionKey:saved.summary!.rows[0].actionKey!,
        reminderTransport:{prepare:restore}});
      expect(restore).toHaveBeenCalledTimes(1);
      expect(undone.status).toBe("saved");
      expect(undone.summary?.rows[0].completed).toBe(false);
      expect(undone.alarm).toEqual({kind:"restore",notification:f.target});
      expect((await f.r.load()).habits[0]).toMatchObject({completed:false,rating:0,memo:"보존"});
      expect((await f.r.state()).outbox).toHaveLength(f.snap.state.outbox.length+(member?2:0));
    }finally{f.r.close();await writeWidgetCommandGeneration(origin,null);vi.useRealTimers();}
  });

  for(const failure of ["transport","preferences","generation","revision","transport-race","owner","permission","opt-out"]) it("keeps a committed record separate from reminder "+failure,async()=>{
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(2026,10,25,8,0,0));
    const f=await setupAlarm(true);
    try {
      if(failure==="opt-out") f.values[HABIT_REMINDER_OPT_IN_KEY]="0";
      const prepare=vi.fn(async()=>{
        if(failure==="transport")throw Error("native_unavailable");
        if(failure==="preferences") f.values[WRAPUP_REMINDER_STORAGE_PREFIX+f.r.scope]=JSON.stringify({night:{enabled:true,time:"22:00"}});
        if(failure==="generation") await writeWidgetCommandGeneration(origin,f.generation);
        if(failure==="revision"||failure==="transport-race") await f.r.update(f.habit.id,{memo:"변경"});
        if(failure==="transport-race") throw Error("native_unavailable");
        if(failure==="owner") f.values[verified]=crypto.randomUUID();
        const inv=f.inventory(f.booked);
        if(failure==="permission") inv.permissionGranted=false;
        return inv;
      });
      const result=await runColdWidgetPractice({origin,actionKey:f.key,deadline:Date.now()+7500,
        storage:storage(f.values),nativeAllowed:()=>true,reminderTransport:{prepare}});
      expect(result.status).toBe("saved");
      expect((await f.r.load()).habits[0]).toMatchObject({completed:true,rating:5,memo:(failure==="revision"||failure==="transport-race")?"변경":"보존"});
      expect((await f.r.state()).outbox).toHaveLength(f.snap.state.outbox.length+((failure==="revision"||failure==="transport-race")?2:1));
      if(failure==="opt-out") {
        expect(prepare).not.toHaveBeenCalled();
        expect(result.alarm).toEqual({kind:"noop",reason:"opted-out-or-unconfigured"});
      }else if(failure==="owner"){
        expect(result.summary).toBeUndefined();
        expect(result.alarm).toBeUndefined();
      }else if(failure==="generation"||failure==="revision"||failure==="transport-race"){
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(result.summary).toBeUndefined();
        expect(result.alarm).toEqual({kind:"defer",reason:"stale-commit"});
      }else{
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(result.summary?.rows[0].completed).toBe(true);
        expect(result.alarm?.kind).toBe("defer");
      }
    }finally{f.r.close();await writeWidgetCommandGeneration(origin,null);vi.useRealTimers();}
  });

  it("never guesses guest from partial or corrupt session",()=>{
    const id=crypto.randomUUID();
    expect(coldWidgetIdentity(storage())?.memberId).toBeNull();
    expect(coldWidgetIdentity(storage({[verified]:id}))).toBeNull();
    expect(coldWidgetIdentity(storage({[auth]:"bad"}))).toBeNull();
    expect(coldWidgetIdentity(storage({[verified]:id,[auth]:JSON.stringify({user:{id,email_confirmed_at:"yes"},expires_at:1,access_token:"test"})}))).toBeNull();
  });
});

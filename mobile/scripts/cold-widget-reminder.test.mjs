import test from "node:test";
import assert from "node:assert/strict";
import { planColdWidgetReminder } from "../notifications/cold-widget-reminder.js";
import { buildScopedReminderPlan, diffScopedNotifications } from "../notifications/scoped-reminder-runtime.js";
import { localDayKey } from "../notifications/reminder-plan.js";

const now = new Date("2026-11-27T08:00:00+09:00");
const memberId = "alice", scope = "member:alice", day = "2026-11-27";
const habit = { id:"reading", title:"독서", alarmEnabled:true, scheduledTime:"20:00", timeGroup:"night", completed:false, rating:0 };
const other = { ...habit, id:"walking", title:"산책" };
function state(h, revision=8) {
  return { hydrated:true, timezone:"Asia/Seoul", localRevision:revision,
    entities:{ entry:{kind:"habit_entries",id:h.id,day,deleted:false,version:4,data:{completed:h.completed,rating:h.rating}} } };
}
function input(completed, extra={}) {
  const h={...habit,completed,rating:completed?5:0};
  return { memberId, now, optInRaw:"1", wrapupRaw:null, permissionGranted:true, exact:true,
    snapshot:{day,habits:[h,other],history:{[day]:[h,other]},state:state(h)},
    command:{scope,day,habitId:h.id,revision:7,version:4,expectedCompleted:!completed,expectedRating:completed?0:5,completed},
    queue:queue([]), ...extra };
}
function queue(saved, scheduledIds=saved.map(n=>n.id), visibleIds=[]) {
  return {saved,storedIds:saved.map(n=>n.id),scheduledIds,visibleIds};
}
function planned(exact=true) {
  const p=buildScopedReminderPlan({day,timeZone:"Asia/Seoul",habits:[habit,other]}, {scope,now,daysAhead:2});
  return diffScopedNotifications([],p,{exact}).schedule;
}
const all=planned();
const target=all.find(n=>n.extra.day===day&&n.extra.habitId===habit.id);
const ordinary=planned(false).find(n=>n.id===target.id);
const untouched=all.filter(n=>n.id!==target.id);

test("completion selects only its current-day owned reservation; other days/scopes/wrapups excluded",()=>{
  const wrapup={id:73,extra:{kind:target.extra.kind,scope,day,category:"wrapup"}};
  const foreign={id:74,extra:{...target.extra,scope:"member:bob"}};
  for (const savedTarget of [target,ordinary]) {
    const inventory=queue([savedTarget,...untouched,wrapup,foreign]);
    const copy=structuredClone(inventory);
    const result=planColdWidgetReminder(input(true,{queue:inventory}));
    assert.deepEqual(result,{kind:"cancel",expected:savedTarget});
    assert.deepEqual(inventory,copy);
  }
  assert.equal(planColdWidgetReminder(input(true,{queue:queue(untouched)})).kind,"noop");
  const stored=JSON.parse(JSON.stringify(target)); // plugin's original ISO date payload
  assert.deepEqual(planColdWidgetReminder(input(true,{queue:queue([stored,...untouched])})),
    {kind:"cancel",expected:target});
});
test("undo restores exactly the canonical future payload and respects exact/inexact policy",()=>{
  assert.deepEqual(planColdWidgetReminder(input(false,{queue:queue(untouched)})),{kind:"restore",notification:target});
  assert.deepEqual(planColdWidgetReminder(input(false,{queue:queue(untouched),exact:false})),{kind:"restore",notification:ordinary});
  assert.equal(planColdWidgetReminder(input(false,{queue:queue(all)})).kind,"noop");
  assert.equal(planColdWidgetReminder(input(false,{queue:queue([ordinary,...untouched])})).kind,"defer");
});
function edited(completed,scheduledTime,extra={}) {
  const b=input(completed,extra);
  b.snapshot.habits[0]={...b.snapshot.habits[0],title:"새 독서 시간",scheduledTime};
  b.snapshot.history[day]=b.snapshot.habits;
  return b;
}
test("completion cancels the previous canonical title/time even when the latest time has passed",()=>{
  for(const scheduledTime of ["19:00","07:00"]) for(const saved of [target,ordinary]) {
    const raw=JSON.parse(JSON.stringify(saved));
    const b=edited(true,scheduledTime,{queue:queue([raw,...untouched])});
    const copy=structuredClone(b.queue);
    assert.deepEqual(planColdWidgetReminder(b),{kind:"cancel",expected:saved});
    assert.deepEqual(b.queue,copy);
  }
  assert.deepEqual(planColdWidgetReminder(edited(true,"07:00",{queue:queue(untouched)})),
    {kind:"noop",reason:"already-absent"});
});
test("undo never restores an earlier setting, including a previous reservation later today",()=>{
  const oldQueue=queue([target,...untouched]);
  assert.deepEqual(planColdWidgetReminder(edited(false,"21:00",{queue:oldQueue})),{kind:"defer",reason:"occupied-id"});
  const b=edited(false,"21:00",{queue:queue(untouched)});
  const expected=diffScopedNotifications([],buildScopedReminderPlan({day,timeZone:"Asia/Seoul",habits:b.snapshot.habits},
    {scope,now,daysAhead:1}),{exact:true}).schedule.find(n=>n.id===target.id);
  assert.notEqual(expected.extra.fingerprint,target.extra.fingerprint);
  assert.deepEqual(planColdWidgetReminder(b),{kind:"restore",notification:expected});
  assert.deepEqual(planColdWidgetReminder(edited(false,"07:00",{queue:oldQueue})),{kind:"noop",reason:"no-future-target"});
});
test("a previous schedule never permits opaque, modified, visible, foreign or unproven payload cancellation",()=>{
  for(const bad of [
    {...target,extra:{...target.extra,scope:"member:bob"}},
    {...target,extra:{...target.extra,habitId:"other"}},
    {...target,extra:{...target.extra,fingerprint:"old"}},
    {...target,extra:{...target.extra,arbitrary:true}},
    {...target,schedule:{...target.schedule,at:"2026-11-27T11:00:01.000Z"}},
    {...target,schedule:{...target.schedule,repeats:null}},
    {...target,schedule:{...target.schedule,arbitrary:true}},
    {...target,title:target.title+" "}, {...target,sound:"other"}, {...target,cancelled:null}, {id:target.id},
  ]) assert.deepEqual(planColdWidgetReminder(edited(true,"07:00",{queue:queue([bad])})),
    {kind:"defer",reason:"occupied-id"});
  for(const inventory of [queue([target],[]),queue([target],[target.id],[target.id]),
    {...queue([]),scheduledIds:[target.id]}]) assert.equal(planColdWidgetReminder(edited(true,"07:00",{queue:inventory})).kind,"defer");
  assert.deepEqual(planColdWidgetReminder(edited(true,"07:00",{queue:queue([target]),permissionGranted:false})),
    {kind:"defer",reason:"permission-unconfirmed"});
  assert.deepEqual(planColdWidgetReminder(edited(true,"07:00",{queue:queue([target]),optInRaw:"0"})),
    {kind:"noop",reason:"opted-out-or-unconfigured"});
});
test("no changes for other owners, same-id different category/day, unexpected fingerprint, visible or stored-only IDs",()=>{
  for(const bad of [
    {...target,extra:{...target.extra,scope:"member:bob"}},
    {...target,extra:{...target.extra,category:"wrapup"}},
    {...target,extra:{...target.extra,day:"2026-11-28"}},
    {...target,extra:{...target.extra,habitId:"other"}},
    {...target,extra:{...target.extra,fingerprint:"old"}},
    {...target,extra:{...target.extra,kind:"other"}},
    {...target,schedule:{...target.schedule,at:new Date("2026-12-01T11:00:00Z")}},
    {...target,schedule:{...target.schedule,repeats:true}},
    {...target,schedule:{...target.schedule,allowWhileIdle:false}},
    {...target,isExactNotification:false},
    {...target,channelId:"foreign"}, {...target,title:"wrong"}, {...target,cancelled:true},
  ]) for(const completed of [true,false])
    assert.equal(planColdWidgetReminder(input(completed,{queue:queue([bad])})).kind,"defer");
  for(const inventory of [queue([target],[],[target.id]),queue([target],[]),queue([],[],[target.id]),
      {...queue([]),storedIds:[target.id]}, queue([target,target]), {...queue([]),scheduledIds:[target.id]}])
    for(const completed of [true,false])
      assert.equal(planColdWidgetReminder(input(completed,{queue:inventory})).kind,"defer");
});
test("only an exact post-commit day, scope, revision, entry version and target state can plan",()=>{
  const base=input(false);
  for(const command of [{...base.command,scope:"guest"},{...base.command,revision:8},{...base.command,version:3},
    {...base.command,day:"2026-11-26"},{...base.command,completed:true},{...base.command,expectedRating:3}])
    assert.equal(planColdWidgetReminder({...base,command}).kind,"defer");
  for(const snapshot of [{...base.snapshot,history:{}},
    {...base.snapshot,state:{...base.snapshot.state,hydrated:false}},
    {...base.snapshot,state:{...base.snapshot.state,localRevision:9}},
    {...base.snapshot,habits:[]},
    {...base.snapshot,habits:[{...habit,rating:3},other]},
    {...base.snapshot,state:{...base.snapshot.state,entities:{entry:{...base.snapshot.state.entities.entry,data:{completed:false,rating:3}}}}},
    {...base.snapshot,state:{...base.snapshot.state,entities:{}}}])
    assert.equal(planColdWidgetReminder({...base,snapshot}).kind,"defer");
  assert.equal(planColdWidgetReminder({...base,now:new Date("2026-11-28T00:01:00+09:00")}).kind,"defer");
});
test("guest uses device day; members use account timezone",()=>{
  const instant=new Date("2026-11-27T00:01:00+09:00");
  const guestNow=new Date(2026,10,27,8,0);
  const d=localDayKey(guestNow);
  const b=input(false,{memberId:null,now:guestNow});
  b.command={...b.command,scope:"guest",day:d};
  b.snapshot={...b.snapshot,day:d,history:{[d]:b.snapshot.habits},
    state:{...b.snapshot.state,hydrated:false,entities:{entry:{...b.snapshot.state.entities.entry,day:d}}}};
  assert.equal(planColdWidgetReminder(b).kind,"restore");
  const m=input(false,{now:instant});
  assert.equal(planColdWidgetReminder(m).kind,"restore");
});
test("prefs/OS permission and time are fail closed; do not create past/near-due alarms",()=>{
  for(const completed of [true,false]){
    assert.equal(planColdWidgetReminder(input(completed,{optInRaw:"0"})).kind,"noop");
    assert.equal(planColdWidgetReminder(input(completed,{optInRaw:"garbled"})).kind,"defer");
    assert.equal(planColdWidgetReminder(input(completed,{wrapupRaw:"bad"})).kind,"defer");
    assert.equal(planColdWidgetReminder(input(completed,{wrapupRaw:JSON.stringify({night:{enabled:true,time:"bad"}})})).kind,"defer");
    assert.equal(planColdWidgetReminder(input(completed,{permissionGranted:false})).kind,"defer");
    assert.equal(planColdWidgetReminder(input(completed,{exact:undefined})).kind,"defer");
    assert.equal(planColdWidgetReminder(input(completed,{now:new Date("2026-11-27T20:01:00+09:00")})).kind,"noop");
  }
  assert.equal(planColdWidgetReminder(input(false,{optInRaw:null})).kind,"restore");
  assert.equal(planColdWidgetReminder(input(false,{now:new Date("2026-11-27T19:59:59+09:00")})).kind,"defer");
  assert.deepEqual(planColdWidgetReminder(input(true,{now:new Date("2026-11-27T19:59:59+09:00"),queue:queue([target])})),
    {kind:"defer",reason:"too-close"});
});
test("capacity and rolling plan priority never evict another reservation",()=>{
  assert.equal(planColdWidgetReminder(input(false,{queue:queue(Array.from({length:48},(_,i)=>({id:i+1})))})).kind,"defer");
  const b=input(false); b.snapshot.habits=[...Array.from({length:49},(_,i)=>({...other,id:"other-"+i,scheduledTime:"10:00"})),habit];
  assert.equal(planColdWidgetReminder(b).kind,"defer");
});
test("wrap-up is never modified by the single-habit decision",()=>{
  const b=input(true,{wrapupRaw:JSON.stringify({night:{enabled:true,time:"22:00"}})});
  const p=buildScopedReminderPlan({day,timeZone:"Asia/Seoul",habits:[habit,other]}, {scope,now,daysAhead:2,wrapupSettings:{night:{enabled:true,time:"22:00"}}});
  b.queue=queue(diffScopedNotifications([],p,{exact:true}).schedule);
  assert.deepEqual(planColdWidgetReminder(b),{kind:"cancel",expected:target});
});

test("member DST gap is not restored to a different clock minute",()=>{
  const b=input(false,{now:new Date("2027-03-14T00:30:00-05:00")});
  const d="2027-03-14";
  const h={...habit,scheduledTime:"02:30"};
  b.command={...b.command,day:d};
  b.snapshot={...b.snapshot,day:d,habits:[h],history:{[d]:[h]},
    state:{...state(h),timezone:"America/New_York",entities:{entry:{...state(h).entities.entry,day:d}}}};
  assert.deepEqual(planColdWidgetReminder(b),{kind:"noop",reason:"no-future-target"});
});

test("completion accepts only the canonical earlier instant of a repeated member wall minute",()=>{
  const d="2027-11-07", timeZone="America/New_York";
  const n=new Date("2027-11-07T00:00:00-04:00");
  const h={...habit,completed:true,rating:5,scheduledTime:"04:00",title:"변경된 독서"};
  const b=input(true,{now:n});
  b.command={...b.command,day:d};
  b.snapshot={...b.snapshot,day:d,habits:[h],history:{[d]:[h]},
    state:{...state(h),timezone:timeZone,entities:{entry:{...state(h).entities.entry,day:d}}}};
  const first=diffScopedNotifications([],buildScopedReminderPlan({day:d,timeZone,habits:[{...habit,scheduledTime:"01:30"}]},
    {scope,now:n,daysAhead:1}),{exact:true}).schedule[0];
  assert.equal(first.schedule.at.toISOString(),"2027-11-07T05:30:00.000Z");
  assert.deepEqual(planColdWidgetReminder({...b,queue:queue([first])}),{kind:"cancel",expected:first});
  const at=new Date("2027-11-07T06:30:00.000Z");
  const second={...first,schedule:{...first.schedule,at},extra:{...first.extra,
    fingerprint:first.extra.fingerprint.replace(String(first.schedule.at.getTime()),String(at.getTime()))}};
  assert.deepEqual(planColdWidgetReminder({...b,queue:queue([second])}),{kind:"defer",reason:"occupied-id"});
});

import { describe, expect, it } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import { buildWidgetActionProjection } from "../lib/habits/widget-summary";
import { newWidgetCommandGeneration, recoverableWidgetProjection } from "../lib/habits/widget-command-recovery";
import { writeWidgetCommandGeneration } from "../mobile/packaged-guest/widget-command-generation";
import { coldWidgetIdentity, runColdWidgetPractice } from "../mobile/packaged-guest/widget-cold-practice";

const origin = "https://localhost";
const auth = "byeolharu_android_auth_v1", verified = "byeolharu_verified_user";
function storage(values: Record<string,string> = {}) { return { getItem: (k:string) => values[k] ?? null }; }
async function setup(member: boolean) {
  const id = member ? crypto.randomUUID() : null;
  const scope = id ? "member:"+id : "guest";
  if (!id) await LocalRepository.purgeScope(scope);
  const r = new LocalRepository(scope, () => [], {getItem:()=>null});
  await r.initialize();
  if (id) { await r.mutate(s=>{s.hydrated=true;});await r.ensureDay(); }
  const habit={id:crypto.randomUUID(),title:"독서",icon:"📚",timeGroup:"night" as const,alarmEnabled:false,completed:false,rating:0,memo:"보존"};
  await r.create(habit);
  const values:Record<string,string> = id ? {[verified]:id,[auth]:JSON.stringify({user:{id,email_confirmed_at:"2026-01-01"},expires_at:Math.floor(Date.now()/1000)+3600,access_token:"test"})} : {};
  const projection=buildWidgetActionProjection(await r.load(),id);
  const generation=newWidgetCommandGeneration(projection.summary!);
  const recovered=await recoverableWidgetProjection(projection,generation);
  await writeWidgetCommandGeneration(origin,generation);
  return {r,id,values,key:recovered.summary!.rows[0].actionKey!};
}
describe("debug cold widget practice",()=>{
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
  it("never guesses guest from partial or corrupt session",()=>{
    const id=crypto.randomUUID();
    expect(coldWidgetIdentity(storage())?.memberId).toBeNull();
    expect(coldWidgetIdentity(storage({[verified]:id}))).toBeNull();
    expect(coldWidgetIdentity(storage({[auth]:"bad"}))).toBeNull();
    expect(coldWidgetIdentity(storage({[verified]:id,[auth]:JSON.stringify({user:{id,email_confirmed_at:"yes"},expires_at:1,access_token:"test"})}))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import { buildWidgetActionProjection } from "../lib/habits/widget-summary";
import { attachWidgetDetailKeys, resolveWidgetDetailKey } from "../lib/habits/widget-detail-navigation";
import { resolveHabitReminder } from "../lib/habits/reminder-navigation";
import { widgetDetailSecret, writeWidgetCommandGeneration } from "../mobile/packaged-guest/widget-command-generation";

describe("widget detail navigation",()=>{
  it("opens protected/completed habits by opaque navigation key, independent of rating and publication",async()=>{
    const id=crypto.randomUUID(), r=new LocalRepository("member:"+id,()=>[],{getItem:()=>null});
    try {
      await r.initialize();await r.mutate(s=>{s.hydrated=true;});await r.ensureDay();
      const habit={id:crypto.randomUUID(),title:"독서",icon:"📚",timeGroup:"night" as const,alarmEnabled:false,completed:false,rating:0,memo:""};
      await r.create(habit);
      const secret=(await widgetDetailSecret("https://localhost",true))!;
      const original=await r.load();
      const first=await attachWidgetDetailKeys(buildWidgetActionProjection(original,id).summary!,original,id,secret);
      const key=first.rows[0].detailKey!;
      expect(key).toBeTruthy();
      expect(key).not.toBe(first.rows[0].actionKey);
      expect(JSON.stringify(first)).not.toContain(habit.id);
      expect(JSON.stringify(first)).not.toContain(id);
      await writeWidgetCommandGeneration("https://localhost",null);
      expect(await widgetDetailSecret("https://localhost")).toBe(secret);
      await r.update(habit.id,{completed:true,rating:3,memo:"private"});
      const snapshot=await r.load(), before=await r.state();
      const projection=buildWidgetActionProjection(snapshot,id);
      expect(projection.commands.size).toBe(0);
      const updated=await attachWidgetDetailKeys(projection.summary!,snapshot,id,secret);
      expect(updated.rows[0].detailKey).toBe(key);
      const target=await resolveWidgetDetailKey(snapshot,id,secret,key);
      expect(target).toEqual({scope:"member:"+id,day:snapshot.day,habitId:habit.id});
      const ctx={snapshot,memberId:id,habits:snapshot.habits,now:new Date(),blocked:false};
      expect(resolveHabitReminder(target!,ctx).kind).toBe("ignore");
      expect(resolveHabitReminder({...target!,source:"widget"},ctx).kind).toBe("open");
      expect(resolveHabitReminder({...target!,source:"widget"},{...ctx,blocked:true}).kind).toBe("ignore");
      expect(await resolveWidgetDetailKey(snapshot,crypto.randomUUID(),secret,key)).toBeNull();
      expect(await resolveWidgetDetailKey(snapshot,id,crypto.randomUUID(),key)).toBeNull();
      expect(await resolveWidgetDetailKey(snapshot,id,secret,first.rows[0].actionKey!)).toBeNull();
      expect(await resolveWidgetDetailKey(snapshot,id,secret,key,new Date(first.expiresAt))).toBeNull();
      expect(await r.state()).toEqual(before);
      await r.remove(habit.id);
      expect(await resolveWidgetDetailKey(await r.load(),id,secret,key)).toBeNull();
    } finally {r.close();}
  });
});

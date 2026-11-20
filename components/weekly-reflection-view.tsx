import { ArrowLeft, ArrowRight, CalendarDays, Sparkles, Star } from "lucide-react";
import { StarlitClosingFooter } from "@/components/starlit-closing-footer";
import { summarizeTodayRecovery, type WeeklyReflection } from "@/lib/habits/weekly-reflection";

function shortDate(day: string) {
  const [, month, date] = day.split("-").map(Number);
  return `${month}월 ${date}일`;
}

function nextDateLabel(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getUTCDay()];
  return `${shortDate(day)}(${weekday})`;
}

export function WeeklyReflectionView({
  reflection,
  onBack,
  onRecord,
}: {
  reflection: WeeklyReflection | null;
  onBack: () => void;
  onRecord: (habitId: string) => void;
}) {
  const recovery = reflection?.status === "restart"
    ? summarizeTodayRecovery(reflection.recommendations)
    : null;
  return (
    <section className="weekly-reflection" aria-label="최근 7일 돌아보기">
      <div className="weekly-reflection-header">
        <button type="button" id="weekly-reflection-back" className="weekly-reflection-back" aria-label="달력으로 돌아가기" onClick={onBack}>
          <ArrowLeft size={19} aria-hidden="true" />
          <span>달력으로</span>
        </button>
        <h1>최근 7일 돌아보기</h1>
        <p>{reflection ? `${shortDate(reflection.startDay)} – ${shortDate(reflection.endDay)}` : "기록을 살펴보고 있어요"}</p>
      </div>

      {!reflection ? (
        <div className="weekly-reflection-empty" role="status">최근 기록을 준비하고 있어요.</div>
      ) : reflection.status === "insufficient" ? (
        <div className="weekly-reflection-empty" role="status">
          <Sparkles size={22} aria-hidden="true" />
          <h2>조금 더 기록이 쌓이면 알려드릴게요.</h2>
          <p>아직은 습관의 흐름을 판단하기 어려워요. 오늘의 작은 실천부터 이어가 봐요.</p>
        </div>
      ) : reflection.status === "restart" ? (
        <>
          <div className="weekly-reflection-intro">
            <h2>{recovery?.allCompletedToday ? "✨ 오늘도 다시 이어갔어요" : "🌱 다시 이어갈 습관"}</h2>
            <p>{recovery?.allCompletedToday
              ? "오늘의 실천을 기록했어요. 작은 시작이 이어지고 있어요."
              : "작은 실천부터 다시 시작해 봐요."}</p>
          </div>
          <div className="weekly-reflection-list">
            {recovery?.ordered.map((habit) => (
              <article key={habit.id} className="weekly-reflection-card">
                <div className="weekly-reflection-card-top">
                  <span className="weekly-reflection-emoji" aria-hidden="true">{habit.icon}</span>
                  <div className="weekly-reflection-card-info">
                    <h3>{habit.title}</h3>
                    <p>확인된 예정일 {habit.observedDays}일 · 완료 기록 {habit.completedDays}일</p>
                  </div>
                </div>
                <div className="weekly-reflection-card-bottom">
                  {habit.todayScheduled && !habit.todayCompleted ? (
                    <>
                      <span><CalendarDays size={15} aria-hidden="true" /> 오늘 예정</span>
                      <button type="button" className="weekly-reflection-record" onClick={() => onRecord(habit.id)}>
                        오늘 기록하기 <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : habit.todayScheduled && habit.todayCompleted ? (
                    <span><Star size={16} aria-hidden="true" /> 오늘 다시 이어갔어요.</span>
                  ) : habit.nextScheduledDay ? (
                    <span><CalendarDays size={15} aria-hidden="true" /> 다음 예정일 · {nextDateLabel(habit.nextScheduledDay)}</span>
                  ) : (
                    <span>다음 실천을 준비하고 있어요.</span>
                  )}
                </div>
              </article>
            ))}
          </div>
          {reflection.encouragingHabit && (
            <p className="weekly-reflection-encouragement">
              <Star size={18} aria-hidden="true" />
              {reflection.encouragingHabit.title}은 꾸준히 이어가고 있어요.
            </p>
          )}
        </>
      ) : (
        <div className="weekly-reflection-empty" role="status">
          <Sparkles size={22} aria-hidden="true" />
          <h2>{reflection.status === "steady" ? "꾸준히 이어가고 있어요. ✨" : "나만의 속도로 이어가 봐요."}</h2>
          <p>{reflection.status === "steady"
            ? `${reflection.encouragingHabit?.title ?? "작은 습관"}에서 꾸준한 실천이 보여요.`
            : "최근 기록에서 특별히 추천할 습관은 없어요. 다음 작은 실천도 응원할게요."}</p>
        </div>
      )}
      {reflection && <StarlitClosingFooter kind="reflection" />}
    </section>
  );
}

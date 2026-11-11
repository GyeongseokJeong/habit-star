"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flame,
  LayoutGrid,
  Leaf,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Target,
  Trash2,
  X,
} from "lucide-react";

import {
  type Habit,
  type TimeGroup,
  type History,
  dateKey,
  isScheduled,
  stats,
} from "@/lib/habits/domain";
import { useHabitApp } from "@/lib/habits/use-habit-app";
import { AccountPanel } from "@/components/account/account-panel";
import { StarlitHero } from "@/components/starlit-hero";
export type { Habit, TimeGroup } from "@/lib/habits/domain";
type Tab = "all" | TimeGroup | "matrix";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const GROUPS = {
  morning: {
    name: "아침",
    icon: Sunrise,
    greeting: "지금은 상쾌한 아침 루틴 시간이에요",
    range: "05:00 – 11:00",
  },
  day: {
    name: "낮",
    icon: Sun,
    greeting: "지금은 활기찬 낮 루틴 시간이에요",
    range: "11:00 – 17:00",
  },
  night: {
    name: "밤",
    icon: Moon,
    greeting: "지금은 차분한 저녁 루틴 시간이에요",
    range: "17:00 – 05:00",
  },
};
const CAPTIONS = [
  "오늘의 실천은 어땠나요?",
  "조금 아쉬웠어요",
  "시작한 것만으로도 좋아요",
  "꾸준히, 잘 해냈어요",
  "뿌듯한 실천이었어요",
  "완벽한 몰입 & 최고!",
];
const EMOJIS = [
  "💧",
  "🏃‍♂️",
  "🥗",
  "📚",
  "🧘‍♂️",
  "✍️",
  "💪",
  "🌱",
  "🎨",
  "💻",
  "🛏️",
  "🎵",
];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const REPEAT_PRESETS = [
  { label: "매일", days: WEEKDAYS },
  { label: "평일", days: WEEKDAYS.slice(0, 5) },
  { label: "주말", days: WEEKDAYS.slice(5) },
];
const HABIT_TEMPLATES: { title: string; icon: string; timeGroup: TimeGroup }[] =
  [
    { title: "독서 20분", icon: "📚", timeGroup: "night" },
    { title: "가벼운 운동", icon: "🏃", timeGroup: "morning" },
    { title: "물 마시기", icon: "💧", timeGroup: "morning" },
    { title: "스트레칭", icon: "🧘", timeGroup: "night" },
    { title: "일찍 잠들기", icon: "🌙", timeGroup: "night" },
    { title: "하루 기록하기", icon: "✍️", timeGroup: "night" },
  ];
const uid = () => crypto.randomUUID();
const timeGroup = (date: Date): TimeGroup =>
  date.getHours() >= 5 && date.getHours() < 11
    ? "morning"
    : date.getHours() >= 11 && date.getHours() < 17
      ? "day"
      : "night";
const initialHabits = (): Habit[] =>
  [
    {
      title: "미온수 한 잔 & 영양제",
      icon: "💧",
      timeGroup: "morning",
      scheduledTime: "07:00",
      alarmEnabled: true,
      completed: true,
      rating: 5,
      memo: "일어나자마자 상쾌하게 비타민 충전",
    },
    {
      title: "아침 가벼운 러닝 20분",
      icon: "🏃‍♂️",
      timeGroup: "morning",
      scheduledTime: "07:30",
      alarmEnabled: true,
      completed: true,
      rating: 4,
      memo: "날씨 쌀쌀했지만 2.2km 완주",
    },
    {
      title: "건강한 점심 & 가벼운 산책",
      icon: "🥗",
      timeGroup: "day",
      scheduledTime: "12:30",
      alarmEnabled: true,
      completed: true,
      rating: 4,
      memo: "과식 안 하고 15분 햇볕 쬐기",
    },
    {
      title: "독서 30분 & TOP 50 책장",
      icon: "📚",
      timeGroup: "night",
      scheduledTime: "21:30",
      alarmEnabled: true,
      completed: false,
      rating: 0,
      memo: "",
    },
    {
      title: "취침 전 스트레칭 10분",
      icon: "🧘‍♂️",
      timeGroup: "night",
      scheduledTime: "22:30",
      alarmEnabled: true,
      completed: false,
      rating: 0,
      memo: "",
    },
  ].map((h) => ({ ...h, id: uid() }) as Habit);
export function StarRating({
  rating,
  onRate,
  onSelect,
  label,
  large = false,
}: {
  rating: number;
  onRate?: (rating: number) => void;
  onSelect?: (value: number) => void;
  label: string;
  large?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div
      className={`star-tray ${large ? "large" : ""}`}
      role="group"
      aria-label={`${label} 별점`}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} ${value}점`}
          aria-pressed={rating === value}
          onMouseEnter={() => setHover(value)}
          onFocus={() => setHover(value)}
          onBlur={() => setHover(0)}
          onClick={(event) => {
            event.stopPropagation();
            if (onSelect) onSelect(value);
            else onRate?.(rating === value ? 0 : value);
          }}
          className={(hover || rating) >= value ? "star filled" : "star"}
        >
          <Star strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = original;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-top">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function ReminderToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="alarm-field">
      <span>
        <Bell size={16} /> 루틴 알림
      </span>
      <span className="toggle-control">
        <input
          type="checkbox"
          className="toggle-input"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
      </span>
    </label>
  );
}

function HabitEditor({
  habit,
  defaultGroup,
  today,
  onSave,
  onDelete,
  onClose,
}: {
  habit?: Habit;
  defaultGroup: TimeGroup;
  today: string;
  onSave: (draft: Omit<Habit, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Omit<Habit, "id">>(() =>
    habit
      ? { ...habit }
      : {
          title: "",
          icon: "🌱",
          timeGroup: defaultGroup,
          scheduledTime: "",
          repeatDays: [...WEEKDAYS],
          alarmEnabled: false,
          completed: false,
          rating: 0,
          memo: "",
        },
  );
  return (
    <Modal
      title={habit ? "습관 수정하기" : "나를 위한 새로운 습관"}
      onClose={onClose}
    >
      <p className="modal-description">
        작은 실천부터, 나만의 속도로 시작해요.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.title.trim())
            onSave({
              ...draft,
              title: draft.title.trim(),
              scheduledTime: draft.scheduledTime || undefined,
            });
        }}
      >
        {!habit && (
          <fieldset className="template-field">
            <legend>바로 시작하기</legend>
            <div className="template-picker">
              {HABIT_TEMPLATES.map((template) => (
                <button
                  type="button"
                  key={template.title}
                  aria-label={`${template.title} 템플릿`}
                  aria-pressed={
                    draft.title === template.title &&
                    draft.icon === template.icon &&
                    draft.timeGroup === template.timeGroup &&
                    WEEKDAYS.every((day) =>
                      (draft.repeatDays ?? WEEKDAYS).includes(day),
                    )
                  }
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      title: template.title,
                      icon: template.icon,
                      timeGroup: template.timeGroup,
                      repeatDays: [...WEEKDAYS],
                    }))
                  }
                >
                  <span aria-hidden="true">{template.icon}</span>
                  {template.title}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>습관 아이콘</legend>
          <div className="emoji-picker">
            {[...new Set([draft.icon, ...EMOJIS])].map((icon) => (
              <button
                type="button"
                key={icon}
                aria-label={`${icon} 아이콘`}
                aria-pressed={draft.icon === icon}
                className={draft.icon === icon ? "selected" : ""}
                onClick={() => setDraft((prev) => ({ ...prev, icon }))}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          습관 이름
          <input
            autoFocus
            required
            maxLength={80}
            placeholder="예: 하루 10분 책 읽기"
            value={draft.title}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, title: e.target.value }))
            }
          />
        </label>
        <fieldset>
          <legend>실천 시간대</legend>
          <div className="segmented">
            {(Object.keys(GROUPS) as TimeGroup[]).map((group) => {
              const Icon = GROUPS[group].icon;
              return (
                <button
                  type="button"
                  className={draft.timeGroup === group ? "selected" : ""}
                  key={group}
                  aria-pressed={draft.timeGroup === group}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, timeGroup: group }))
                  }
                >
                  <Icon size={17} />
                  {GROUPS[group].name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>반복 요일</legend>
          <div className="segmented repeat-presets">
            {REPEAT_PRESETS.map(({ label, days }) => (
              <button
                type="button"
                key={label}
                className={
                  WEEKDAYS.filter((day) =>
                    (draft.repeatDays ?? WEEKDAYS).includes(day),
                  ).join() === days.join()
                    ? "selected"
                    : ""
                }
                aria-pressed={
                  WEEKDAYS.filter((day) =>
                    (draft.repeatDays ?? WEEKDAYS).includes(day),
                  ).join() === days.join()
                }
                onClick={() =>
                  setDraft((prev) => ({ ...prev, repeatDays: [...days] }))
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="repeat-weekdays"
            role="group"
            aria-label="반복할 요일"
          >
            {WEEKDAYS.map((day, index) => (
              <button
                type="button"
                key={day}
                className={
                  (draft.repeatDays ?? WEEKDAYS).includes(day) ? "selected" : ""
                }
                aria-label={`${["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"][index]}`}
                aria-pressed={(draft.repeatDays ?? WEEKDAYS).includes(day)}
                onClick={() =>
                  setDraft((prev) => {
                    const selected = prev.repeatDays ?? WEEKDAYS;
                    const next = selected.includes(day)
                      ? selected.filter((value) => value !== day)
                      : WEEKDAYS.filter(
                          (value) => selected.includes(value) || value === day,
                        );
                    return next.length ? { ...prev, repeatDays: next } : prev;
                  })
                }
              >
                {["월", "화", "수", "목", "금", "토", "일"][index]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-row">
          <label className="field">
            예정 시간
            <input
              type="time"
              value={draft.scheduledTime || ""}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, scheduledTime: e.target.value }))
              }
            />
          </label>
          <ReminderToggle
            checked={draft.alarmEnabled}
            onChange={(alarmEnabled) =>
              setDraft((prev) => ({ ...prev, alarmEnabled }))
            }
          />
        </div>
        {habit && isScheduled(draft as Habit, today) && (
          <>
            <fieldset>
              <legend>오늘의 별점</legend>
              <StarRating
                label="수정"
                rating={draft.rating}
                onRate={(rating) =>
                  setDraft((prev) => ({
                    ...prev,
                    rating,
                    completed: rating > 0,
                  }))
                }
              />
            </fieldset>
            <label className="field">
              짧은 기록
              <textarea
                maxLength={500}
                rows={3}
                value={draft.memo}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, memo: e.target.value }))
                }
              />
            </label>
          </>
        )}
        <button type="submit" className="primary full">
          <Check size={18} />
          {habit ? "수정 완료" : "새 습관 추가하기"}
        </button>
        <button type="button" className="text-button full" onClick={onClose}>
          취소
        </button>
        {onDelete &&
          (confirmDelete ? (
            <div
              className="delete-confirmation"
              role="group"
              aria-label="습관 삭제 확인"
            >
              <p>이 습관을 삭제할까요? 이전 날짜의 기록은 그대로 남아요.</p>
              <div className="form-row">
                <button
                  type="button"
                  className="secondary full"
                  onClick={() => setConfirmDelete(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="delete-button"
                  onClick={onDelete}
                >
                  <Trash2 size={16} />
                  삭제 확인
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="delete-button"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />이 습관 삭제하기
            </button>
          ))}
      </form>
    </Modal>
  );
}

function HabitDetail({
  habit,
  onSave,
  onClose,
}: {
  habit: Habit;
  onSave: (data: Partial<Habit>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(habit);
  return (
    <Modal title="오늘의 실천 기록" onClose={onClose}>
      <div className="detail-heading">
        <span className={`habit-emoji ${habit.timeGroup}`}>{habit.icon}</span>
        <h3>{habit.title}</h3>
        <p>결과보다, 오늘 실천의 순간을 기억해요.</p>
      </div>
      <StarRating
        label="상세"
        rating={draft.rating}
        large
        onRate={(rating) => setDraft((prev) => ({ ...prev, rating }))}
      />
      <p className="rating-caption">{CAPTIONS[draft.rating]}</p>
      <fieldset>
        <legend>어떤 순간이었나요?</legend>
        <div className="keyword-chips">
          {[
            "몰입도 100%",
            "피로 극복",
            "뿌듯함",
            "상쾌한 시작",
            "조금 지침",
          ].map((word) => (
            <button
              type="button"
              key={word}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  memo: (prev.memo + (prev.memo ? " · " : "") + word).slice(
                    0,
                    500,
                  ),
                }))
              }
            >
              + {word}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        나에게 남기는 한 줄
        <textarea
          placeholder="오늘의 느낌을 가볍게 남겨보세요."
          rows={3}
          maxLength={500}
          value={draft.memo}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, memo: e.target.value }))
          }
        />
      </label>
      <div className="form-row">
        <label className="field">
          예정 시간
          <input
            type="time"
            value={draft.scheduledTime || ""}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, scheduledTime: e.target.value }))
            }
          />
        </label>
        <ReminderToggle
          checked={draft.alarmEnabled}
          onChange={(alarmEnabled) =>
            setDraft((prev) => ({ ...prev, alarmEnabled }))
          }
        />
      </div>
      <button
        className="primary full"
        onClick={() =>
          onSave({
            rating: draft.rating,
            completed: draft.rating > 0,
            memo: draft.memo,
            scheduledTime: draft.scheduledTime || undefined,
            alarmEnabled: draft.alarmEnabled,
          })
        }
      >
        <Star size={17} />
        별점 저장
      </button>
      <button
        className="text-button full"
        onClick={() =>
          onSave({
            completed: true,
            rating: 0,
            memo: draft.memo,
            scheduledTime: draft.scheduledTime || undefined,
            alarmEnabled: draft.alarmEnabled,
          })
        }
      >
        <Check size={17} />
        단순 체크만 하기
      </button>
    </Modal>
  );
}

function HabitCard({
  habit,
  onRate,
  onOpen,
  onEdit,
  onAlarm,
}: {
  habit: Habit;
  onRate: (id: string, rating: number) => void;
  onOpen: () => void;
  onEdit: () => void;
  onAlarm: () => void;
}) {
  return (
    <article className={`habit-card ${habit.completed ? "is-completed" : ""}`}>
      <div className="card-top">
        <span className={`habit-emoji ${habit.timeGroup}`}>{habit.icon}</span>
        <div className="card-actions">
          <span className={`status-pill ${habit.completed ? "done" : ""}`}>
            {habit.completed ? (
              <>
                <Check size={11} />
                실천 완료
              </>
            ) : (
              "실천 전"
            )}
          </span>
          <button
            className="icon-button small"
            aria-label={`${habit.title} 수정`}
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
      <button className="card-content" onClick={onOpen}>
        <h3>{habit.title}</h3>
        {habit.memo && <p>{habit.memo}</p>}
        <span className="time-badge">
          <Clock3 size={12} />
          {habit.scheduledTime || "자유롭게"}
          <span className="time-divider" />
          {GROUPS[habit.timeGroup].name} 루틴
        </span>
      </button>
      <div className="card-rating">
        <StarRating
          label={habit.title}
          rating={habit.rating}
          onSelect={(value) => onRate(habit.id, value)}
        />
        <span className="rating-number">
          {habit.rating ? (
            <>
              <b>{habit.rating.toFixed(1)}</b>
              <span> / 5</span>
            </>
          ) : (
            <span>미기록</span>
          )}
        </span>
        <button
          className={`icon-button small alarm ${habit.alarmEnabled ? "enabled" : ""}`}
          aria-label={`${habit.title} 알림 ${habit.alarmEnabled ? "끄기" : "켜기"}`}
          aria-pressed={habit.alarmEnabled}
          onClick={(event) => {
            event.stopPropagation();
            onAlarm();
          }}
        >
          {habit.alarmEnabled ? <Bell size={15} /> : <BellOff size={15} />}
        </button>
      </div>
    </article>
  );
}

function MonthlyMatrix({
  month,
  onMonthChange,
  today,
  history,
  onDate,
}: {
  month: Date;
  onMonthChange: (date: Date) => void;
  today: string;
  history: History;
  onDate: (key: string) => void;
}) {
  const year = month.getFullYear(),
    index = month.getMonth();
  const count = new Date(year, index + 1, 0).getDate(),
    offset = new Date(year, index, 1).getDay();
  const records = Object.entries(history).filter(([key]) =>
    key.startsWith(`${year}-${String(index + 1).padStart(2, "0")}`),
  );
  const recordedDays = records.filter(([day, habits]) =>
    habits.some((h) => h.completed && isScheduled(h, day)),
  ).length;
  const ratings = records.flatMap(([day, habits]) =>
    habits
      .filter((h) => isScheduled(h, day) && h.rating > 0)
      .map((h) => h.rating),
  );
  return (
    <section className="panel matrix-panel expanded">
      <div className="section-label">
        <span>
          <LayoutGrid size={16} />
          별점 매트릭스
        </span>
        <span className="tiny-label">MY LITTLE GALAXY</span>
      </div>
      <div className="calendar-heading">
        <h3>
          {year}년 <strong>{index + 1}월</strong>
        </h3>
        <div className="flex gap-1">
          <button
            className="icon-button small"
            aria-label="이전 달"
            onClick={() => onMonthChange(new Date(year, index - 1, 1))}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-button small"
            aria-label="다음 달"
            onClick={() => onMonthChange(new Date(year, index + 1, 1))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid weekday">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid days">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const key = dateKey(new Date(year, index, i + 1));
          const score = stats(history[key] || [], key).average;
          return (
            <button
              key={key}
              disabled={key > today}
              aria-label={`${index + 1}월 ${i + 1}일${key === today ? " 오늘" : ""}, ${score ? `평균 ${score.toFixed(1)}점` : "별점 기록 없음"}`}
              className={`day-tile tier-${Math.ceil(score)} ${key === today ? "today" : ""}`}
              onClick={() => onDate(key)}
            >
              {i + 1}
              {key === today && <span className="today-dot" />}
            </button>
          );
        })}
      </div>
      <div className="matrix-legend">
        <span>아직은 작은 별</span>
        <div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`tier-${i}`} />
          ))}
        </div>
        <span>빛나는 하루</span>
      </div>
      <div className="calendar-summary">
        <div>
          <span>이번 달 기록</span>
          <b>
            {recordedDays}
            <small>일</small>
          </b>
        </div>
        <div>
          <span>평균 별점</span>
          <b className="gold">
            <Star size={15} fill="currentColor" />
            {ratings.length
              ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
              : "—"}
          </b>
        </div>
      </div>
      <p className="calendar-footnote">하나의 별이 모여, 나만의 우주가 돼요.</p>
    </section>
  );
}

export default function Byeolharu() {
  const app = useHabitApp(initialHabits);
  const habits = app.snapshot?.habits ?? [];
  const history = app.snapshot?.history ?? {};
  const ready = !!app.snapshot;
  const setHabits = app.setHabits;
  const [accountOpen, setAccountOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [month, setMonth] = useState(new Date(2026, 10, 1));
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [notification, setNotification] = useState<Habit | null>(null);
  const [notificationMenu, setNotificationMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [pastDate, setPastDate] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [testPending, setTestPending] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [ratingOverrides, setRatingOverrides] = useState<
    Map<string, { rating: number; scope: string; day: string }>
  >(new Map());
  const ratingOverridesRef = useRef(ratingOverrides);
  const [heldCompletion, setHeldCompletion] = useState<Map<string, boolean>>(
    new Map(),
  );
  const heldCompletionRef = useRef(heldCompletion);
  const ratingWrites = useRef(new Map<string, Promise<void>>());
  const reorderTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const scope = app.user?.id ?? "guest";
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const audio = useRef<AudioContext | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(new Set<string>());
  const currentDay = useRef("");
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    const date = new Date();
    const key = dateKey(date);
    try {
      if (
        (localStorage.getItem("byeolharu_v2_theme") ??
          localStorage.getItem("byeolharu_v1_theme")) === "dark"
      )
        setTheme("dark");
    } catch {
      setStorageWarning(true);
    }
    currentDay.current = key;
    setNow(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setActiveTab("all");
    const clock = setInterval(() => setNow(new Date()), 1000);
    const install = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", install);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(clock);
      window.removeEventListener("beforeinstallprompt", install);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (testTimer.current) clearTimeout(testTimer.current);
      for (const timer of reorderTimers.current.values()) clearTimeout(timer);
      reorderTimers.current.clear();
      void audio.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    themeColor?.setAttribute(
      "content",
      theme === "light" ? "#F7F6F2" : "#0C111B",
    );
    try {
      localStorage.setItem("byeolharu_v2_theme", theme);
    } catch {
      setStorageWarning(true);
    }
  }, [theme, ready]);

  const chime = useCallback(() => {
    try {
      if (!audio.current) audio.current = new AudioContext();
      const ctx = audio.current;
      void ctx.resume();
      [659.25, 830.61].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + index * 0.2;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 1.3);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 1.4);
      });
    } catch {
      /* Audio may be unavailable until the first user gesture. The visual reminder still works. */
    }
  }, []);

  useEffect(() => {
    if (!ready || !now) return;
    const actualDay = dateKey(
      now,
      app.user ? app.snapshot?.state.timezone : undefined,
    );
    if (actualDay !== app.snapshot?.day) {
      void app.ensureDay().catch(() => setStorageWarning(true));
      return;
    }
    const day = app.snapshot?.day ?? actualDay;
    if (day !== currentDay.current) {
      currentDay.current = day;
      fired.current.clear();
      return;
    }
    const time = app.user
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: app.snapshot?.state.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(now)
      : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const due = habits.find(
      (h) =>
        h.alarmEnabled &&
        isScheduled(h, day) &&
        !h.completed &&
        h.scheduledTime === time &&
        !fired.current.has(`${day}-${h.id}-${time}`),
    );
    if (due) {
      fired.current.add(`${day}-${due.id}-${time}`);
      setNotification(due);
      chime();
    }
  }, [now, habits, ready, chime]);

  const handleRateHabit = (id: string, value: number) => {
    const habit = habits.find((item) => item.id === id);
    const day = app.snapshot?.day;
    if (!habit || !day) return;
    const previous = ratingOverridesRef.current.get(id);
    const current =
      previous?.scope === scope && previous.day === day
        ? previous.rating
        : habit.rating;
    const rating = current === value ? 0 : value;
    const override = { rating, scope, day };
    const nextOverrides = new Map(ratingOverridesRef.current);
    nextOverrides.set(id, override);
    ratingOverridesRef.current = nextOverrides;
    setRatingOverrides(nextOverrides);

    if (!heldCompletionRef.current.has(id)) {
      const nextHeld = new Map(heldCompletionRef.current);
      nextHeld.set(id, habit.completed);
      heldCompletionRef.current = nextHeld;
      setHeldCompletion(nextHeld);
    }
    const priorTimer = reorderTimers.current.get(id);
    if (priorTimer) clearTimeout(priorTimer);
    reorderTimers.current.set(
      id,
      setTimeout(() => {
        const nextHeld = new Map(heldCompletionRef.current);
        nextHeld.delete(id);
        heldCompletionRef.current = nextHeld;
        setHeldCompletion(nextHeld);
        reorderTimers.current.delete(id);
      }, 700),
    );

    const previousWrite = ratingWrites.current.get(id) ?? Promise.resolve();
    const write = previousWrite
      .catch(() => {})
      .then(async () => {
        if (activeScope.current !== scope) return;
        await setHabits((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, rating, completed: rating > 0 } : item,
          ),
        );
      });
    ratingWrites.current.set(id, write);
    void write
      .catch(() => {})
      .finally(() => {
        if (ratingWrites.current.get(id) !== write) return;
        ratingWrites.current.delete(id);
        if (ratingOverridesRef.current.get(id) !== override) return;
        const next = new Map(ratingOverridesRef.current);
        next.delete(id);
        ratingOverridesRef.current = next;
        setRatingOverrides(next);
      });
  };
  const handleSave = async (data: Omit<Habit, "id">) => {
    if (editing === "new") {
      const newHabit: Habit = {
        ...data,
        id: uid(),
        title: data.title.trim(),
        completed: false,
        rating: 0,
        memo: "",
      };
      await setHabits((prev) => [...prev, newHabit]);
      setActiveTab("all");
      showToast(`✦ '${newHabit.title}' 습관이 추가되었습니다!`);
    } else if (editing) {
      const id = editing.id;
      await setHabits((prev) =>
        prev.map((h) => (String(h.id) === String(id) ? { ...h, ...data } : h)),
      );
      showToast("✦ 습관이 수정되었습니다!");
    }
    setEditing(null);
  };
  const handleDelete = async () => {
    if (!editing || editing === "new") return;
    const id = editing.id;
    await setHabits((prev) => prev.filter((h) => String(h.id) !== String(id)));
    setEditing(null);
    showToast("습관이 삭제되었습니다.");
  };
  const today = app.snapshot?.day ?? "";
  const visibleHabits = habits.map((habit) => {
    const override = ratingOverrides.get(habit.id);
    return override?.scope === scope && override.day === today
      ? { ...habit, rating: override.rating, completed: override.rating > 0 }
      : habit;
  });
  const scheduledHabits = today
    ? visibleHabits.filter((h) => isScheduled(h, today))
    : [];
  const restingHabits = today
    ? visibleHabits.filter((h) => !isScheduled(h, today))
    : [];
  const summary = stats(visibleHabits, today);
  const allHistory = {
    ...history,
    ...(today ? { [today]: visibleHabits } : {}),
  };
  const displayNow =
    now && app.user
      ? new Date(
          now.toLocaleString("en-US", {
            timeZone: app.snapshot?.state.timezone,
          }),
        )
      : now;
  const group = displayNow ? timeGroup(displayNow) : "day";
  const detail = visibleHabits.find((h) => h.id === detailId);
  const filtered = scheduledHabits
    .filter(
      (h) =>
        activeTab === "all" ||
        activeTab === "matrix" ||
        h.timeGroup === activeTab,
    )
    .sort(
      (a, b) =>
        Number(heldCompletion.get(a.id) ?? a.completed) -
        Number(heldCompletion.get(b.id) ?? b.completed),
    );
  const upcoming =
    activeTab !== "all" && activeTab !== "matrix"
      ? scheduledHabits
          .filter(
            (h) =>
              h.timeGroup ===
              (activeTab === "morning"
                ? "day"
                : activeTab === "day"
                  ? "night"
                  : "morning"),
          )
          .sort(
            (a, b) =>
              Number(heldCompletion.get(a.id) ?? a.completed) -
              Number(heldCompletion.get(b.id) ?? b.completed),
          )
      : [];
  let streak = 0;
  if (now) {
    const day = new Date(`${today}T12:00:00`);
    if (!summary.completed) day.setDate(day.getDate() - 1);
    for (let i = 0; i < 3660; i++) {
      if (
        !allHistory[dateKey(day)]?.some(
          (h) => h.completed && isScheduled(h, dateKey(day)),
        )
      )
        break;
      streak++;
      day.setDate(day.getDate() - 1);
    }
  }
  const renderCard = (habit: Habit) => (
    <HabitCard
      key={habit.id}
      habit={habit}
      onRate={handleRateHabit}
      onOpen={() => setDetailId(habit.id)}
      onEdit={() => setEditing(habit)}
      onAlarm={() => {
        void (async () => {
          await setHabits((prev) =>
            prev.map((h) =>
              h.id === habit.id ? { ...h, alarmEnabled: !h.alarmEnabled } : h,
            ),
          );
          if (!habit.alarmEnabled) {
            try {
              if (!audio.current) audio.current = new AudioContext();
              void audio.current.resume();
            } catch {}
          }
          showToast(
            habit.alarmEnabled
              ? "루틴 알림을 껐어요."
              : "루틴 알림을 켰어요. 앱을 열어두면 알려드릴게요.",
          );
        })().catch(() => {});
      }}
    />
  );

  return (
    <div className={`byeolharu ${theme}`}>
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="/" className="brand" aria-label="별하루 홈">
            <span className="brand-symbol">
              <Sparkles size={25} strokeWidth={1.8} />
            </span>
            <span>
              별하루<small>BYEOLHARU</small>
            </span>
          </a>
          <nav className="desktop-nav" aria-label="주 메뉴">
            <button
              className={activeTab !== "matrix" ? "active" : ""}
              onClick={() => setActiveTab("all")}
            >
              <Sun size={16} />
              오늘의 루틴
            </button>
            <button
              className={activeTab === "matrix" ? "active" : ""}
              onClick={() => setActiveTab("matrix")}
            >
              <LayoutGrid size={16} />
              나의 별 기록
            </button>
          </nav>
          <div className="header-actions">
            <span className="saved-label">
              <span className={storageWarning ? "warning-dot" : "saved-dot"} />
              {storageWarning ? "저장 확인 필요" : app.status}
            </span>
            <div className="notification-wrap">
              <button
                className={`icon-button ${notificationMenu ? "active" : ""}`}
                aria-expanded={notificationMenu}
                aria-label="알림 메뉴"
                onClick={() => setNotificationMenu((prev) => !prev)}
              >
                <Bell size={19} />
                <span className="bell-dot" />
              </button>
              {notificationMenu && (
                <div className="notification-menu">
                  <h3>
                    <Bell size={16} />
                    루틴 알림
                  </h3>
                  <p>
                    예정된 시간에 작은 실천을 알려드려요.
                    <br />
                    앱을 열어둔 동안 알림이 울려요.
                  </p>
                  <button
                    className="secondary full"
                    disabled={testPending || !scheduledHabits.length}
                    onClick={() => {
                      try {
                        if (!audio.current) audio.current = new AudioContext();
                        void audio.current.resume();
                      } catch {}
                      setTestPending(true);
                      testTimer.current = setTimeout(() => {
                        setNotification(
                          scheduledHabits.find((h) => !h.completed) ||
                            scheduledHabits[0],
                        );
                        chime();
                        setTestPending(false);
                        setNotificationMenu(false);
                      }, 3000);
                    }}
                  >
                    {testPending
                      ? "잠시 후 알림이 도착해요…"
                      : "3초 뒤 테스트 알림 발송"}
                  </button>
                  <small>첫 클릭으로 알림 소리가 활성화됩니다.</small>
                </div>
              )}
            </div>
            <button
              className="icon-button"
              aria-label={
                theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"
              }
              onClick={() =>
                setTheme((prev) => (prev === "light" ? "dark" : "light"))
              }
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <span className="header-divider" />
            <button
              className="avatar"
              aria-label="계정 및 데이터 관리"
              onClick={() => setAccountOpen(true)}
            >
              나
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="main-container">
        <div className="page-intro">
          <div>
            <p className="eyebrow">
              {now
                ? now.toLocaleDateString("ko-KR", {
                    timeZone: app.user
                      ? app.snapshot?.state.timezone
                      : undefined,
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })
                : "오늘의 하루를 준비해요"}
            </p>
            <h1>
              오늘도, 나답게 빛나는 하루 <Sparkles size={25} />
            </h1>
            <p className="intro-subtitle">
              완벽하지 않아도 괜찮아요. 작은 실천 하나면 충분해요.
            </p>
          </div>
        </div>
        <StarlitHero
          completed={summary.completed}
          total={scheduledHabits.length}
        />
        <section className="metrics" aria-label="오늘의 통계">
          <div className="metric completion-metric">
            <div className="metric-label">
              <span>
                <Target size={15} />
                실천율
              </span>
            </div>
            <div className="metric-value">
              {summary.rate}
              <span>%</span>
              <span className="progress-track">
                <span style={{ width: `${summary.rate}%` }} />
              </span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <CheckCheck size={16} />
                실천한 습관
              </span>
            </div>
            <div className="metric-value">
              {summary.completed}
              <span className="muted">/ {scheduledHabits.length}</span>
              <small>개 완료</small>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <Star size={15} />
                평균 별점
              </span>
            </div>
            <div className="metric-value">
              <Star className="metric-star" size={26} fill="currentColor" />
              {summary.average ? summary.average.toFixed(1) : "—"}
              <span className="muted">/ 5.0</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <Flame size={15} />
                연속 실천
              </span>
            </div>
            <div className="metric-value">
              {streak}
              <span>일</span>
            </div>
          </div>
        </section>
        <div className="dashboard-layout">
          <section className="routine-section" aria-label="습관 목록">
            <div className="routine-heading">
              <h2>
                {activeTab === "matrix"
                  ? "차곡차곡 쌓인 나의 별"
                  : activeTab === "all"
                    ? "나의 데일리 루틴"
                    : `나의 ${GROUPS[activeTab].name} 루틴`}
                <span>
                  {activeTab === "all" || activeTab === "matrix"
                    ? scheduledHabits.length
                    : filtered.length}
                </span>
              </h2>
              <button
                className="primary add-button"
                onClick={() => setEditing("new")}
              >
                <Plus size={17} />새 습관 추가
              </button>
            </div>
            <div className="tabs" role="tablist" aria-label="시간대별 루틴">
              {(
                [
                  { id: "all", label: "전체", Icon: LayoutGrid },
                  { id: "morning", label: "아침", Icon: Sunrise },
                  { id: "day", label: "낮", Icon: Sun },
                  { id: "night", label: "밤", Icon: Moon },
                  { id: "matrix", label: "별점 매트릭스", Icon: Star },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={activeTab === id}
                  aria-label={label}
                  aria-controls="routine-panel"
                  tabIndex={activeTab === id ? 0 : -1}
                  onKeyDown={(e) => {
                    const ids: Tab[] = [
                      "all",
                      "morning",
                      "day",
                      "night",
                      "matrix",
                    ];
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      const next =
                        ids[
                          (ids.indexOf(id) + (e.key === "ArrowRight" ? 1 : 4)) %
                            5
                        ];
                      setActiveTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                  className={activeTab === id ? "selected" : ""}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span className="tab-label">
                    {id === "matrix" ? (
                      <>
                        <span className="tab-label-full">별점 매트릭스</span>
                        <span className="tab-label-mobile" aria-hidden="true">
                          별점
                        </span>
                      </>
                    ) : (
                      label
                    )}
                  </span>
                  {id !== "matrix" && (
                    <span className="tab-count">
                      {id === "all"
                        ? scheduledHabits.length
                        : scheduledHabits.filter((h) => h.timeGroup === id)
                            .length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div
              id="routine-panel"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === "matrix" ? (
                <MonthlyMatrix
                  month={month}
                  onMonthChange={setMonth}
                  today={today}
                  history={allHistory}
                  onDate={(key) => {
                    const dayStats = stats(allHistory[key] || [], key);
                    showToast(
                      `${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일: ${dayStats.rate}% 달성 · 평균 ${dayStats.average.toFixed(1)}★`,
                    );
                    setPastDate(key);
                  }}
                />
              ) : (
                <>
                  <div className="group-description">
                    <span>
                      <span className="live-dot" />
                      {activeTab === "all"
                        ? "오늘의 작은 약속들"
                        : `${GROUPS[activeTab].name}, 나를 위한 시간`}
                    </span>
                    <span>
                      {activeTab === "all"
                        ? "별을 눌러 실천의 질을 기록해요"
                        : GROUPS[activeTab].range}
                    </span>
                  </div>
                  <div className="habit-grid">
                    {filtered.map(renderCard)}
                    {!filtered.length && (
                      <div className="empty-state">
                        <Leaf size={25} />
                        <h3>
                          {ready
                            ? habits.length
                              ? "오늘 예정된 습관이 없어요"
                              : "아직 등록된 습관이 없어요"
                            : "오늘의 루틴을 준비하고 있어요"}
                        </h3>
                        <p>가볍게 시작할 수 있는 작은 약속을 만들어보세요.</p>
                        <button
                          className="text-button"
                          onClick={() => setEditing("new")}
                        >
                          <Plus size={15} />첫 습관 추가하기
                        </button>
                      </div>
                    )}
                  </div>
                  {restingHabits.filter(
                    (h) => activeTab === "all" || h.timeGroup === activeTab,
                  ).length > 0 && (
                    <section
                      className="resting-habits"
                      aria-label="오늘 쉬는 습관"
                    >
                      <h3>오늘 쉬는 습관</h3>
                      {restingHabits
                        .filter(
                          (h) =>
                            activeTab === "all" || h.timeGroup === activeTab,
                        )
                        .map((habit) => (
                          <button
                            key={habit.id}
                            onClick={() => setEditing(habit)}
                            aria-label={`${habit.title} 반복 요일 수정`}
                          >
                            <span aria-hidden="true">{habit.icon}</span>
                            {habit.title}
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        ))}
                    </section>
                  )}
                  {upcoming.length > 0 && (
                    <>
                      <div className="upcoming-heading">
                        <h3>
                          {activeTab === "night"
                            ? "아침을 여는 작은 약속"
                            : "조금 뒤, 나를 위한 시간"}
                          <span>UP NEXT</span>
                        </h3>
                        <MoreHorizontal size={19} />
                      </div>
                      <div className="habit-grid">
                        {upcoming.map(renderCard)}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="gentle-note">
              <Sparkles size={16} />
              <p>
                별점은 평가가 아닌, <strong>나를 알아가는 기록</strong>이에요.
              </p>
              <button aria-label="별점 기록 안내" onClick={() => setHelp(true)}>
                <CircleHelp size={15} />
              </button>
            </div>
          </section>
          <aside className="sidebar">
            <section className="little-note" aria-label="오늘의 응원">
              <span className="note-icon" aria-hidden="true">
                <Sparkles size={19} />
              </span>
              <div className="note-copy">
                <h3>꾸준함은 완벽함보다 빛나요.</h3>
                <p>별 하나여도, 소중한 오늘이에요.</p>
              </div>
            </section>
          </aside>
        </div>
        <footer className="site-footer">
          <span>
            <Sparkles size={13} />
            별하루<small>작은 실천, 반짝이는 하루.</small>
          </span>
          <button onClick={() => setHelp(true)}>
            <ShieldCheck size={13} />
            {app.user
              ? "내 계정에 안전하게 동기화해요"
              : "기록은 이 기기에만 저장돼요"}
          </button>
          <small>MADE FOR YOUR EVERYDAY</small>
        </footer>
      </main>
      {editing && (
        <HabitEditor
          key={editing === "new" ? "new" : editing.id}
          habit={
            editing === "new"
              ? undefined
              : habits.find((h) => h.id === editing.id)
          }
          today={today}
          defaultGroup={
            activeTab === "morning" ||
            activeTab === "day" ||
            activeTab === "night"
              ? activeTab
              : group
          }
          onSave={(data) => {
            void handleSave(data).catch(() => {});
          }}
          onDelete={
            editing !== "new"
              ? () => {
                  void handleDelete().catch(() => {});
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
      {detail && (
        <HabitDetail
          key={detail.id}
          habit={detail}
          onClose={() => setDetailId(null)}
          onSave={(data) => {
            void (async () => {
              await setHabits((prev) =>
                prev.map((h) => (h.id === detail.id ? { ...h, ...data } : h)),
              );
              setDetailId(null);
            })().catch(() => {});
          }}
        />
      )}
      {accountOpen && (
        <Modal
          title="계정 및 데이터 관리"
          onClose={() => setAccountOpen(false)}
        >
          <AccountPanel
            key={app.user?.id ?? "guest"}
            app={app}
            settings={
              <section className="account-settings" aria-label="설정">
                <h3>설정</h3>
                <div className="setting-row">
                  <span>화면 테마</span>
                  <button
                    className="secondary"
                    onClick={() =>
                      setTheme(theme === "light" ? "dark" : "light")
                    }
                  >
                    {theme === "light"
                      ? "라이트 · 다크로 전환"
                      : "다크 · 라이트로 전환"}
                  </button>
                </div>
                <p className="settings-hint">
                  알림은 습관별로 설정할 수 있어요. 앱이 열려 있을 때
                  알려드려요.
                </p>
                {installEvent && (
                  <button
                    className="secondary full"
                    onClick={async () => {
                      try {
                        await installEvent.prompt();
                        const choice = await installEvent.userChoice;
                        if (choice.outcome === "accepted")
                          showToast("별하루를 설치했어요!");
                        setInstallEvent(null);
                      } catch {
                        showToast(
                          "설치를 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
                        );
                      }
                    }}
                  >
                    <ArrowDownToLine size={17} /> 별하루 앱 설치
                  </button>
                )}
              </section>
            }
          />
        </Modal>
      )}
      {help && (
        <Modal title="나의 속도로, 별하루" onClose={() => setHelp(false)}>
          <div className="help-content">
            <span className="help-mark">
              <Sparkles size={36} />
            </span>
            <h3>완벽한 하루가 아니어도 괜찮아요.</h3>
            <p>
              별하루는 습관의 완료뿐 아니라, 실천의 만족도와 몰입을 별 1~5개로
              기록해요. 같은 별을 다시 누르면 기록이 취소돼요.
            </p>
            <h4>나만의 작은 기록</h4>
            <p>
              비회원 기록과 테마는 이 브라우저에 저장돼요. 이메일 인증 후
              로그인하면 계정별로 기록을 동기화할 수 있어요. 비회원 기록 이전은
              확인 후 진행하며, 오프라인 기록은 연결 후 전송해요. 설정한 요일에
              루틴이 나타나고 이전 기록은 달력에 남아요.
            </p>
            <h4>가벼운 루틴 알림</h4>
            <p>
              앱이 열려 있는 동안 예정된 시간에 알림을 보내요. 소리를 들으려면
              알림 테스트를 한 번 눌러주세요. 앱이 닫힌 상태의 백그라운드 알림은
              지원하지 않아요.
            </p>
            <button className="primary full" onClick={() => setHelp(false)}>
              좋아요, 시작해볼게요
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {pastDate && (
        <Modal
          title={`${Number(pastDate.slice(5, 7))}월 ${Number(pastDate.slice(8))}일의 별 기록`}
          onClose={() => setPastDate(null)}
        >
          <div className="past-summary">
            <Star size={28} className="gold" />
            <h3>
              {stats(allHistory[pastDate] || [], pastDate).rate}% 달성 · 평균{" "}
              {stats(allHistory[pastDate] || [], pastDate).average.toFixed(1)}★
            </h3>
            <p>
              {allHistory[pastDate]?.length
                ? "작은 실천들이 모인 소중한 하루예요."
                : "이날은 아직 남겨진 기록이 없어요."}
            </p>
            {(allHistory[pastDate] || []).map((h) => (
              <div className="past-row" key={h.id}>
                <div className="past-habit">
                  <span className="habit-emoji" aria-hidden="true">
                    {h.icon}
                  </span>
                  <div>
                    <span>{h.title}</span>
                    {h.memo && <p>{h.memo}</p>}
                  </div>
                </div>
                <b>
                  {h.rating ? `${h.rating}★` : h.completed ? "완료" : "미실천"}
                </b>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {notification && (
        <div className="push-banner" role="alert">
          <span className="push-icon">
            <Bell size={21} />
          </span>
          <button
            className="push-content"
            onClick={() => {
              if (habits.some((h) => h.id === notification.id))
                setDetailId(notification.id);
              setNotification(null);
            }}
          >
            <small>
              {notification.scheduledTime
                ? `[${notification.scheduledTime}] `
                : ""}
              루틴 알림
            </small>
            <strong>{notification.title}</strong>
            <span>
              실천할 시간이에요! 지금 별점 기록하기 <ArrowRight size={13} />
            </span>
          </button>
          <button
            className="icon-button"
            aria-label="알림 닫기"
            onClick={() => setNotification(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={14} />
          </span>
          {toast}
        </div>
      )}
      {(storageWarning || app.error) && (
        <div className="storage-warning" role="alert">
          {app.error ||
            "브라우저 저장소를 사용할 수 없어요. 저장 설정을 확인해주세요."}
          <button onClick={() => setAccountOpen(true)}>백업·계정 확인</button>
          <button
            aria-label="저장 경고 닫기"
            onClick={() => setStorageWarning(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

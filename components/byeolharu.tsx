"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  Leaf,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Trash2,
  X,
} from "lucide-react";

import {
  type Habit,
  type HabitSettingsPatch,
  type DailyRecordPatch,
  type TimeGroup,
  type History,
  applyHabitSettings,
  applyDailyRecord,
  dateKey,
  isScheduled,
  stats,
} from "@/lib/habits/domain";
import { useHabitApp } from "@/lib/habits/use-habit-app";
import { AccountPanel } from "@/components/account/account-panel";
import { StarlitHero } from "@/components/starlit-hero";
import { initialRoutineTab, startupDataReady } from "@/lib/habits/time-tab";
import { sortHabitsForDisplay } from "@/lib/habits/display-order";
import { ConstellationGrowthView } from "@/components/constellation-growth-view";
import { calculateConstellationGrowth, earnedStageFromCompletion } from "@/lib/constellation/growth";
import { getConstellationStage } from "@/lib/constellation/art";
import { calculateWeeklyReflection } from "@/lib/habits/weekly-reflection";
import { WeeklyReflectionView } from "@/components/weekly-reflection-view";
import { StarlitClosingFooter } from "@/components/starlit-closing-footer";
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
const MORE_EMOJIS = [
  "💊", "🌙", "☕", "❤️", "🥾", "🚶", "🚴", "🏊",
  "🤸", "🪥", "🧹", "🧺", "🍳", "🪴", "📝", "✅",
  "📅", "📖", "💌", "🧠", "🗂️", "🙏", "🍎", "🧗",
];
const HABIT_TEMPLATES: {
  title: string;
  icon: string;
  timeGroup: TimeGroup;
  scheduledTime: string;
}[] = [
  { title: "독서 20분", icon: "📚", timeGroup: "night", scheduledTime: "21:30" },
  { title: "가벼운 운동", icon: "🏃", timeGroup: "morning", scheduledTime: "07:30" },
  { title: "물 마시기", icon: "💧", timeGroup: "morning", scheduledTime: "07:00" },
  { title: "스트레칭", icon: "🧘", timeGroup: "night", scheduledTime: "22:00" },
  { title: "일찍 잠들기", icon: "🌙", timeGroup: "night", scheduledTime: "23:00" },
  { title: "하루 기록하기", icon: "✍️", timeGroup: "night", scheduledTime: "21:00" },
  { title: "영양제 챙기기", icon: "💊", timeGroup: "morning", scheduledTime: "08:00" },
  { title: "아침 산책", icon: "🚶", timeGroup: "morning", scheduledTime: "08:00" },
  { title: "건강한 점심", icon: "🥗", timeGroup: "day", scheduledTime: "12:30" },
  { title: "10분 산책", icon: "🚶", timeGroup: "day", scheduledTime: "13:00" },
  { title: "집중 25분", icon: "💻", timeGroup: "day", scheduledTime: "14:00" },
  { title: "오늘 할 일 정리", icon: "✅", timeGroup: "morning", scheduledTime: "09:00" },
  { title: "명상 5분", icon: "🧘‍♂️", timeGroup: "night", scheduledTime: "21:30" },
  { title: "감사 3가지 적기", icon: "🙏", timeGroup: "night", scheduledTime: "22:00" },
  { title: "영어 10분", icon: "📖", timeGroup: "day", scheduledTime: "12:00" },
  { title: "공부 30분", icon: "💻", timeGroup: "night", scheduledTime: "20:00" },
  { title: "책상 정리", icon: "🗂️", timeGroup: "day", scheduledTime: "17:00" },
  { title: "피부 관리", icon: "🌱", timeGroup: "night", scheduledTime: "22:30" },
  { title: "내일 준비하기", icon: "📅", timeGroup: "night", scheduledTime: "21:30" },
  { title: "방 정리하기", icon: "🧹", timeGroup: "day", scheduledTime: "16:00" },
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
      onPointerLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} ${value}점`}
          aria-pressed={rating === value}
          onPointerEnter={(event) => {
            // Touch and keyboard focus must not fake a saved rating.
            if (event.pointerType === "mouse") setHover(value);
          }}
          onBlur={() => setHover(0)}
          onClick={(event) => {
            event.stopPropagation();
            setHover(0);
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
  onEscape,
  onBack,
  backLabel = "내 계정으로",
  accountScreen = false,
  scrollKey,
  wide = false,
  fallbackFocusId,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onEscape?: () => void;
  onBack?: () => void;
  backLabel?: string;
  accountScreen?: boolean;
  scrollKey?: string;
  wide?: boolean;
  fallbackFocusId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Keep the account header fixed while each detail page starts at its top.
  useLayoutEffect(() => {
    if (!accountScreen && scrollKey === undefined) return;
    if (accountScreen) {
      const content = ref.current?.querySelector<HTMLElement>(".account-screen-body");
      if (content) content.scrollTop = 0;
    } else {
      ref.current?.scrollTo({ top: 0 });
    }
    if (ref.current?.open) titleRef.current?.focus({ preventScroll: true });
  }, [accountScreen, scrollKey]);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    if (accountScreen) titleRef.current?.focus({ preventScroll: true });
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = original;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      } else if (fallbackFocusId) {
        // A saved reflection may move its card into the folded completed list.
        document.getElementById(fallbackFocusId)?.focus();
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${accountScreen ? "account-screen" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(e) => { e.preventDefault(); (onEscape ?? onClose)(); }}
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
        {onBack && <button type="button" className="icon-button modal-back" aria-label={backLabel} onClick={onBack}><ChevronLeft size={21} aria-hidden="true"/></button>}
        <h2 id="modal-title" ref={titleRef} tabIndex={accountScreen || scrollKey !== undefined ? -1 : undefined}>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {accountScreen ? <div className="account-screen-body">{children}</div> : children}
    </dialog>
  );
}


function HabitEditor({
  habit,
  defaultGroup,
  onSave,
  onDelete,
  onClose,
}: {
  habit?: Habit;
  defaultGroup: TimeGroup;
  onSave: (draft: HabitSettingsPatch) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreTemplates, setMoreTemplates] = useState(false);
  const [moreIcons, setMoreIcons] = useState(() => Boolean(habit?.icon && MORE_EMOJIS.includes(habit.icon)));
  const [timeEdited, setTimeEdited] = useState(false);
  const [draft, setDraft] = useState<HabitSettingsPatch>(() => ({
    title: habit?.title ?? "",
    icon: habit?.icon ?? "🌱",
    timeGroup: habit?.timeGroup ?? defaultGroup,
    scheduledTime: habit?.scheduledTime,
    repeatDays: habit?.repeatDays ?? [...WEEKDAYS],
    alarmEnabled: habit?.alarmEnabled ?? false,
  }));
  // Keep built-in icons at stable positions when a selection changes.
  // Show unknown saved icons at the end without reordering the preset palette.
  const knownIcon = EMOJIS.includes(draft.icon) || MORE_EMOJIS.includes(draft.icon);
  const visibleIcons = [
    ...EMOJIS,
    ...(moreIcons ? MORE_EMOJIS : []),
    ...(!knownIcon ? [draft.icon] : []),
  ];
  const selectedDays = draft.repeatDays ?? WEEKDAYS;
  const matchesPreset = (days: number[]) =>
    WEEKDAYS.filter((day) => selectedDays.includes(day)).join() === days.join();

  return (
    <Modal
      title={habit ? "습관 수정하기" : "나를 위한 새로운 습관"}
      onClose={onClose}
    >
      {!habit && <p className="modal-description">작은 실천부터, 나만의 속도로 시작해요.</p>}
      <form
        className="habit-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.title.trim())
            onSave({
              title: draft.title.trim(),
              icon: draft.icon,
              timeGroup: draft.timeGroup,
              repeatDays: draft.repeatDays,
              scheduledTime: draft.scheduledTime || undefined,
              alarmEnabled: draft.alarmEnabled,
            });
        }}
      >
        {!habit && (
          <fieldset className="template-field" aria-label="추천 템플릿">
            <div className="habit-editor-field-head">
              <span className="habit-editor-heading">추천 템플릿</span>
              <button
                type="button"
                className="habit-editor-more"
                aria-expanded={moreTemplates}
                aria-controls="habit-editor-templates"
                onClick={() => setMoreTemplates((prev) => !prev)}
              >
                {moreTemplates ? "접기" : "더 많은 템플릿 보기"}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="template-picker" id="habit-editor-templates">
              {(moreTemplates ? HABIT_TEMPLATES : HABIT_TEMPLATES.slice(0, 6)).map((template) => (
                <button
                  type="button"
                  key={template.title}
                  aria-label={template.title + " 템플릿"}
                  aria-pressed={
                    draft.title === template.title &&
                    draft.icon === template.icon &&
                    draft.timeGroup === template.timeGroup
                  }
                  onClick={() => {
                    if (MORE_EMOJIS.includes(template.icon)) setMoreIcons(true);
                    setDraft((prev) => ({
                      ...prev,
                      title: template.title,
                      icon: template.icon,
                      timeGroup: template.timeGroup,
                      // Never overwrite a time the user has chosen, or repeat-day settings.
                      scheduledTime: timeEdited ? prev.scheduledTime : template.scheduledTime,
                    }));
                  }}
                >
                  <span aria-hidden="true">{template.icon}</span>
                  <span>{template.title}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="field habit-editor-name">
          습관 이름
          <input
            autoFocus={Boolean(habit)}
            required
            maxLength={80}
            placeholder="예: 하루 10분 책 읽기"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          />
        </label>
        <fieldset className="habit-editor-icons" aria-label="습관 아이콘">
          <div className="habit-editor-field-head">
            <span className="habit-editor-heading">아이콘</span>
            <button
              type="button"
              className="habit-editor-more"
              aria-expanded={moreIcons}
              aria-controls="habit-editor-icons"
              onClick={() => setMoreIcons((prev) => !prev)}
            >
              {moreIcons ? "접기" : "아이콘 더 보기"}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="emoji-picker" id="habit-editor-icons">
            {visibleIcons.map((icon) => (
              <button
                type="button"
                key={icon}
                aria-label={icon + " 아이콘"}
                aria-pressed={draft.icon === icon}
                className={draft.icon === icon ? "selected" : ""}
                onClick={() => setDraft((prev) => ({ ...prev, icon }))}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>
        <section className="habit-editor-schedule" aria-label="실천 일정">
          <h3 className="habit-editor-schedule-title">
            <CalendarDays size={18} aria-hidden="true" /> 실천 일정
          </h3>
          <div className="habit-editor-schedule-grid">
            <fieldset className="habit-editor-time-group">
              <legend>시간대</legend>
              <div className="segmented">
                {(Object.keys(GROUPS) as TimeGroup[]).map((group) => {
                  const Icon = GROUPS[group].icon;
                  return (
                    <button
                      type="button"
                      key={group}
                      className={draft.timeGroup === group ? "selected" : ""}
                      aria-pressed={draft.timeGroup === group}
                      onClick={() => setDraft((prev) => ({ ...prev, timeGroup: group }))}
                    >
                      <Icon size={15} aria-hidden="true" /> {GROUPS[group].name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="field">
              예정 시간
              <input
                type="time"
                value={draft.scheduledTime || ""}
                onChange={(e) => {
                  setTimeEdited(true);
                  setDraft((prev) => ({ ...prev, scheduledTime: e.target.value }));
                }}
              />
            </label>
          </div>
          <fieldset className="habit-editor-repeat">
            <legend>반복 요일</legend>
            <div className="segmented repeat-presets">
              {REPEAT_PRESETS.map(({ label, days }) => (
                <button
                  type="button"
                  key={label}
                  className={matchesPreset(days) ? "selected" : ""}
                  aria-pressed={matchesPreset(days)}
                  onClick={() => setDraft((prev) => ({ ...prev, repeatDays: [...days] }))}
                >
                  {label}
                </button>
              ))}
            </div>
            {!REPEAT_PRESETS.some(({ days }) => matchesPreset(days)) && (
              <span className="habit-editor-custom-days">직접 선택</span>
            )}
            <div className="repeat-weekdays" role="group" aria-label="반복할 요일">
              {WEEKDAYS.map((day, index) => (
                <button
                  type="button"
                  key={day}
                  className={selectedDays.includes(day) ? "selected" : ""}
                  aria-label={["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"][index]}
                  aria-pressed={selectedDays.includes(day)}
                  onClick={() => setDraft((prev) => {
                    const selected = prev.repeatDays ?? WEEKDAYS;
                    const next = selected.includes(day)
                      ? selected.filter((value) => value !== day)
                      : WEEKDAYS.filter((value) => selected.includes(value) || value === day);
                    return next.length ? { ...prev, repeatDays: next } : prev;
                  })}
                >
                  {["월", "화", "수", "목", "금", "토", "일"][index]}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
        {onDelete && (confirmDelete ? (
          <div className="delete-confirmation" role="group" aria-label="습관 삭제 확인">
            <p>이 습관을 삭제할까요? 이전 날짜의 기록은 그대로 남아요.</p>
            <div className="form-row">
              <button type="button" className="secondary full" onClick={() => setConfirmDelete(false)}>취소</button>
              <button type="button" className="delete-button" onClick={onDelete}>
                <Trash2 size={16} /> 삭제 확인
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="delete-button" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> 이 습관 삭제하기
          </button>
        ))}
        <div className="habit-editor-footer">
          <button type="submit" className="primary full">
            <Check size={18} />
            {habit ? "수정 완료" : "새 습관 추가하기"}
          </button>
          <button type="button" className="text-button full" onClick={onClose}>취소</button>
        </div>
      </form>
    </Modal>
  );
}

function HabitDetail({
  habit,
  onSave,
  onClose,
  fallbackFocusId,
}: {
  habit: Habit;
  onSave: (data: DailyRecordPatch) => void;
  onClose: () => void;
  fallbackFocusId: string;
}) {
  const [draft, setDraft] = useState<DailyRecordPatch>({
    rating: habit.rating,
    completed: habit.completed,
    memo: habit.memo,
  });
  return (
    <Modal title="오늘의 실천 기록" onClose={onClose} fallbackFocusId={fallbackFocusId}>
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
      <button
        className="primary full"
        onClick={() =>
          onSave({
            rating: draft.rating,
            completed: draft.rating > 0,
            memo: draft.memo,
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
          })
        }
      >
        <Check size={17} />
        단순 체크만 하기
      </button>
    </Modal>
  );
}

/** Show the time group only when the active tab does not already provide that context. */
function HabitTimeMeta({
  habit,
  showTimeGroup,
  compact = false,
}: {
  habit: Habit;
  showTimeGroup: boolean;
  compact?: boolean;
}) {
  return (
    <span className={compact ? "compact-habit-time" : "time-badge"}>
      {habit.scheduledTime ? (
        <>
          <Clock3 size={compact ? 13 : 12} aria-hidden="true" />
          <span>{habit.scheduledTime}</span>
        </>
      ) : (
        <span>자유롭게</span>
      )}
      {showTimeGroup && (
        <>
          {compact
            ? <span aria-hidden="true">·</span>
            : <span className="time-divider" aria-hidden="true" />}
          <span>{GROUPS[habit.timeGroup].name}{compact ? "" : " 루틴"}</span>
        </>
      )}
    </span>
  );
}

function HabitCard({
  habit,
  showTimeGroup,
  onRate,
  onOpen,
  onEdit,
}: {
  habit: Habit;
  showTimeGroup: boolean;
  onRate: (id: string, rating: number, fromKeyboard: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const keyboardRating = useRef(false);
  return (
    <article data-habit-id={habit.id} className={`habit-card ${habit.completed ? "is-completed" : ""}`}>
      <div className="card-top">
        <span className={`habit-emoji ${habit.timeGroup}`}>{habit.icon}</span>
        <div className="card-actions">
          {habit.completed && (
            <span className="status-pill done">
              <Check size={10} aria-hidden="true" />
              실천 완료
            </span>
          )}
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
        <HabitTimeMeta habit={habit} showTimeGroup={showTimeGroup} />
      </button>
      <div
        className="card-rating"
        onKeyDownCapture={(event) => {
          if ((event.key === "Enter" || event.key === " ") &&
            (event.target as HTMLElement).closest(".star-tray")) keyboardRating.current = true;
        }}
        onPointerDownCapture={() => { keyboardRating.current = false; }}
      >
        <StarRating
          label={habit.title}
          rating={habit.rating}
          onSelect={(value) => {
            onRate(habit.id, value, keyboardRating.current);
            keyboardRating.current = false;
          }}
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
      </div>
    </article>
  );
}


/** Compact rows reuse the existing rating and edit handlers without duplicating storage. */
function CompactHabitCard({
  habit,
  showTimeGroup,
  expanded,
  onToggle,
  onRate,
  onOpen,
  onEdit,
}: {
  habit: Habit;
  showTimeGroup: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRate: (value: number, fromKeyboard: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const keyboardRating = useRef(false);
  return (
    <article
      data-habit-id={habit.id}
      className={["compact-habit-card", habit.completed && "is-completed", expanded && "is-expanded"].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="compact-habit-row"
        aria-expanded={expanded}
        aria-controls={"compact-habit-detail-" + habit.id}
        aria-label={habit.title + (habit.rating > 0
          ? ", 실천 완료, 별점 " + habit.rating + "점"
          : habit.completed ? ", 실천 완료, 별점 없이 체크" : ", 미기록") + ", 기록하기"}
        onClick={onToggle}
      >
        <span className={"compact-habit-emoji " + habit.timeGroup} aria-hidden="true">{habit.icon}</span>
        <span className="compact-habit-title" title={habit.title}>{habit.title}</span>
        <span className="compact-habit-status" aria-hidden="true">
          {habit.completed && <Check size={15} />}
          {habit.rating > 0 ? <><Star size={15} fill="currentColor" />{habit.rating}</> : "—"}
        </span>
        {expanded ? <ChevronUp className="compact-habit-chevron" size={17} aria-hidden="true" /> : <ChevronDown className="compact-habit-chevron" size={17} aria-hidden="true" />}
      </button>
      {expanded && (
        <div id={"compact-habit-detail-" + habit.id} className="compact-habit-detail">
          <div
            className="compact-habit-rating"
            onKeyDownCapture={(event) => {
              if ((event.key === "Enter" || event.key === " ") &&
                  (event.target as HTMLElement).closest(".star-tray")) keyboardRating.current = true;
            }}
            onPointerDownCapture={() => { keyboardRating.current = false; }}
          >
            <StarRating
              label={habit.title}
              rating={habit.rating}
              onSelect={(value) => {
                onRate(value, keyboardRating.current);
                keyboardRating.current = false;
              }}
            />
          </div>
          <div className="compact-habit-extras">
            <HabitTimeMeta habit={habit} showTimeGroup={showTimeGroup} compact />
            <div className="compact-habit-actions">
              <button type="button" onClick={onOpen}>기록 상세</button>
              <button type="button" onClick={onEdit} aria-label={habit.title + " 수정"}><Pencil size={15} aria-hidden="true" />수정</button>
            </div>
          </div>
        </div>
      )}
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
  const [accountPage, setAccountPage] = useState<"home" | "records" | "import" | "settings" | "security" | "login" | "signup" | "reset">("home");
  useEffect(() => {
    if (!app.user && accountPage === "security") setAccountPage("home");
  }, [app.user, accountPage]);
  const [constellationOpen, setConstellationOpen] = useState(false);
  const [starlightPreviewOpen, setStarlightPreviewOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [celebration, setCelebration] = useState<{ stage: number; scope: string; day: string } | null>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [compactView, setCompactView] = useState(false);
  const [compactPreferenceLoaded, setCompactPreferenceLoaded] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  // Alternate two identical CSS animations to restart on rapid completions.
  const [completedGroupNudge, setCompletedGroupNudge] = useState<0 | 1 | 2>(0);
  const completedGroupNudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedGroupBaseline = useRef<{ key: string; count: number; ready: boolean } | null>(null);
  const [compactExpandedId, setCompactExpandedId] = useState<string | null>(null);
  const compactCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compactFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  // Resolve once per loaded identity, unless the user has navigated manually.
  const startupTabResolved = useRef<string | null>(null);
  const tabChosenManually = useRef(false);
  const [month, setMonth] = useState(new Date(2026, 10, 1));
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [help, setHelp] = useState(false);
  const [pastDate, setPastDate] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
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
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    const date = new Date();
    try {
      if (
        (localStorage.getItem("byeolharu_v2_theme") ??
          localStorage.getItem("byeolharu_v1_theme")) === "dark"
      )
        setTheme("dark");
    } catch {
      setStorageWarning(true);
    }
    try {
      setCompactView(localStorage.getItem("byeolharu_compact_view_v1") === "1");
    } catch {
      // A display preference is optional; do not flag a record-storage error.
    }
    setCompactPreferenceLoaded(true);
    setNow(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
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
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      if (compactCollapseTimer.current) clearTimeout(compactCollapseTimer.current);
      if (compactFocusTimer.current) clearTimeout(compactFocusTimer.current);
      if (normalFocusTimer.current) clearTimeout(normalFocusTimer.current);
      if (completedGroupNudgeTimer.current) clearTimeout(completedGroupNudgeTimer.current);
      for (const timer of reorderTimers.current.values()) clearTimeout(timer);
      reorderTimers.current.clear();
    };
  }, []);

  useLayoutEffect(() => {
    if (ready) document.documentElement.dataset.byeolharuTheme = theme;
  }, [ready, theme]);

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

  useEffect(() => {
    if (!compactPreferenceLoaded) return;
    try {
      localStorage.setItem("byeolharu_compact_view_v1", compactView ? "1" : "0");
    } catch {
      // Display settings do not affect the existing record repository.
    }
  }, [compactView, compactPreferenceLoaded]);

  const updateCompactView = (enabled: boolean) => {
    setCompactView(enabled);
    setCompletedOpen(false);
    setCompactExpandedId(null);
  };

  // Keep the current-day rollover for scheduled habits and history.
  // In-app reminder notifications are intentionally deferred until a
  // reliable, background-capable notification channel is available.
  useEffect(() => {
    if (!ready || !now) return;
    const actualDay = dateKey(
      now,
      app.user ? app.snapshot?.state.timezone : undefined,
    );
    if (actualDay !== app.snapshot?.day) {
      void app.ensureDay().catch(() => setStorageWarning(true));
    }
  }, [ready, now, app.user, app.snapshot?.day, app.snapshot?.state.timezone]);

  const showStageCelebration = (stage: number, actionScope: string, actionDay: string) => {
    if (activeScope.current !== actionScope) return;
    setCelebration({ stage, scope: actionScope, day: actionDay });
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => setCelebration(null), 3600);
  };

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
    if (!rating) setCelebration(null);
    const earnedStage = app.snapshot && earnedStageFromCompletion(
      app.snapshot, visibleHabits,
      applyDailyRecord(habit, { rating, completed: rating > 0, memo: habit.memo }),
    );
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
            item.id === id
              ? applyDailyRecord(item, {
                  rating,
                  completed: rating > 0,
                  memo: item.memo,
                })
              : item,
          ),
        );
        if (earnedStage && ratingOverridesRef.current.get(id) === override) {
          showStageCelebration(earnedStage, scope, day);
        }
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
  const handleSave = async (data: HabitSettingsPatch) => {
    if (editing === "new") {
      const newHabit: Habit = {
        id: uid(),
        title: data.title,
        icon: data.icon,
        timeGroup: data.timeGroup,
        repeatDays: data.repeatDays,
        scheduledTime: data.scheduledTime,
        alarmEnabled: data.alarmEnabled,
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
        prev.map((h) => (h.id === id ? applyHabitSettings(h, data) : h)),
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
  const visibleHabits = useMemo(() => habits.map((habit) => {
    const override = ratingOverrides.get(habit.id);
    return override?.scope === scope && override.day === today
      ? { ...habit, rating: override.rating, completed: override.rating > 0 }
      : habit;
  }), [habits, ratingOverrides, scope, today]);
  const scheduledHabits = today
    ? visibleHabits.filter((h) => isScheduled(h, today))
    : [];
  const restingHabits = today
    ? visibleHabits.filter((h) => !isScheduled(h, today))
    : [];
  const summary = stats(visibleHabits, today);
  const growth = useMemo(() => app.snapshot
    ? calculateConstellationGrowth({ ...app.snapshot, habits: visibleHabits })
    : { totalPoints: 0, totalCompletedHabits: 0, days: [] },
    [app.snapshot, visibleHabits]);
  const growthPoints = growth.totalPoints;
  const allHistory = {
    ...history,
    ...(today ? { [today]: visibleHabits } : {}),
  };
  const weeklyReflection = useMemo(() => {
    if (!app.snapshot || (app.user && !app.snapshot.state.hydrated)) return null;
    return calculateWeeklyReflection({ ...app.snapshot, habits: visibleHabits });
  }, [app.snapshot, app.user, visibleHabits]);
  const displayNow =
    now && app.user
      ? new Date(
          now.toLocaleString("en-US", {
            timeZone: app.snapshot?.state.timezone,
          }),
        )
      : now;
  const group = displayNow ? timeGroup(displayNow) : "day";
  // A newly signed-in member may publish an empty, unhydrated local snapshot
  // before the initial cloud pull. Wait for hydrated member data so that
  // both the actual routines and the account timezone decide the first tab.
  // The cloud pull sets hydrated before ensureDay seeds today\'s entries.
  // Re-resolve for a new identity only if the user has not navigated manually.
  useEffect(() => {
    if (!now || !app.snapshot || tabChosenManually.current) return;
    if (!startupDataReady(!!app.user, app.snapshot)) return;
    const identity = app.user?.id ?? "guest";
    if (startupTabResolved.current === identity) return;
    startupTabResolved.current = identity;
    setActiveTab(initialRoutineTab(
      now,
      scheduledHabits,
      app.user ? app.snapshot.state.timezone : undefined,
    ));
  }, [now, app.snapshot, app.user, scheduledHabits]);
  const detail = visibleHabits.find((h) => h.id === detailId);
  // Only visual order changes. Keep the held-completion period (700ms),
  // then sort each group by scheduled HH:mm; unscheduled routines come last.
  const filtered = sortHabitsForDisplay(
    scheduledHabits.filter(
      (h) =>
        activeTab === "all" ||
        activeTab === "matrix" ||
        h.timeGroup === activeTab,
    ),
    (habit) => heldCompletion.get(habit.id) ?? habit.completed,
  );
  const compactPending = filtered.filter(
    (habit) => !(heldCompletion.get(habit.id) ?? habit.completed),
  );
  const compactCompleted = filtered.filter(
    (habit) => heldCompletion.get(habit.id) ?? habit.completed,
  );
  // Emphasize only a rise in the rendered completed-group count.
  // Isolate the baseline by date, account, tab and display mode so initial
  // hydration, reloads and navigation never look like new achievements.
  const completedGroupKey = `${scope}:${today}:${activeTab}:${compactView ? "compact" : "normal"}`;
  const completionDataReady = ready && (!app.user || app.snapshot?.state.hydrated === true);
  useEffect(() => {
    const previous = completedGroupBaseline.current;
    completedGroupBaseline.current = {
      key: completedGroupKey,
      count: compactCompleted.length,
      ready: completionDataReady,
    };
    if (completedGroupNudgeTimer.current) {
      clearTimeout(completedGroupNudgeTimer.current);
      completedGroupNudgeTimer.current = null;
    }
    if (previous?.key !== completedGroupKey ||
        !previous.ready || !completionDataReady ||
        compactCompleted.length <= previous.count || activeTab === "matrix") {
      setCompletedGroupNudge(0);
      return;
    }

    // Toggling between two distinct animation names makes each additional
    // completion restart the CSS animation, even when React batches updates.
    // Do not reset to 0 first: React could batch 0 -> 1 back into the old 1.
    setCompletedGroupNudge((current) => current === 1 ? 2 : 1);
    completedGroupNudgeTimer.current = setTimeout(() => {
      setCompletedGroupNudge(0);
      completedGroupNudgeTimer.current = null;
    }, 1100);
  }, [completedGroupKey, completionDataReady, compactCompleted.length, activeTab]);
  // Completion feedback is scoped to the selected tab, not the entire day.
  const completionMessage = activeTab === "all"
    ? "오늘의 실천을 모두 마쳤어요 ✨"
    : activeTab === "matrix"
      ? ""
      : `${GROUPS[activeTab].name} 루틴을 모두 마쳤어요 ✨`;
  useEffect(() => {
    setCompletedOpen(false);
    setCompactExpandedId(null);
  }, [activeTab, today, scope]);
  // The reflection belongs to one local day and one account scope only.
  useEffect(() => {
    setReflectionOpen(false);
  }, [today, scope]);

  const upcoming =
    activeTab !== "all" && activeTab !== "matrix"
      ? sortHabitsForDisplay(
          // A preview is for pending actions only, in the same stable time order.
          scheduledHabits.filter(
            (h) =>
              h.timeGroup ===
                (activeTab === "morning"
                  ? "day"
                  : activeTab === "day"
                    ? "night"
                    : "morning") &&
              !(heldCompletion.get(h.id) ?? h.completed),
          ),
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
  // Do not let a preview cross a date/account boundary.
  useEffect(() => {
    setStarlightPreviewOpen(false);
  }, [today, scope]);

  const renderCard = (habit: Habit, grouped = true) => (
    <HabitCard
      key={habit.id}
      habit={habit}
      showTimeGroup={activeTab === "all" || activeTab !== habit.timeGroup}
      onRate={(id, value, fromKeyboard) => {
        handleRateHabit(id, value);
        if (normalFocusTimer.current) clearTimeout(normalFocusTimer.current);
        const movesGroup = (heldCompletion.get(id) ?? habit.completed) !== (habit.rating === value ? false : true);
        if (fromKeyboard && movesGroup) {
          // A completed upcoming card also disappears. Transfer focus before
          // the 700ms held-completion window ends, without affecting rating edits.
          normalFocusTimer.current = setTimeout(() => {
            const activeCard = document.activeElement?.closest(".habit-card");
            if (activeCard?.getAttribute("data-habit-id") !== id) {
              normalFocusTimer.current = null;
              return;
            }
            const next = Array.from(document.querySelectorAll<HTMLElement>(
              grouped
                ? ".normal-pending-list .habit-card .card-rating button"
                : ".upcoming-heading + .habit-grid .habit-card .card-rating button",
            )).find((button) =>
              button.closest(".habit-card")?.getAttribute("data-habit-id") !== id,
            );
            // The selected tab survives when the final pending/preview card goes away.
            const fallback = !grouped || habit.rating === value
              ? document.getElementById("tab-" + activeTab)
              : (document.querySelector<HTMLButtonElement>(".normal-done-toggle")
                ?? document.getElementById("tab-" + activeTab));
            (next ?? fallback)?.focus();
            normalFocusTimer.current = null;
          }, 600);
        }
      }}
      onOpen={() => setDetailId(habit.id)}
      onEdit={() => setEditing(habit)}
    />
  );
  const renderCompactCard = (habit: Habit) => (
    <CompactHabitCard
      key={habit.id}
      habit={habit}
      showTimeGroup={activeTab === "all" || activeTab !== habit.timeGroup}
      expanded={compactExpandedId === habit.id}
      onToggle={() => setCompactExpandedId((previous) => previous === habit.id ? null : habit.id)}
      onRate={(value, fromKeyboard) => {
        handleRateHabit(habit.id, value);
        if (compactFocusTimer.current) clearTimeout(compactFocusTimer.current);
        if (fromKeyboard) {
          // Preserve keyboard navigation before the existing 700ms completion
          // reordering can unmount the focused star/button.
          compactFocusTimer.current = setTimeout(() => {
            const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".compact-habit-row"));
            const next = rows.find((row) =>
              row.closest(".compact-habit-group") &&
              row.closest("[data-habit-id]")?.getAttribute("data-habit-id") !== habit.id,
            ) ?? rows.find((row) =>
              row.closest("[data-habit-id]")?.getAttribute("data-habit-id") !== habit.id,
            );
            const fallback = document.getElementById("tab-" + activeTab);
            (next ?? fallback)?.focus();
            compactFocusTimer.current = null;
          }, 600);
        }
        if (compactCollapseTimer.current) clearTimeout(compactCollapseTimer.current);
        compactCollapseTimer.current = setTimeout(() => {
          setCompactExpandedId((previous) => previous === habit.id ? null : previous);
          compactCollapseTimer.current = null;
        }, 700);
      }}
      onOpen={() => setDetailId(habit.id)}
      onEdit={() => setEditing(habit)}
    />
  );

  return (
    <div className={`byeolharu ${theme} ${compactView ? "compact-view" : ""} ${reflectionOpen ? "reflection-layout" : ""}`}>
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
              onClick={() => { tabChosenManually.current = true; setReflectionOpen(false); setActiveTab("all"); }}
            >
              <Sun size={16} />
              오늘의 루틴
            </button>
            <button
              className={activeTab === "matrix" ? "active" : ""}
              onClick={() => { tabChosenManually.current = true; setReflectionOpen(false); setActiveTab("matrix"); }}
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
      <main id="main" className={`main-container ${reflectionOpen ? "reflection-main" : ""}`}>
        {reflectionOpen ? (
          <WeeklyReflectionView
            reflection={weeklyReflection}
            onBack={() => { setReflectionOpen(false); setActiveTab("matrix"); }}
            onRecord={(habitId) => {
              const habit = visibleHabits.find((item) => item.id === habitId);
              if (habit && today && isScheduled(habit, today) && !habit.completed)
                setDetailId(habitId);
            }}
          />
        ) : (
        <>
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
          points={ready ? growthPoints : undefined}
          onViewConstellation={ready ? () => setConstellationOpen(true) : undefined}
          celebratedStage={celebration?.scope === scope && celebration.day === today ? celebration.stage : null}
        />
        {compactView ? (
          <section className="compact-metrics" aria-label="오늘의 통계">
            <span>오늘 <strong>{summary.completed}/{scheduledHabits.length}</strong></span>
            <span aria-hidden="true">·</span>
            <span><Star size={13} fill="currentColor" aria-hidden="true" /> <strong>{summary.average ? summary.average.toFixed(1) : "—"}</strong></span>
            <span aria-hidden="true">·</span>
            <span>연속 <strong>{streak}일</strong></span>
          </section>
        ) : (
        <section className="metrics" aria-label="오늘의 통계">
          <div className="metric completion-metric">
            <div className="metric-label">오늘 전체 실천</div>
            <div className="metric-value">
              {summary.completed}<span className="muted">/ {scheduledHabits.length}</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">평균 별점</div>
            <div className="metric-value">
              <Star className="metric-star" size={20} fill="currentColor" aria-hidden="true" />
              {summary.average ? summary.average.toFixed(1) : "—"}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">연속 실천</div>
            <div className="metric-value">{streak}<span>일</span></div>
          </div>
        </section>
        )}
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
                className="secondary add-button"
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
                  { id: "matrix", label: "달력", Icon: CalendarDays },
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
                      tabChosenManually.current = true;
                      setActiveTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                  className={activeTab === id ? "selected" : ""}
                  onClick={() => {
                    tabChosenManually.current = true;
                    setActiveTab(id);
                  }}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span className="tab-label">{label}</span>
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
                <>
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
                  <button
                    type="button"
                    className="weekly-reflection-entry"
                    onClick={() => { setReflectionOpen(true); window.scrollTo(0, 0); }}
                  >
                    <span><Sparkles size={19} aria-hidden="true" /> 최근 7일 돌아보기</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  {!compactView && <div className="group-description">
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
                  </div>}
                  {compactView ? (
                    <div className="compact-habit-list" aria-label="간편 습관 목록">
                      {filtered.length === 0 && (
                        <p className="compact-all-done">
                          {ready ? (habits.length ? "오늘 예정된 습관이 없어요" : "아직 등록된 습관이 없어요") : "오늘의 루틴을 준비하고 있어요"}
                        </p>
                      )}
                      {filtered.length > 0 && (
                        <>
                          {compactPending.length > 0 && (
                            <div className="compact-habit-group" aria-label="실천할 습관">
                              {compactPending.map(renderCompactCard)}
                            </div>
                          )}
                          {compactPending.length === 0 && (
                            <p className="compact-all-done">{completionMessage}</p>
                          )}
                          {compactCompleted.length > 0 && (
                            <section className="compact-done-group" aria-label="완료한 습관">
                              <button
                                type="button"
                                className={`compact-done-toggle ${completedGroupNudge ? `completion-nudge completion-nudge-${completedGroupNudge}` : ""}`}
                                aria-expanded={completedOpen}
                                aria-controls="compact-completed-list"
                                onClick={() => setCompletedOpen((value) => !value)}
                              >
                                <span><CheckCircle2 size={17} aria-hidden="true" /> 완료한 습관 {compactCompleted.length}개</span>
                                <span>{completedOpen ? "접기" : "보기"} {completedOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</span>
                              </button>
                              {completedOpen && (
                                <div id="compact-completed-list" className="compact-completed-list">
                                  {compactCompleted.map(renderCompactCard)}
                                </div>
                              )}
                            </section>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="normal-habit-list">
                      {compactPending.length > 0 && (
                        <div className="habit-grid normal-pending-list" aria-label="실천할 습관">
                          {compactPending.map((habit) => renderCard(habit, true))}
                        </div>
                      )}
                      {filtered.length > 0 && compactPending.length === 0 && (
                        <p className="normal-all-done">{completionMessage}</p>
                      )}
                      {compactCompleted.length > 0 && (
                        <section className="normal-completed-group" aria-label="완료한 습관">
                          <button
                            type="button"
                            className={`normal-done-toggle ${completedGroupNudge ? `completion-nudge completion-nudge-${completedGroupNudge}` : ""}`}
                            aria-expanded={completedOpen}
                            aria-controls="normal-completed-list"
                            onClick={() => setCompletedOpen((value) => !value)}
                          >
                            <span><CheckCircle2 size={18} aria-hidden="true" /> 완료한 습관 {compactCompleted.length}개</span>
                            <span>{completedOpen ? "접기" : "보기"} {completedOpen ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}</span>
                          </button>
                          {completedOpen && (
                            <div id="normal-completed-list" className="habit-grid normal-completed-list">
                              {compactCompleted.map((habit) => renderCard(habit, true))}
                            </div>
                          )}
                        </section>
                      )}
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
                  )}
                  {!compactView && restingHabits.filter(
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
                  {!compactView && upcoming.length > 0 && (
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
                        {upcoming.map((habit) => renderCard(habit, false))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
        <StarlitClosingFooter kind="home" completed={summary.completed > 0} hidden={compactView} />
        </>
        )}
      </main>
      {editing && (
        <HabitEditor
          key={editing === "new" ? "new" : editing.id}
          habit={
            editing === "new"
              ? undefined
              : habits.find((h) => h.id === editing.id)
          }
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
          fallbackFocusId={reflectionOpen ? "weekly-reflection-back" : `tab-${activeTab}`}
          onClose={() => setDetailId(null)}
          onSave={(data) => {
            const actionDay = today;
            const actionScope = scope;
            if (!data.completed) setCelebration(null);
            const earnedStage = app.snapshot && earnedStageFromCompletion(
              app.snapshot, visibleHabits, applyDailyRecord(detail, data),
            );
            void (async () => {
              await setHabits((prev) =>
                prev.map((h) =>
                  h.id === detail.id ? applyDailyRecord(h, data) : h,
                ),
              );
              if (earnedStage) showStageCelebration(earnedStage, actionScope, actionDay);
              setDetailId(null);
            })().catch(() => {});
          }}
        />
      )}
      {constellationOpen && (
        <Modal
          title={starlightPreviewOpen ? "별빛 카드" : "나의 별자리"}
          wide
          scrollKey={starlightPreviewOpen ? "starlight-preview" : "constellation-growth"}
          onBack={starlightPreviewOpen ? () => setStarlightPreviewOpen(false) : undefined}
          backLabel="별자리 성장으로 돌아가기"
          onEscape={() => {
            if (starlightPreviewOpen) setStarlightPreviewOpen(false);
            else setConstellationOpen(false);
          }}
          onClose={() => {
            setStarlightPreviewOpen(false);
            setConstellationOpen(false);
          }}
        >
          <ConstellationGrowthView
            points={growthPoints}
            completedHabits={growth.totalCompletedHabits}
            streak={streak}
            previewOpen={starlightPreviewOpen}
            onCreatePreview={() => setStarlightPreviewOpen(true)}
          />
        </Modal>
      )}
      {accountOpen && (
        <Modal
          accountScreen
          scrollKey={accountPage}
          title={accountPage === "home" ? "내 계정" : accountPage === "records" ? "데이터 관리" : accountPage === "import" ? "비회원 기록 가져오기" : accountPage === "settings" ? "앱 설정" : accountPage === "security" ? "계정 관리" : accountPage === "login" ? "로그인" : accountPage === "signup" ? "회원가입" : "비밀번호 찾기"}
          onClose={() => { setAccountOpen(false); setAccountPage("home"); }}
          onBack={accountPage !== "home" ? () => setAccountPage("home") : undefined}
          onEscape={() => {
            if (accountPage !== "home") setAccountPage("home");
            else { setAccountOpen(false); setAccountPage("home"); }
          }}
        >
          <AccountPanel
            key={app.user?.id ?? "guest"}
            app={app}
            page={accountPage}
            onNavigate={setAccountPage}
            theme={theme}
            onThemeChange={setTheme}
            compactView={compactView}
            onCompactViewChange={updateCompactView}
            onHelp={() => { setAccountOpen(false); setAccountPage("home"); setHelp(true); }}
            onInstall={installEvent ? () => {
              void (async () => {
                try {
                  await installEvent.prompt();
                  const choice = await installEvent.userChoice;
                  if (choice.outcome === "accepted") showToast("별하루를 설치했어요!");
                  setInstallEvent(null);
                } catch {
                  showToast("설치를 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
                }
              })();
            } : undefined}
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

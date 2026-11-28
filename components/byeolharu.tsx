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
  Check,
  CalendarDays,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  Leaf,
  Moon,
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
import { dailyStarlight } from "@/lib/habits/daily-starlight";
import { useHabitApp } from "@/lib/habits/use-habit-app";
import { hasUnsavedHabitSettings, hasUnsavedDailyRecord } from "@/lib/habits/unsaved-draft";
import { AppUpdateNotice } from "@/components/app-update-notice";
import type { NativeUpdateControls } from "@/lib/habits/native-app-update";
import type { NativeReminderControls } from "@/lib/habits/native-reminder-controls";
import { resolveHabitReminder, type HabitReminderNavigation } from "@/lib/habits/reminder-navigation";
import { alarmForSelectedTime } from "@/lib/habits/alarm-default-policy";
import { scheduledTimeGroup, templateGroupForTime, timeForSelectedGroup } from "@/lib/habits/habit-editor-time";
import { AccountPanel, type AccountPage } from "@/components/account/account-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReminderPermissionDialog, useReminderPermissionGuide } from "@/components/reminder-permission-dialog";
import { THEME_PREFERENCE_KEY, parseThemePreference, resolveTheme, type ThemePreference } from "@/lib/theme-preference";
import { StarlitHero } from "@/components/starlit-hero";
import { countEarlierPendingHabits, countOtherPendingHabits, initialRoutineTab, startupDataReady } from "@/lib/habits/time-tab";
import { getFirstUseState, canCelebrateFirstPractice } from "@/lib/habits/onboarding";
import { sortHabitsForDisplay } from "@/lib/habits/display-order";
import { ConstellationGrowthView } from "@/components/constellation-growth-view";
import { calculateConstellationGrowth, earnedStageFromCompletion } from "@/lib/constellation/growth";
import { getConstellationStage } from "@/lib/constellation/art";
import { calculateWeeklyReflection } from "@/lib/habits/weekly-reflection";
import { hasMemoKeyword, toggleMemoKeyword } from "@/lib/habits/memo-keywords";
import { WeeklyReflectionView } from "@/components/weekly-reflection-view";
import { StarlitClosingFooter } from "@/components/starlit-closing-footer";
import { SyncNotice } from "@/components/sync-notice";
export type { Habit, TimeGroup } from "@/lib/habits/domain";
const FIRST_PRACTICE_FEEDBACK_MS = 3400;
const FIRST_PRACTICE_HOLD_MS = 3600;
const FIRST_PRACTICE_SEEN_KEY = "byeolharu_first_practice_celebrated_v1:";
const FIRST_HINT_DISMISS_KEY = "byeolharu_first_habit_hint_dismissed_v1:";
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
    greeting: "지금은 차분한 밤 루틴 시간이에요",
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
  { title: "물 마시기", icon: "💧", timeGroup: "morning", scheduledTime: "07:00" },
  { title: "가벼운 운동", icon: "🏃", timeGroup: "morning", scheduledTime: "07:30" },
  { title: "10분 산책", icon: "🚶", timeGroup: "day", scheduledTime: "13:00" },
  { title: "집중 25분", icon: "💻", timeGroup: "day", scheduledTime: "14:00" },
  { title: "독서 20분", icon: "📚", timeGroup: "night", scheduledTime: "21:30" },
  { title: "하루 기록하기", icon: "✍️", timeGroup: "night", scheduledTime: "21:00" },
  { title: "스트레칭", icon: "🧘", timeGroup: "night", scheduledTime: "22:00" },
  { title: "일찍 잠들기", icon: "🌙", timeGroup: "night", scheduledTime: "23:00" },
  { title: "영양제 챙기기", icon: "💊", timeGroup: "morning", scheduledTime: "08:00" },
  { title: "아침 산책", icon: "🚶", timeGroup: "morning", scheduledTime: "08:00" },
  { title: "건강한 점심", icon: "🥗", timeGroup: "day", scheduledTime: "12:30" },
  { title: "오늘 할 일 정리", icon: "✅", timeGroup: "morning", scheduledTime: "09:00" },
  { title: "명상 5분", icon: "🧘‍♂️", timeGroup: "night", scheduledTime: "21:30" },
  { title: "감사 3가지 적기", icon: "🙏", timeGroup: "night", scheduledTime: "22:00" },
  { title: "영어 10분", icon: "📖", timeGroup: "day", scheduledTime: "12:00" },
  { title: "공부 30분", icon: "💻", timeGroup: "night", scheduledTime: "20:00" },
  { title: "책상 정리", icon: "🗂️", timeGroup: "day", scheduledTime: "16:00" },
  { title: "피부 관리", icon: "🌱", timeGroup: "night", scheduledTime: "22:30" },
  { title: "내일 준비하기", icon: "📅", timeGroup: "night", scheduledTime: "21:30" },
  { title: "방 정리하기", icon: "🧹", timeGroup: "day", scheduledTime: "16:00" },
];
// B2 creation-only shortcuts. Keep the full lists and existing edit palette intact.
const QUICK_HABIT_TEMPLATE_TITLES = ["독서 20분", "물 마시기", "10분 산책"];
const QUICK_HABIT_ICONS = ["💧", "🏃‍♂️", "📚", "🧘‍♂️", "🌱"];

const uid = () => crypto.randomUUID();
const timeGroup = (date: Date): TimeGroup =>
  date.getHours() >= 5 && date.getHours() < 11
    ? "morning"
    : date.getHours() >= 11 && date.getHours() < 17
      ? "day"
      : "night";
const initialHabits = (): Habit[] =>
  [
    // One completed and one pending example are enough to demonstrate both
    // states without asking a new user to clean up five sample routines.
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
      title: "독서 30분 & TOP 50 책장",
      icon: "📚",
      timeGroup: "night",
      scheduledTime: "21:30",
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


/** Android unsaved changes use the shared Starlit Warmth confirmation. */
function UnsavedChangesPrompt({ onContinue, onDiscard }: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <ConfirmDialog
      title="저장하지 않고 나갈까요?"
      description="작성 중인 변경사항이 사라져요."
      cancelLabel="계속 작성"
      confirmLabel="변경사항 버리기"
      onCancel={onContinue}
      onConfirm={onDiscard}
    />
  );
}

function HabitEditor({
  habit,
  defaultGroup,
  onSave,
  onDelete,
  onClose,
  nativeAlarmEditor = false,
  nativeAlarmActive = false,
  nativeAlarmIntentEnabled = false,
  isCurrentEditorScope: isParentEditorScope = () => true,
  onEnsureNativeAlarm,
  onCheckNativePermissions,
  onRequestPermission,
  onDismissPermission,
  guardUnsaved = false,
}: {
  habit?: Habit;
  defaultGroup: TimeGroup;
  onSave: (draft: HabitSettingsPatch, meta?: { alarmPermissionDenied: boolean; alarmPermissionDeferred?: boolean }) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
  nativeAlarmEditor?: boolean;
  nativeAlarmActive?: boolean;
  nativeAlarmIntentEnabled?: boolean;
  isCurrentEditorScope?: () => boolean;
  onEnsureNativeAlarm?: () => Promise<boolean>;
  onCheckNativePermissions?: NativeReminderControls["onCheckPermissions"];
  onRequestPermission?: NativeReminderControls["onRequestPermission"];
  onDismissPermission?: () => void;
  guardUnsaved?: boolean;
}) {
  const editorMounted = useRef(false);
  useEffect(() => { editorMounted.current = true; return () => { editorMounted.current = false; }; }, []);
  const isCurrentEditorScope = () => editorMounted.current && isParentEditorScope();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [alarmChecking, setAlarmChecking] = useState(false);
  const alarmCheckingRef = useRef(false);
  const [alarmTouched, setAlarmTouched] = useState(false);
  const [alarmNotice, setAlarmNotice] = useState("");
  const permissionGuide = useReminderPermissionGuide();
  // Once per deliberate ON/time change, not once for the toggle and again for
  // saving that same draft. A changed time is a new relevant action.
  const alarmCheckedTime = useRef<string | undefined>(undefined);
  const enableNativeAlarm = async (activateDevice: boolean) => {
    if (!onCheckNativePermissions || !onEnsureNativeAlarm || !isCurrentEditorScope()) return false;
    const checked = await onCheckNativePermissions();
    if (!isCurrentEditorScope() || checked.permissionState === "unknown") return false;
    const needsDisplay = checked.permissionState !== "granted";
    if (needsDisplay || checked.exactPermission === "denied") {
      if (!onRequestPermission || !onDismissPermission) return false;
      const accepted = await permissionGuide.ask(checked,
        isCurrent => onRequestPermission(() => isCurrent() && isCurrentEditorScope()), onDismissPermission);
      // Dismissal of optional exact access never blocks ordinary reminders.
      if (!isCurrentEditorScope() || (needsDisplay && !accepted)) return false;
      if ((await onCheckNativePermissions()).permissionState !== "granted" || !isCurrentEditorScope()) return false;
    }
    // Permission recovery and existing ON time edits are not device opt-in.
    // Only a newly enabled alarm can deliberately change the device preference.
    if (activateDevice && (!nativeAlarmActive || needsDisplay) && !await onEnsureNativeAlarm()) return false;
    return isCurrentEditorScope();
  };
  const [moreTemplates, setMoreTemplates] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [templateNotice, setTemplateNotice] = useState("");
  const [moreIcons, setMoreIcons] = useState(false);
  const [timeEdited, setTimeEdited] = useState(false);
  const [draft, setDraft] = useState<HabitSettingsPatch>(() => ({
    title: habit?.title ?? "",
    icon: habit?.icon ?? "🌱",
    timeGroup: habit?.timeGroup ?? defaultGroup,
    scheduledTime: habit?.scheduledTime,
    repeatDays: habit?.repeatDays ?? [...WEEKDAYS],
    alarmEnabled: habit?.alarmEnabled ?? false,
  }));
  const initialDraft = useRef(draft);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const requestClose = () => {
    if (alarmCheckingRef.current) return;
    if (guardUnsaved && hasUnsavedHabitSettings(initialDraft.current, draft)) {
      setDiscardPrompt(true);
      return;
    }
    onClose();
  };
  // Keep built-in icons at stable positions when a selection changes.
  // Show unknown saved icons at the end without reordering the preset palette.
  const knownIcon = EMOJIS.includes(draft.icon) || MORE_EMOJIS.includes(draft.icon);
  const creationIconPalette = [
    ...QUICK_HABIT_ICONS,
    ...EMOJIS.filter((icon) => !QUICK_HABIT_ICONS.includes(icon)),
    ...MORE_EMOJIS,
  ];
  // Keep creation and editing compact until the user explicitly expands the palette.
  // An existing uncommon icon stays visible below, without opening all icons.
  const baseIcons = moreIcons ? creationIconPalette : QUICK_HABIT_ICONS;
  const visibleIcons = [
    ...baseIcons,
    ...(!baseIcons.includes(draft.icon) && (!knownIcon || !moreIcons) ? [draft.icon] : []),
  ];
  const featuredTemplates = moreTemplates
    ? HABIT_TEMPLATES
    : QUICK_HABIT_TEMPLATE_TITLES.map((title) => HABIT_TEMPLATES.find((template) => template.title === title)!);
  const selectedDays = draft.repeatDays ?? WEEKDAYS;
  const matchesPreset = (days: number[]) =>
    WEEKDAYS.filter((day) => selectedDays.includes(day)).join() === days.join();

  const scheduledTimeField = (
    <label className="field habit-editor-time-field">
      <span>예정 시간 <small id="habit-editor-time-optional">(선택)</small></span>
      <input
        type="time"
        aria-label="예정 시간"
        aria-describedby="habit-editor-time-optional"
        value={draft.scheduledTime || ""}
        onChange={(e) => {
          setTimeEdited(true);
          setAlarmNotice("");
          const time = e.target.value;
          setDraft((prev) => ({
            ...prev,
            scheduledTime: time,
            timeGroup: scheduledTimeGroup(time) ?? prev.timeGroup,
            alarmEnabled: alarmForSelectedTime({
              isNewHabit: !habit,
              android: nativeAlarmEditor,
              time,
              current: prev.alarmEnabled,
              userToggledAlarm: alarmTouched,
            }),
          }));
        }}
      />
    </label>
  );

  return (
    <Modal
      title={habit ? "습관 수정하기" : "나를 위한 새로운 습관"}
      onClose={requestClose}
    >
      {discardPrompt && <UnsavedChangesPrompt onContinue={() => setDiscardPrompt(false)} onDiscard={onClose} />}
      {permissionGuide.dialog}
      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="이 습관을 삭제할까요?"
          description={<><span className="confirm-description-line">목록에서는 사라지지만,</span><span className="confirm-description-line">지난 실천 기록은 그대로 남아요.</span></>}
          cancelLabel="유지하기"
          confirmLabel="삭제하기"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        />
      )}
      {!habit && <p className="modal-description">작은 실천부터, 나만의 속도로 시작해요.</p>}
      <form
        className={habit ? "habit-editor-form" : "habit-editor-form habit-editor-creation-b2"}
        aria-busy={alarmChecking}
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.title.trim() || alarmCheckingRef.current) return;
          alarmCheckingRef.current = true;
          setAlarmChecking(true);
          void (async () => {
            let alarmEnabled = Boolean(nativeAlarmEditor && draft.scheduledTime && draft.alarmEnabled);
            let alarmPermissionDenied = false;
            let alarmPermissionDeferred = false;
            try {
              const relevantAlarmChange = alarmEnabled && (!habit?.alarmEnabled || alarmTouched ||
                (nativeAlarmIntentEnabled && draft.scheduledTime !== habit.scheduledTime));
              if (relevantAlarmChange && alarmCheckedTime.current !== draft.scheduledTime) {
                let granted = false;
                try {
                  granted = await enableNativeAlarm(!habit?.alarmEnabled && alarmCheckedTime.current === undefined);
                } catch { /* the habit itself remains editable */ }
                if (!granted) {
                  // Missing OS permission is not a user's decision to delete
                  // a restored ON preference. New unsuccessful ON stays OFF.
                  alarmPermissionDeferred = Boolean(habit?.alarmEnabled);
                  alarmEnabled = alarmPermissionDeferred;
                  alarmPermissionDenied = !alarmEnabled;
                }
              }
              if (!isCurrentEditorScope()) throw Error("계정이 변경되었어요.");
              await onSave({
                title: draft.title.trim(),
                icon: draft.icon,
                timeGroup: draft.timeGroup,
                repeatDays: draft.repeatDays,
                scheduledTime: draft.scheduledTime || undefined,
                alarmEnabled: nativeAlarmEditor ? alarmEnabled : draft.alarmEnabled,
              }, { alarmPermissionDenied, alarmPermissionDeferred });
            } catch {
              setAlarmNotice(isCurrentEditorScope() ? "습관을 저장하지 못했어요. 다시 시도해 주세요."
                : "계정이 변경되었어요. 현재 계정에서 습관을 다시 열어 주세요.");
            } finally {
              alarmCheckingRef.current = false;
              setAlarmChecking(false);
            }
          })();
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
              {featuredTemplates.map((template) => (
                <button
                  type="button"
                  key={template.title}
                  aria-label={template.title + " 템플릿"}
                  aria-pressed={
                    draft.title === template.title &&
                    draft.icon === template.icon &&
                    draft.timeGroup === template.timeGroup &&
                    draft.scheduledTime === template.scheduledTime
                  }
                  onClick={() => {
                    const preserveName = nameEdited && Boolean(draft.title.trim());
                    setTemplateNotice(preserveName ? "작성한 이름은 유지하고 추천 설정만 적용했어요." : "");
                    setDraft((prev) => ({
                      ...prev,
                      title: preserveName ? prev.title : template.title,
                      icon: template.icon,
                      // Preserve a manually chosen time and its matching group.
                      timeGroup: templateGroupForTime(prev.scheduledTime, template.timeGroup, timeEdited),
                      scheduledTime: timeEdited ? prev.scheduledTime : template.scheduledTime,
                    }));
                  }}
                >
                  <span aria-hidden="true">{template.icon}</span>
                  <span>{template.title}</span>
                </button>
              ))}
            </div>
            {templateNotice && <p className="habit-editor-template-notice" role="status">{templateNotice}</p>}
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
            onChange={(e) => {
              setNameEdited(true);
              setTemplateNotice("");
              setDraft((prev) => ({ ...prev, title: e.target.value }));
            }}
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
                      onClick={() => {
                        if (draft.scheduledTime && scheduledTimeGroup(draft.scheduledTime) !== group) {
                          setTimeEdited(true);
                        }
                        setDraft((prev) => ({
                          ...prev,
                          timeGroup: group,
                          scheduledTime: timeForSelectedGroup(prev.scheduledTime, group),
                        }));
                      }}
                    >
                      <Icon size={15} aria-hidden="true" /> {GROUPS[group].name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {habit && scheduledTimeField}
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
          {!habit && <div className="habit-editor-optional-time">{scheduledTimeField}</div>}
          {nativeAlarmEditor && (
            <div className="habit-editor-alarm-row">
              <div className="compact-setting-row">
                <span className="account-setting-heading">
                  <span>이 습관 알림</span>
                  <small>{!draft.scheduledTime ? "예정 시간을 먼저 선택해 주세요" :
                    draft.alarmEnabled ? (nativeAlarmActive ? "설정한 시간에 알려드려요" : habit?.alarmEnabled
                      ? "저장된 알림 설정을 유지해요. 기기 권한을 확인해 주세요." : "저장할 때 알림 권한을 확인해요") :
                    "알림 없이 습관만 기록해요"}</small>
                </span>
                <button
                  type="button"
                  className="compact-setting-toggle"
                  role="switch"
                  aria-label="이 습관 알림"
                  aria-checked={Boolean(draft.alarmEnabled)}
                  disabled={alarmChecking || (!draft.scheduledTime && !draft.alarmEnabled)}
                  onClick={() => {
                    if (alarmCheckingRef.current) return;
                    setAlarmTouched(true);
                    if (draft.alarmEnabled) {
                      alarmCheckedTime.current = undefined;
                      setDraft((prev) => ({ ...prev, alarmEnabled: false }));
                      setAlarmNotice("");
                      return;
                    }
                    alarmCheckingRef.current = true;
                    setAlarmChecking(true);
                    setAlarmNotice("");
                    void (async () => {
                      try {
                        const enabled = await enableNativeAlarm(true);
                        if (enabled && isCurrentEditorScope()) {
                          alarmCheckedTime.current = draft.scheduledTime;
                          setDraft((prev) => ({ ...prev, alarmEnabled: true }));
                        }
                        else setAlarmNotice("Android 알림 사용을 허용한 뒤 다시 켜주세요.");
                      } catch {
                        setAlarmNotice("알림을 활성화하지 못했습니다. 다시 시도해 주세요.");
                      } finally {
                        alarmCheckingRef.current = false;
                        setAlarmChecking(false);
                      }
                    })();
                  }}
                ><span className="compact-switch-track" aria-hidden="true"><span className="compact-switch-thumb" /></span></button>
              </div>
              {alarmNotice && <p className="account-note" role="status">{alarmNotice}</p>}
            </div>
          )}
        </section>
        {onDelete && (
          <button type="button" className="delete-button" disabled={alarmChecking} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> 이 습관 삭제하기
          </button>
        )}
        <div className="habit-editor-footer">
          <button type="submit" className="primary full" disabled={alarmChecking}>
            <Check size={18} />
            {alarmChecking ? "저장 중…" : habit ? "수정 완료" : "새 습관 추가하기"}
          </button>
          {habit && <button type="button" className="text-button full" onClick={requestClose}>취소</button>}
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
  guardUnsaved = false,
}: {
  habit: Habit;
  onSave: (data: DailyRecordPatch) => void;
  onClose: () => void;
  fallbackFocusId: string;
  guardUnsaved?: boolean;
}) {
  const [draft, setDraft] = useState<DailyRecordPatch>({
    rating: habit.rating,
    completed: habit.completed,
    memo: habit.memo,
  });
  const initialDraft = useRef(draft);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const requestClose = () => {
    if (guardUnsaved && hasUnsavedDailyRecord(initialDraft.current, draft)) {
      setDiscardPrompt(true);
      return;
    }
    onClose();
  };
  return (
    <Modal title="오늘의 실천 기록" onClose={requestClose} fallbackFocusId={fallbackFocusId}>
      {discardPrompt && <UnsavedChangesPrompt onContinue={() => setDiscardPrompt(false)} onDiscard={onClose} />}
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
          ].map((word) => {
            const selected = hasMemoKeyword(draft.memo, word);
            return (
              <button
                type="button"
                key={word}
                className={selected ? "selected" : ""}
                aria-pressed={selected}
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  memo: toggleMemoKeyword(prev.memo, word),
                }))}
              >
                {selected ? "✓ " : "+ "}{word}
              </button>
            );
          })}
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
        disabled={draft.rating <= 0}
        onClick={() =>
          onSave({
            rating: draft.rating,
            completed: true,
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
      {habit.completed && (
        <button
          type="button"
          className="text-button full habit-detail-undo"
          onClick={() => onSave({ completed: false, rating: 0, memo: draft.memo })}
        >
          오늘 실천 기록 취소
        </button>
      )}
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
  isSample = false,
  firstPractice = false,
}: {
  habit: Habit;
  showTimeGroup: boolean;
  isSample?: boolean;
  firstPractice?: boolean;
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
        {isSample && <span className="habit-sample-badge">예시</span>}
        {habit.memo && <p>{habit.memo}</p>}
        <span className="card-meta-row">
          <HabitTimeMeta habit={habit} showTimeGroup={showTimeGroup} />
          {habit.completed && (
            <span className="status-pill done">
              <Check size={10} aria-hidden="true" />
              실천 완료
            </span>
          )}
        </span>
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
      {firstPractice && <p className="habit-first-practice" role="status"><Sparkles size={14} aria-hidden="true" /> 첫 실천이에요! 작은 시작이 빛나요.</p>}
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
  isSample = false,
  firstPractice = false,
}: {
  habit: Habit;
  showTimeGroup: boolean;
  isSample?: boolean;
  firstPractice?: boolean;
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
        aria-label={habit.title + (isSample ? ", 예시 습관" : "") + (habit.rating > 0
          ? ", 실천 완료, 별점 " + habit.rating + "점"
          : habit.completed ? ", 실천 완료, 별점 없이 체크" : ", 미기록") + ", 기록하기"}
        onClick={onToggle}
      >
        <span className={"compact-habit-emoji " + habit.timeGroup} aria-hidden="true">{habit.icon}</span>
        <span className="compact-habit-title" title={habit.title}>{habit.title}</span>
        {isSample && <span className="habit-sample-badge compact-sample-badge">예시</span>}
        <span className="compact-habit-status" aria-hidden="true">
          {habit.completed && <Check size={15} />}
          {habit.rating > 0 ? <><Star size={15} fill="currentColor" />{habit.rating}</> : "—"}
        </span>
        {expanded ? <ChevronUp className="compact-habit-chevron" size={17} aria-hidden="true" /> : <ChevronDown className="compact-habit-chevron" size={17} aria-hidden="true" />}
      </button>
      {firstPractice && <p className="habit-first-practice compact-first-practice" role="status"><Sparkles size={13} aria-hidden="true" /> 첫 실천이에요! 작은 시작이 빛나요.</p>}
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
          const light = dailyStarlight(key > today ? undefined : history[key], key);
          const score = stats(history[key] || [], key).average;
          const description = key > today
            ? "미래 날짜"
            : light.state === "unrecorded"
              ? "기록 없음"
              : light.state === "rest"
                ? "예정된 습관 없음"
                : `${light.completedCount}/${light.scheduledCount} 실천, ${score ? `평균 ${score.toFixed(1)}점` : "별점 기록 없음"}, 하루 별빛 ${Number(light.percent.toFixed(1))}%`;
          return (
            <button
              key={key}
              disabled={key > today}
              aria-label={`${index + 1}월 ${i + 1}일${key === today ? " 오늘" : ""}, ${description}`}
              className={`day-tile tier-${light.tier} ${key === today ? "today" : ""}`}
              onClick={() => onDate(key)}
            >
              {i + 1}
              {key === today && <span className="today-dot" />}
            </button>
          );
        })}
      </div>
      <div className="matrix-legend" aria-label="예정된 습관 전체 기준 하루 별빛">
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
          <span>기록한 별점 평균</span>
          <b className="gold">
            <Star size={15} fill="currentColor" />
            {ratings.length
              ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
              : "—"}
          </b>
        </div>
      </div>
      <p className="calendar-footnote">예정된 습관 전체의 별점으로 하루의 색이 채워져요.</p>
    </section>
  );
}

export default function Byeolharu({ nativeUpdates, nativeReminders, nativeShare, nativeBackupExport, nativeAuthReturn, nativeReminderNavigation, nativeHabitNavigation }: {
  nativeUpdates?: NativeUpdateControls;
  nativeReminders?: NativeReminderControls;
  nativeShare?: (png: Blob, filename: string) => Promise<void>;
  nativeBackupExport?: (content: string) => Promise<void>;
  nativeAuthReturn?: number;
  nativeReminderNavigation?: { tab: TimeGroup; serial: number } | null;
  nativeHabitNavigation?: HabitReminderNavigation | null;
} = {}) {
  const app = useHabitApp(initialHabits, nativeBackupExport);
  const habits = app.snapshot?.habits ?? [];
  const history = app.snapshot?.history ?? {};
  const ready = !!app.snapshot;
  const setHabits = app.setHabits;
  const onAccountSnapshot = nativeReminders?.onSnapshot;
  useEffect(() => {
    onAccountSnapshot?.(app.snapshot, app.user?.id ?? null);
  }, [onAccountSnapshot, app.user?.id, app.snapshot]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPage, setAccountPage] = useState<AccountPage>("home");
  const handledAuthReturn = useRef(0);
  useEffect(() => {
    if (!ready || !nativeAuthReturn || nativeAuthReturn <= handledAuthReturn.current) return;
    handledAuthReturn.current = nativeAuthReturn;
    // A navigation-only link never signs in or switches existing accounts.
    if (!app.user) {
      setAccountPage("login");
      setAccountOpen(true);
    }
  }, [nativeAuthReturn, ready, app.user]);
  useEffect(() => {
    if (!app.user && (accountPage === "security" || accountPage === "withdraw")) setAccountPage("home");
  }, [app.user, accountPage]);
  const [constellationOpen, setConstellationOpen] = useState(false);
  const [starlightPreviewOpen, setStarlightPreviewOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [celebration, setCelebration] = useState<{ stage: number; scope: string; day: string } | null>(null);
  const [firstPractice, setFirstPractice] = useState<{ id: string; scope: string; day: string } | null>(null);
  const firstPracticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPracticeSeen = useRef(new Set<string>());
  const [hintDismissal, setHintDismissal] = useState<{ scope: string; dismissed: boolean } | null>(null);
  const [sampleCleanupOpen, setSampleCleanupOpen] = useState(false);
  const [sampleCleanupBusy, setSampleCleanupBusy] = useState(false);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [themeMode, setThemeMode] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [themePreferenceLoaded, setThemePreferenceLoaded] = useState(false);
  const theme = resolveTheme(themeMode, systemDark);
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
  const handledReminderNavigation = useRef(0);
  useEffect(() => {
    if (!ready || !nativeReminderNavigation ||
        nativeReminderNavigation.serial <= handledReminderNavigation.current) return;
    handledReminderNavigation.current = nativeReminderNavigation.serial;
    tabChosenManually.current = true;
    setActiveTab(nativeReminderNavigation.tab);
    setAccountOpen(false);
    setConstellationOpen(false);
    setReflectionOpen(false);
  }, [ready, nativeReminderNavigation]);
  const [month, setMonth] = useState(new Date(2026, 10, 1));
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [nativeDetailOrigin, setNativeDetailOrigin] = useState<{ scope: string; day: string } | null>(null);
  const handledHabitNavigation = useRef(0);
  const [toast, setToast] = useState("");
  const [pastDate, setPastDate] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [startupPermissionBusy, setStartupPermissionBusy] = useState(false);
  const startupPermissionBusyRef = useRef(false);
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
  const editorScope = useRef(scope);
  useEffect(() => {
    if (editorScope.current !== scope) {
      // An old account's unsaved alarm draft cannot be reused by the next account.
      editorScope.current = scope;
      setEditing(null);
    }
  }, [scope]);
  // A dismissed first-use hint stays dismissed for this local account scope.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(FIRST_HINT_DISMISS_KEY + scope) === "1";
    } catch {
      // A blocked display preference must not affect habit data.
    }
    setHintDismissal({ scope, dismissed });
  }, [scope]);
  const dismissFirstHint = () => {
    setHintDismissal({ scope, dismissed: true });
    try {
      localStorage.setItem(FIRST_HINT_DISMISS_KEY + scope, "1");
    } catch {
      // Still dismissed for this session.
    }
  };
  const hasCelebratedFirstPractice = (actionScope: string) => {
    if (firstPracticeSeen.current.has(actionScope)) return true;
    try {
      return localStorage.getItem(FIRST_PRACTICE_SEEN_KEY + actionScope) === "1";
    } catch {
      return false;
    }
  };
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    const date = new Date();
    try {
      setThemeMode(parseThemePreference(
        localStorage.getItem(THEME_PREFERENCE_KEY),
        localStorage.getItem("byeolharu_v2_theme") ??
          localStorage.getItem("byeolharu_v1_theme"),
      ));
    } catch {
      // Display preferences must never block the habit database.
    }
    const appearance = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(appearance.matches);
    const onAppearanceChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    appearance.addEventListener("change", onAppearanceChange);
    setThemePreferenceLoaded(true);
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
      appearance.removeEventListener("change", onAppearanceChange);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      if (firstPracticeTimer.current) clearTimeout(firstPracticeTimer.current);
      if (compactCollapseTimer.current) clearTimeout(compactCollapseTimer.current);
      if (compactFocusTimer.current) clearTimeout(compactFocusTimer.current);
      if (normalFocusTimer.current) clearTimeout(normalFocusTimer.current);
      if (completedGroupNudgeTimer.current) clearTimeout(completedGroupNudgeTimer.current);
      for (const timer of reorderTimers.current.values()) clearTimeout(timer);
      reorderTimers.current.clear();
    };
  }, []);

  useLayoutEffect(() => {
    if (themePreferenceLoaded) document.documentElement.dataset.byeolharuTheme = theme;
  }, [themePreferenceLoaded, theme]);

  useEffect(() => {
    if (!themePreferenceLoaded) return;
    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    themeColor?.setAttribute("content", theme === "light" ? "#F7F6F2" : "#0C111B");
    try {
      localStorage.setItem(THEME_PREFERENCE_KEY, themeMode);
    } catch {
      // Device display settings are optional and independent of habit data.
    }
  }, [theme, themeMode, themePreferenceLoaded]);

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

  // Transient UI acknowledgement only; an existing completed history never replays it.
  const celebrateFirstPractice = (id: string, actionScope: string, actionDay: string) => {
    if (activeScope.current !== actionScope || hasCelebratedFirstPractice(actionScope)) return;
    // Set only after a successful persisted completion; a later undo/retry must
    // not celebrate again, even when the current completed entry is removed.
    firstPracticeSeen.current.add(actionScope);
    try {
      localStorage.setItem(FIRST_PRACTICE_SEEN_KEY + actionScope, "1");
    } catch {
      // The in-memory gate still prevents duplicates this session.
    }
    setFirstPractice({ id, scope: actionScope, day: actionDay });
    if (firstPracticeTimer.current) clearTimeout(firstPracticeTimer.current);
    firstPracticeTimer.current = setTimeout(() => setFirstPractice(null), FIRST_PRACTICE_FEEDBACK_MS);
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
    if (!rating) {
      setCelebration(null);
      if (firstPractice?.id === id) setFirstPractice(null);
    }
    const earnedStage = app.snapshot && earnedStageFromCompletion(
      app.snapshot, visibleHabits,
      applyDailyRecord(habit, { rating, completed: rating > 0, memo: habit.memo }),
    );
    const firstCompletion = app.snapshot && !hasCelebratedFirstPractice(scope) &&
      canCelebrateFirstPractice(app.snapshot, !!app.user, habit, rating > 0);
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
      }, firstCompletion ? FIRST_PRACTICE_HOLD_MS : 700),
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
        if (firstCompletion && ratingOverridesRef.current.get(id) === override) {
          celebrateFirstPractice(id, scope, day);
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
  const handleSave = async (data: HabitSettingsPatch, meta?: { alarmPermissionDenied: boolean; alarmPermissionDeferred?: boolean }) => {
    // The permission choice may leave the app for Android Settings. Never
    // write an old editor draft into an account that changed in the meantime.
    if (scope !== activeScope.current) throw Error("계정이 변경되었어요.");
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
      // Preserve the existing return-to-All behavior. Explain rest days rather
      // than implying the newly created habit will appear in today's list.
      tabChosenManually.current = true;
      setActiveTab("all");
      const scheduledToday = app.snapshot?.day
        ? isScheduled(newHabit, app.snapshot.day)
        : true;
      showToast(meta?.alarmPermissionDenied
        ? "✦ 습관은 저장했어요. 알림 권한이 없어 알림은 꺼졌어요."
        : scheduledToday
          ? `✦ '${newHabit.title}' 습관이 추가되었습니다!`
          : `✦ '${newHabit.title}' 추가 완료! 선택한 반복 요일에 표시돼요.`);
    } else if (editing) {
      const id = editing.id;
      await setHabits((prev) =>
        prev.map((h) => (h.id === id ? applyHabitSettings(h, data) : h)),
      );
      showToast(meta?.alarmPermissionDenied
        ? "✦ 습관은 수정했어요. 알림 권한이 없어 알림은 꺼졌어요."
        : meta?.alarmPermissionDeferred ? "✦ 습관은 수정했어요. 기존 알림 설정은 유지했어요."
        : "✦ 습관이 수정되었습니다!");
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
  const firstUse = useMemo(() => app.snapshot
    ? getFirstUseState(app.snapshot, !!app.user) : null,
    [app.snapshot, app.user]);
  const showFirstHint = !!firstUse?.showHint &&
    hintDismissal?.scope === scope && !hintDismissal.dismissed;
  // IDs come from the original local-demo migration, never from title
  // matching. User-created habits and member records must remain untouched.
  const sampleHabits = !app.user
    ? habits.filter((habit) => firstUse?.sampleIds.has(habit.id))
    : [];
  const handleClearSampleHabits = async () => {
    if (sampleCleanupBusy || app.user || !app.snapshot || !sampleHabits.length) return;
    const sampleIds = new Set(sampleHabits.map((habit) => habit.id));
    const actionScope = scope;
    setSampleCleanupBusy(true);
    try {
      await setHabits((previous) => previous.filter((habit) => !sampleIds.has(habit.id)));
      if (activeScope.current !== actionScope) return;
      tabChosenManually.current = true;
      setActiveTab("all");
      setSampleCleanupOpen(false);
      showToast(`예시 습관 ${sampleIds.size}개를 정리했어요.`);
    } catch {
      showToast("예시 정리에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSampleCleanupBusy(false);
    }
  };
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
  const filteredRestingHabits = restingHabits.filter(
    (habit) => activeTab === "all" || habit.timeGroup === activeTab,
  );
  // Keep the existing routine view but distinguish "no registered habits"
  // from a genuine rest day and from an empty time-of-day tab.
  const isRestDay = ready && habits.length > 0 && scheduledHabits.length === 0;
  const emptyRoutineTitle = !ready
    ? "오늘의 루틴을 준비하고 있어요"
    : !habits.length
      ? "아직 등록된 습관이 없어요"
      : isRestDay
        ? "오늘은 루틴 쉬는 날이에요"
        : "이 시간대에 예정된 습관이 없어요";
  const emptyRoutineDescription = isRestDay
    ? "등록한 습관은 선택한 반복 요일에 다시 나타나요."
    : "가볍게 시작할 수 있는 작은 약속을 만들어보세요.";
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
  const registerWidgetPractice = nativeReminders?.registerWidgetPractice;
  useEffect(() => {
    return registerWidgetPractice?.((command, deadline) => {
      if (editing || detailId || accountOpen || constellationOpen || pastDate || sampleCleanupOpen ||
          app.busy || ratingOverrides.size || document.querySelector("dialog[open]")) return Promise.resolve("not-ready");
      return app.applyWidgetPractice(command, deadline);
    });
  }, [registerWidgetPractice, app.applyWidgetPractice, editing, detailId, accountOpen, constellationOpen,
    pastDate, sampleCleanupOpen, app.busy, ratingOverrides]);
  // Native taps are navigation-only. Resolve against the actual hydrated
  // account/day, never the notification payload or a stale guest placeholder.
  useEffect(() => {
    if (!nativeHabitNavigation || nativeHabitNavigation.serial <= handledHabitNavigation.current) return;
    const result = resolveHabitReminder(nativeHabitNavigation, {
      snapshot: app.snapshot,
      memberId: app.user?.id ?? null,
      habits: visibleHabits,
      now: new Date(),
      blocked: Boolean(editing || detailId || accountOpen || constellationOpen ||
        pastDate || sampleCleanupOpen || app.busy || document.querySelector("dialog[open]")),
    });
    if (result.kind === "wait") return;
    handledHabitNavigation.current = nativeHabitNavigation.serial;
    if (result.kind !== "open") return;
    tabChosenManually.current = true;
    setReflectionOpen(false);
    setActiveTab(result.habit.timeGroup);
    setNativeDetailOrigin({ scope, day: today });
    setDetailId(result.habit.id);
  }, [nativeHabitNavigation, app.snapshot, app.user, visibleHabits, editing,
    detailId, accountOpen, constellationOpen, pastDate, sampleCleanupOpen,
    app.busy, scope, today]);

  const nativeDetailValid = !nativeDetailOrigin ||
    (nativeDetailOrigin.scope === scope && nativeDetailOrigin.day === today);
  useEffect(() => {
    if (!nativeDetailValid) {
      setDetailId(null);
      setNativeDetailOrigin(null);
    }
  }, [nativeDetailValid]);
  const detail = nativeDetailValid ? visibleHabits.find((h) => h.id === detailId) : undefined;
  // A restored reminder invitation never interrupts account/login screens,
  // an editor, an active record action, or a pending native navigation tap.
  const startupPermissionContext = Boolean(
    app.snapshot && startupDataReady(!!app.user, app.snapshot) &&
    !editing && !detailId && !accountOpen && !constellationOpen && !reflectionOpen &&
    !pastDate && !sampleCleanupOpen && !celebration && !firstPractice &&
    !ratingOverrides.size && activeTab !== "matrix" &&
    (!nativeAuthReturn || nativeAuthReturn <= handledAuthReturn.current) &&
    (!nativeHabitNavigation || nativeHabitNavigation.serial <= handledHabitNavigation.current) &&
    (!nativeReminderNavigation || nativeReminderNavigation.serial <= handledReminderNavigation.current));
  const startupPermissionContextRef = useRef({ current: startupPermissionContext, revision: 0 });
  if (startupPermissionContextRef.current.current !== startupPermissionContext) {
    startupPermissionContextRef.current = { current: startupPermissionContext, revision: startupPermissionContextRef.current.revision + 1 };
  }
  const startupPermissionOpen = Boolean(nativeReminders?.startupPermissionOffer && startupPermissionContext && !app.busy &&
    typeof document !== "undefined" && document.visibilityState === "visible");
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
  // A finished time tab may still have scheduled habits in other periods today.
  const isTimeRoutine = activeTab !== "all" && activeTab !== "matrix";
  const showRoutineCompletion = isTimeRoutine && filtered.length > 0 && compactPending.length === 0;
  const otherPendingCount = showRoutineCompletion && completionDataReady
    ? countOtherPendingHabits(activeTab, scheduledHabits,
        (habit) => heldCompletion.get(habit.id) ?? habit.completed)
    : 0;
  const completionFeedback = (
    <div className="routine-completion-card">
      <Check size={22} aria-hidden="true" />
      <p className="routine-completion-label">
        {isTimeRoutine ? `${GROUPS[activeTab].name} 루틴을 모두 마쳤어요` : "오늘의 실천을 모두 마쳤어요 ✨"}
      </p>
      {otherPendingCount > 0 && (
        <button
          type="button"
          className="routine-completion-link"
          onClick={() => {
            tabChosenManually.current = true;
            document.getElementById("tab-all")?.focus();
            setActiveTab("all");
          }}
        >
          <span>다른 시간대에 예정된 습관 {otherPendingCount}개</span>
          <span className="routine-completion-action">전체 보기 <ChevronRight size={16} aria-hidden="true" /></span>
        </button>
      )}
    </div>
  );
  useEffect(() => {
    setCompletedOpen(false);
    setCompactExpandedId(null);
  }, [activeTab, today, scope]);
  // The reflection belongs to one local day and one account scope only.
  useEffect(() => {
    setReflectionOpen(false);
    setFirstPractice(null);
    if (firstPracticeTimer.current) clearTimeout(firstPracticeTimer.current);
  }, [today, scope]);

  // Only after this time group is clear, gently surface earlier pending habits.
  // The active account's day and timezone are already reflected in scheduledHabits/displayNow.
  const earlierPendingCount = completionDataReady && compactPending.length === 0 && displayNow
    ? countEarlierPendingHabits(activeTab, scheduledHabits, displayNow.getHours(),
        (habit) => heldCompletion.get(habit.id) ?? habit.completed)
    : 0;
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

  const renderCard = (habit: Habit) => (
    <HabitCard
      key={habit.id}
      habit={habit}
      showTimeGroup={activeTab === "all" || activeTab !== habit.timeGroup}
      isSample={firstUse?.sampleIds.has(habit.id)}
      firstPractice={firstPractice?.id === habit.id && firstPractice.scope === scope && firstPractice.day === today}
      onRate={(id, value, fromKeyboard) => {
        const firstCompletion = !!app.snapshot && !hasCelebratedFirstPractice(scope) &&
          canCelebrateFirstPractice(app.snapshot, !!app.user, habit, habit.rating !== value);
        handleRateHabit(id, value);
        if (normalFocusTimer.current) clearTimeout(normalFocusTimer.current);
        const movesGroup = (heldCompletion.get(id) ?? habit.completed) !== (habit.rating === value ? false : true);
        if (fromKeyboard && movesGroup) {
          // Transfer focus before completed cards move to the collapsed group,
          // without affecting rating edits.
          normalFocusTimer.current = setTimeout(() => {
            const activeCard = document.activeElement?.closest(".habit-card");
            if (activeCard?.getAttribute("data-habit-id") !== id) {
              normalFocusTimer.current = null;
              return;
            }
            const next = Array.from(document.querySelectorAll<HTMLElement>(
              ".normal-pending-list .habit-card .card-rating button",
            )).find((button) =>
              button.closest(".habit-card")?.getAttribute("data-habit-id") !== id,
            );
            // The selected tab survives after the final pending card moves.
            const fallback = habit.rating === value
              ? document.getElementById("tab-" + activeTab)
              : (document.querySelector<HTMLButtonElement>(".normal-done-toggle")
                ?? document.getElementById("tab-" + activeTab));
            (next ?? fallback)?.focus();
            normalFocusTimer.current = null;
          }, firstCompletion ? FIRST_PRACTICE_HOLD_MS - 100 : 600);
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
      isSample={firstUse?.sampleIds.has(habit.id)}
      firstPractice={firstPractice?.id === habit.id && firstPractice.scope === scope && firstPractice.day === today}
      expanded={compactExpandedId === habit.id}
      onToggle={() => setCompactExpandedId((previous) => previous === habit.id ? null : habit.id)}
      onRate={(value, fromKeyboard) => {
        const firstCompletion = !!app.snapshot && !hasCelebratedFirstPractice(scope) &&
          canCelebrateFirstPractice(app.snapshot, !!app.user, habit, habit.rating !== value);
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
          }, firstCompletion ? FIRST_PRACTICE_HOLD_MS - 100 : 600);
        }
        if (compactCollapseTimer.current) clearTimeout(compactCollapseTimer.current);
        compactCollapseTimer.current = setTimeout(() => {
          setCompactExpandedId((previous) => previous === habit.id ? null : previous);
          compactCollapseTimer.current = null;
        }, firstCompletion ? FIRST_PRACTICE_HOLD_MS - 100 : 700);
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
              오늘의 습관
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
              disabled={!themePreferenceLoaded}
              onClick={() => setThemeMode(theme === "light" ? "dark" : "light")}
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
        {nativeUpdates?.notice && startupPermissionContext && !startupPermissionOpen && !app.busy && !storageWarning && (
          <AppUpdateNotice update={nativeUpdates} />
        )}
        {reflectionOpen ? (
          <WeeklyReflectionView
            reflection={weeklyReflection}
            onBack={() => { setReflectionOpen(false); setActiveTab("matrix"); }}
            onToday={() => {
              tabChosenManually.current = true;
              setReflectionOpen(false);
              setActiveTab("all");
            }}
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
            <div className="metric-label">오늘의 실천</div>
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
            {showFirstHint && (
              <div className="first-habit-hint" role="note">
                <Leaf size={16} aria-hidden="true" />
                <span className="first-habit-hint-copy">나만의 첫 습관을 만들어볼까요? <span>‘새 습관 추가’에서 시작해요.</span></span>
                <button type="button" className="first-habit-hint-close" onClick={dismissFirstHint} aria-label="시작 안내 숨기기">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="routine-heading">
              <h2>
                {activeTab === "matrix"
                  ? "차곡차곡 쌓인 나의 별"
                  : activeTab === "all"
                    ? "오늘의 습관"
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
            {sampleHabits.length > 0 && (
              <div className="sample-cleanup-strip">
                <span>예시 습관 {sampleHabits.length}개</span>
                <button type="button" onClick={() => setSampleCleanupOpen(true)}>
                  예시 한 번에 정리
                </button>
              </div>
            )}
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
                    onDate={setPastDate}
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
                        <p className="compact-all-done">{emptyRoutineTitle}{isRestDay ? " · 선택한 요일에 다시 만나요." : ""}</p>
                      )}
                      {filtered.length > 0 && (
                        <>
                          {compactPending.length > 0 && (
                            <div className="compact-habit-group" aria-label="실천할 습관">
                              {compactPending.map(renderCompactCard)}
                            </div>
                          )}
                          {compactPending.length === 0 && completionFeedback}
                          {compactCompleted.length > 0 && (
                            <section className="compact-done-group" aria-label="완료한 습관">
                              <button
                                type="button"
                                className={`compact-done-toggle ${completedGroupNudge ? `completion-nudge completion-nudge-${completedGroupNudge}` : ""}`}
                                aria-expanded={completedOpen}
                                aria-controls="compact-completed-list"
                                onClick={() => setCompletedOpen((value) => !value)}
                              >
                                <span>{!showRoutineCompletion && <CheckCircle2 size={17} aria-hidden="true" />} 완료한 습관 {compactCompleted.length}개</span>
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
                      {filteredRestingHabits.length > 0 && (
                        <details className="compact-resting-group">
                          <summary>
                            <span><Moon size={16} aria-hidden="true" /> 오늘 쉬는 습관 {filteredRestingHabits.length}개</span>
                            <ChevronDown size={16} aria-hidden="true" />
                          </summary>
                          <div className="compact-resting-list">
                            {filteredRestingHabits.map((habit) => (
                              <button
                                type="button"
                                key={habit.id}
                                onClick={() => setEditing(habit)}
                                aria-label={`${habit.title} 반복 요일 수정`}
                              >
                                <span aria-hidden="true">{habit.icon}</span>
                                <span>{habit.title}</span>
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="normal-habit-list">
                      {compactPending.length > 0 && (
                        <div className="habit-grid normal-pending-list" aria-label="실천할 습관">
                          {compactPending.map((habit) => renderCard(habit))}
                        </div>
                      )}
                      {filtered.length > 0 && compactPending.length === 0 && completionFeedback}
                      {compactCompleted.length > 0 && (
                        <section className="normal-completed-group" aria-label="완료한 습관">
                          <button
                            type="button"
                            className={`normal-done-toggle ${completedGroupNudge ? `completion-nudge completion-nudge-${completedGroupNudge}` : ""}`}
                            aria-expanded={completedOpen}
                            aria-controls="normal-completed-list"
                            onClick={() => setCompletedOpen((value) => !value)}
                          >
                            <span>{!showRoutineCompletion && <CheckCircle2 size={18} aria-hidden="true" />} 완료한 습관 {compactCompleted.length}개</span>
                            <span>{completedOpen ? "접기" : "보기"} {completedOpen ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}</span>
                          </button>
                          {completedOpen && (
                            <div id="normal-completed-list" className="habit-grid normal-completed-list">
                              {compactCompleted.map((habit) => renderCard(habit))}
                            </div>
                          )}
                        </section>
                      )}
                      {!filtered.length && (
                        <div className={`empty-state ${isRestDay ? "is-resting" : ready && isTimeRoutine && scheduledHabits.length > 0 ? "empty-time-routine" : ""}`}>
                          <Leaf size={25} />
                          <h3>{emptyRoutineTitle}</h3>
                          <p>{emptyRoutineDescription}</p>
                          {ready && !habits.length && (
                            <button className="text-button" onClick={() => setEditing("new")}>
                              <Plus size={15} />첫 습관 추가하기
                            </button>
                          )}
                          {ready && habits.length > 0 && !isRestDay && activeTab !== "all" && earlierPendingCount === 0 && (
                            <button className="text-button" onClick={() => {
                              tabChosenManually.current = true;
                              setActiveTab("all");
                            }}>
                              전체에서 보기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!compactView && filteredRestingHabits.length > 0 && (
                    <section
                      className="resting-habits"
                      aria-label="오늘 쉬는 습관"
                    >
                      <h3>오늘 쉬는 습관</h3>
                      {filteredRestingHabits
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
                  {earlierPendingCount > 0 && !showRoutineCompletion && (
                    <button
                      type="button"
                      className="earlier-pending-link"
                      onClick={() => {
                        tabChosenManually.current = true;
                        // The shortcut unmounts after switching tabs; transfer
                        // keyboard focus to a control that remains mounted.
                        document.getElementById("tab-all")?.focus();
                        setActiveTab("all");
                      }}
                      aria-label={`다른 시간대에 남은 습관 ${earlierPendingCount}개, 전체 보기`}
                    >
                      <span className="earlier-pending-label">
                        <span className="earlier-pending-dot" aria-hidden="true" />
                        다른 시간대에 남은 습관 <strong>{earlierPendingCount}개</strong>
                      </span>
                      <span className="earlier-pending-action">전체 보기 <ChevronRight size={16} aria-hidden="true" /></span>
                    </button>
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
      {startupPermissionOpen && nativeReminders?.startupPermissionOffer && (
        <ReminderPermissionDialog
          permissionState={nativeReminders.permissionState}
          exactPermission={nativeReminders.exactPermission}
          busy={startupPermissionBusy || nativeReminders.busy}
          onCancel={() => {
            if (!startupPermissionBusyRef.current) nativeReminders.onDismissStartupPermissionOffer();
          }}
          onConfirm={() => {
            if (startupPermissionBusyRef.current || nativeReminders.busy) return;
            startupPermissionBusyRef.current = true;
            setStartupPermissionBusy(true);
            const context = startupPermissionContextRef.current;
            void nativeReminders.onRequestStartupPermission(() => scope === activeScope.current && context.current && startupPermissionContextRef.current === context).catch(() => false).finally(() => {
              startupPermissionBusyRef.current = false;
              setStartupPermissionBusy(false);
            });
          }}
        />
      )}
      {sampleCleanupOpen && (
        <ConfirmDialog
          title={`예시 습관 ${sampleHabits.length}개를 정리할까요?`}
          description={<>
            <span className="confirm-description-line">직접 만든 습관은 그대로 남아요.</span>
            <span className="confirm-description-line">지난 실천 기록도 보존돼요.</span>
          </>}
          cancelLabel="유지하기"
          confirmLabel="예시만 정리"
          busy={sampleCleanupBusy}
          onCancel={() => setSampleCleanupOpen(false)}
          onConfirm={() => { void handleClearSampleHabits(); }}
        />
      )}
      {editing && editorScope.current === scope && (
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
          onSave={(data, meta) => handleSave(data, meta)}
          onDelete={
            editing !== "new"
              ? () => {
                  void handleDelete().catch(() => {});
                }
              : undefined
          }
          onClose={() => setEditing(null)}
          guardUnsaved={Boolean(nativeReminders)}
          nativeAlarmEditor={Boolean(nativeReminders)}
          nativeAlarmActive={nativeReminders?.active}
          nativeAlarmIntentEnabled={nativeReminders?.enabled}
          isCurrentEditorScope={() => scope === activeScope.current}
          onEnsureNativeAlarm={nativeReminders ? () => scope === activeScope.current
            ? nativeReminders.onEnabledChange(true) : Promise.resolve(false) : undefined}
          onCheckNativePermissions={nativeReminders?.onCheckPermissions}
          onRequestPermission={nativeReminders?.onRequestPermission}
          onDismissPermission={nativeReminders?.onDismissPermissionOffer}
        />
      )}
      {detail && (
        <HabitDetail
          key={detail.id}
          habit={detail}
          fallbackFocusId={reflectionOpen ? "weekly-reflection-back" : `tab-${activeTab}`}
          guardUnsaved={Boolean(nativeReminders)}
          onClose={() => { setDetailId(null); setNativeDetailOrigin(null); }}
          onSave={(data) => {
            // Do not write a reminder-opened draft into another day's record.
            if (nativeDetailOrigin && (nativeDetailOrigin.scope !== activeScope.current ||
                nativeDetailOrigin.day !== dateKey(new Date(), app.user ? app.snapshot?.state.timezone : undefined))) {
              setDetailId(null);
              setNativeDetailOrigin(null);
              showToast("기록 날짜가 바뀌었어요. 오늘의 습관을 다시 열어주세요.");
              return;
            }
            const actionDay = today;
            const actionScope = scope;
            if (!data.completed) setCelebration(null);
            const earnedStage = app.snapshot && earnedStageFromCompletion(
              app.snapshot, visibleHabits, applyDailyRecord(detail, data),
            );
            const firstCompletion = app.snapshot && !hasCelebratedFirstPractice(actionScope) &&
              canCelebrateFirstPractice(app.snapshot, !!app.user, detail, data.completed);
            void (async () => {
              if (firstCompletion) {
                const held = new Map(heldCompletionRef.current);
                held.set(detail.id, false);
                heldCompletionRef.current = held;
                setHeldCompletion(held);
                const priorTimer = reorderTimers.current.get(detail.id);
                if (priorTimer) clearTimeout(priorTimer);
                reorderTimers.current.set(detail.id, setTimeout(() => {
                  // Closing the detail dialog may restore focus into the held
                  // card. Its eventual move into the collapsed group must not
                  // strand keyboard focus on the document body.
                  const focusedCard = document.activeElement?.closest<HTMLElement>("[data-habit-id]");
                  if (focusedCard?.dataset.habitId === detail.id) {
                    const survivingControl = document.querySelector<HTMLButtonElement>(
                      compactView ? ".compact-done-toggle" : ".normal-done-toggle",
                    ) ?? document.getElementById("tab-" + activeTab);
                    survivingControl?.focus();
                  }
                  const next = new Map(heldCompletionRef.current);
                  next.delete(detail.id);
                  heldCompletionRef.current = next;
                  setHeldCompletion(next);
                  reorderTimers.current.delete(detail.id);
                }, FIRST_PRACTICE_HOLD_MS));
              }
              await setHabits((prev) =>
                prev.map((h) =>
                  h.id === detail.id ? applyDailyRecord(h, data) : h,
                ),
              );
              if (earnedStage) showStageCelebration(earnedStage, actionScope, actionDay);
              if (firstCompletion) celebrateFirstPractice(detail.id, actionScope, actionDay);
              setDetailId(null);
              setNativeDetailOrigin(null);
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
            nativeShare={nativeShare}
          />
        </Modal>
      )}
      {accountOpen && (
        <Modal
          accountScreen
          scrollKey={accountPage}
          title={accountPage === "home" ? "내 계정" : accountPage === "records" ? "데이터 관리" : accountPage === "import" ? "비회원 기록 가져오기" : accountPage === "settings" ? "앱 설정" : accountPage === "help" ? "사용 안내" : accountPage === "security" ? "계정 관리" : accountPage === "privacy" ? "개인정보처리방침" : accountPage === "withdraw" ? "회원 탈퇴" : accountPage === "login" ? "로그인" : accountPage === "signup" ? "회원가입" : "비밀번호 찾기"}
          onClose={() => { if (!app.deletingAccount) { setAccountOpen(false); setAccountPage("home"); } }}
          backLabel={accountPage === "withdraw" ? "계정 관리로" : "내 계정으로"}
          onBack={accountPage !== "home" ? () => { if (!app.deletingAccount) setAccountPage(accountPage === "withdraw" ? "security" : "home"); } : undefined}
          onEscape={() => {
            if (app.deletingAccount) return;
            if (accountPage !== "home") setAccountPage(accountPage === "withdraw" ? "security" : "home");
            else { setAccountOpen(false); setAccountPage("home"); }
          }}
        >
          <AccountPanel
            key={app.user?.id ?? "guest"}
            app={app}
            page={accountPage}
            onNavigate={setAccountPage}
            theme={themeMode}
            onThemeChange={setThemeMode}
            compactView={compactView}
            onCompactViewChange={updateCompactView}
            nativeReminders={nativeReminders}
            nativeUpdates={nativeUpdates}
            updateBlocked={Boolean(app.busy || ratingOverrides.size || storageWarning || !ready)}
            nativeBackup={Boolean(nativeBackupExport)}
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
      {pastDate && (
        <Modal
          title={`${Number(pastDate.slice(5, 7))}월 ${Number(pastDate.slice(8))}일의 별 기록`}
          onClose={() => setPastDate(null)}
        >
          <div className="past-summary">
            <Star size={28} className="gold" />
            {(() => {
              const light = dailyStarlight(allHistory[pastDate], pastDate);
              const average = stats(allHistory[pastDate] || [], pastDate).average;
              return light.state === "scheduled" ? (
                <>
                  <h3>{light.completedCount}/{light.scheduledCount} 실천 · 하루 별빛 {Number(light.percent.toFixed(1))}%</h3>
                  <p>기록한 별점 평균 {average ? `${average.toFixed(1)}★` : "—"}</p>
                </>
              ) : (
                <>
                  <h3>{light.state === "rest" ? "예정된 습관 없음" : "기록 없음"}</h3>
                  <p>{light.state === "rest" ? "이날은 쉬는 날이에요." : "이날은 아직 남겨진 기록이 없어요."}</p>
                </>
              );
            })()}
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
                  {!isScheduled(h, pastDate) ? "쉬는 날" : h.rating ? `${h.rating}★` : h.completed ? "완료" : "미실천"}
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
      <SyncNotice
        error={app.error}
        storageWarning={storageWarning}
        scope={scope}
        onRetry={() => app.sync()}
        onOpenLogin={() => { setAccountPage("login"); setAccountOpen(true); }}
        onOpenRecords={() => { setAccountPage("records"); setAccountOpen(true); }}
      />
    </div>
  );
}

import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import VoiceSheet from "./src/components/VoiceSheet";
import MicButton from "./src/components/MicButton";
import TopBar from "./src/components/TopBar";
import EventRow from "./src/components/EventRow";
import {
  isSameDay,
  getDateKey,
  getMonthKey,
  getCalendarDayIndex,
  formatNavigationTitle,
  getDayStartTime,
  addDays,
  createCalendarModel,
} from "./src/components/calendarHelpers";
import { weekDays, fullWeekDays } from "./src/components/calendarConstants";
import * as C from "./src/components/constants";
import { useVoiceInput } from "./src/components/useVoiceInput";
import { runCalendarAgent, executeAgentToolCalls } from "./src/api/calendarAgent";
import {
  getScheduleById,
  getSchedulesByDate,
  seedTestSchedulesForDate,
  updateSchedule as repoUpdateSchedule
} from "./src/api/schedules";
import {
  CATEGORIES,
  WEEKDAYS,
  REMINDER_OPTIONS,
  formatDateTime,
  parseDateTime,
  normalizeRecurrence,
  normalizeReminderMinutes
} from "./src/types/schedule";

const SHEET_CLOSED_Y = C.SHEET_CLOSED_Y;
const MIC_CLOSED_TRANSLATE_Y = C.MIC_CLOSED_TRANSLATE_Y;
const SHEET_CLOSE_THRESHOLD = C.SHEET_CLOSE_THRESHOLD;
const PAGE_HORIZONTAL_PADDING = C.PAGE_HORIZONTAL_PADDING;
const EVENT_ROW_HEIGHT = C.EVENT_ROW_HEIGHT;
const MARKER_CENTER_Y = C.MARKER_CENTER_Y;
const DATE_BLOCK_HEIGHT = C.DATE_BLOCK_HEIGHT;
const FLOATING_SUMMARY_HEIGHT = C.FLOATING_SUMMARY_HEIGHT;
const FLOATING_SUMMARY_TOP = C.FLOATING_SUMMARY_TOP;
const FLOATING_SUMMARY_GAP = C.FLOATING_SUMMARY_GAP;
const TIMELINE_LIST_HEADROOM = C.TIMELINE_LIST_HEADROOM;
const TIMELINE_CONTENT_BOTTOM = C.TIMELINE_CONTENT_BOTTOM;
const TIMELINE_PULL_OPEN_THRESHOLD = C.TIMELINE_PULL_OPEN_THRESHOLD;
const TIMELINE_PULL_ELASTIC_DISTANCE = C.TIMELINE_PULL_ELASTIC_DISTANCE;
const TIMELINE_PULL_INITIAL_RESISTANCE = C.TIMELINE_PULL_INITIAL_RESISTANCE;
const CALENDAR_PULL_OPEN_THRESHOLD = C.CALENDAR_PULL_OPEN_THRESHOLD;
const CALENDAR_PULL_ELASTIC_DISTANCE = C.CALENDAR_PULL_ELASTIC_DISTANCE;
const CALENDAR_PULL_INITIAL_RESISTANCE = C.CALENDAR_PULL_INITIAL_RESISTANCE;
const CALENDAR_BOTTOM_GAP = C.CALENDAR_BOTTOM_GAP;
const DAY_SWIPE_EDGE_RESISTANCE = C.DAY_SWIPE_EDGE_RESISTANCE;
const DAY_PREVIEW_WIDTH_RATIO = C.DAY_PREVIEW_WIDTH_RATIO;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const categoryTones = {
  work: "soft",
  personal: "warm",
  meeting: "primary",
  reminder: "light",
  travel: "soft"
};

const createChatId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getTimeText = (dateTime) => String(dateTime || "").slice(11, 16) || "--:--";

const reminderLabels = {
  0: "准时",
  5: "5分钟前",
  15: "15分钟前",
  30: "30分钟前",
  60: "1小时前",
  120: "2小时前",
  1440: "1天前",
  2880: "2天前",
  4320: "3天前",
  10080: "1周前"
};

const categoryLabels = {
  work: "工作",
  personal: "个人",
  meeting: "会议",
  reminder: "提醒",
  travel: "出行"
};

const recurrenceLabels = {
  none: "不重复",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年"
};

const weekdayLabels = {
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日"
};

const minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5);

function getDateOnlyKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatPickerDateLabel(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${fullWeekDays[date.getDay()]}`;
}

const scheduleToEvent = (schedule) => ({
  id: schedule.id,
  time: getTimeText(schedule.start_time),
  title: schedule.title || "未命名日程",
  meta: schedule.location || schedule.description || "",
  tone: categoryTones[schedule.category] || "soft",
  reminderMinutes: schedule.reminder_minutes
});

const operationLabels = {
  create_schedule: "已创建日程",
  update_schedule: "已更新日程",
  delete_schedule: "已删除日程"
};

const operationTones = {
  create_schedule: "success",
  update_schedule: "info",
  delete_schedule: "danger"
};

function formatEventResultTime(event) {
  if (!event?.start_time) return "";
  const start = String(event.start_time);
  const end = String(event.end_time || "");
  const date = start.slice(5, 10).replace("-", "月");
  const startTime = start.slice(11, 16);
  const endTime = end.slice(11, 16);
  return endTime ? `${date}日 ${startTime}-${endTime}` : `${date}日 ${startTime}`;
}

const requestedActionLabels = {
  create_schedule: "拟创建",
  update_schedule: "拟修改"
};

function toEventResultItem(event) {
  if (!event) return null;
  return {
    title: event.title || "未命名日程",
    time: formatEventResultTime(event),
    location: event.location || "",
    description: event.description || ""
  };
}

function buildEventResultMessages(result) {
  const traces = Array.isArray(result?.trace) ? result.trace : [];
  return traces
    .filter((trace) => trace?.type === "tool" && operationLabels[trace.name])
    .map((trace) => {
      const toolResult = trace.result || {};
      const conflicts = Array.isArray(toolResult.conflicts) ? toolResult.conflicts : [];
      const event = toolResult.event || toolResult.draft || null;
      const requested = toEventResultItem(event);

      if (toolResult.success === false && conflicts.length > 0) {
        return {
          id: createChatId(`event-conflict-${trace.name}`),
          role: "assistant",
          variant: "event_result",
          resultType: "conflict",
          operation: "时间冲突",
          tone: "warning",
          title: "这个时间段已有安排",
          meta: toolResult.message || "该时间段与已有日程冲突",
          requestedLabel: requestedActionLabels[trace.name] || "请求日程",
          requested,
          conflicts: conflicts.map(toEventResultItem).filter(Boolean)
        };
      }

      return {
        id: createChatId(`event-${trace.name}`),
        role: "assistant",
        variant: "event_result",
        resultType: "operation",
        operation: operationLabels[trace.name],
        tone: toolResult.success === false ? "warning" : operationTones[trace.name],
        title: requested?.title || toolResult.message || operationLabels[trace.name],
        time: requested?.time || "",
        location: requested?.location || "",
        description: requested?.description || "",
        meta: toolResult.message || "",
        conflicts: []
      };
    });
}

export default function App() {
  const sheetY = useRef(new Animated.Value(0)).current;
  const voiceBars = useRef(
    [0.45, 0.72, 0.38, 0.86, 0.55].map((value) => new Animated.Value(value))
  ).current;
  const voicePulseA = useRef(new Animated.Value(0)).current;
  const voicePulseB = useRef(new Animated.Value(0)).current;
  const calendarHeight = useRef(new Animated.Value(0)).current;
  const calendarActiveScale = useRef(new Animated.Value(1)).current;
  const calendarLeavingScale = useRef(new Animated.Value(0)).current;
  const calendarLeavingAnimationRun = useRef(0);
  const navigationTitleOpacity = useRef(new Animated.Value(1)).current;
  const navigationTitleAnimationRun = useRef(0);
  const daySlideX = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);
  const timelinePullStartY = useRef(SHEET_CLOSED_Y);
  const timelineEdgeTarget = useRef(null);
  const timelineScrollRef = useRef(null);
  const calendarPanelHeightRef = useRef(0);
  const dayPageWidth = useRef(0);
  const isDayTransitioning = useRef(false);
  const daySwipePreviewDirection = useRef(0);
  const daySwipeRunId = useRef(0);
  const pendingDayDirection = useRef(0);
  const dayTransitionTargetDateRef = useRef(null);
  const selectedDateRef = useRef(null);
  const calendarPreviewDateRef = useRef(null);
  const timelineScrollY = useRef(0);
  const timelineViewportHeight = useRef(0);
  const timelineContentHeight = useRef(0);
  const chatScrollRef = useRef(null);
  const hasSeededTestSchedulesRef = useRef(false);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const isCalendarOpenRef = useRef(false);
  const [calendarPanelHeight, setCalendarPanelHeight] = useState(0);
  const [dayPageWidthState, setDayPageWidthState] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarPreviewDate, setCalendarPreviewDate] = useState(null);
  const [dayTransitionTargetDate, setDayTransitionTargetDate] = useState(null);
  const [leavingDate, setLeavingDate] = useState(null);
  const [crossMonthSwipe, setCrossMonthSwipe] = useState(false);
  const [schedulesByDate, setSchedulesByDate] = useState({});
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [detailPickerTarget, setDetailPickerTarget] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: "assistant-welcome",
      role: "assistant",
      title: "语音助手",
      text: "点击麦克风，说出你要添加的日程。",
      meta: "例如：明天下午三点提醒我开会"
    }
  ]);
  const calendarModel = useMemo(() => createCalendarModel(selectedDate), [selectedDate]);
  const fixedCalendarDate = calendarPreviewDate || selectedDate;
  const fixedCalendarKey = getDateKey(fixedCalendarDate);
  const navigationTitle = useMemo(() => formatNavigationTitle(fixedCalendarDate), [fixedCalendarKey]);
  const [displayedNavigationTitle, setDisplayedNavigationTitle] = useState(navigationTitle);

  const animateSheetRef = useRef(null);
  const agentMessagesRef = useRef([]);

  const loadVisibleSchedules = useCallback(
    async (date) => {
      const dates = [addDays(date, -1), date, addDays(date, 1)];
      const results = await Promise.all(
        dates.map(async (targetDate) => ({
          dateKey: getDateKey(targetDate),
          schedules: await getSchedulesByDate(targetDate)
        }))
      );
      setSchedulesByDate((current) => ({
        ...current,
        ...Object.fromEntries(results.map((result) => [result.dateKey, result.schedules]))
      }));
    },
    []
  );

  const appendAssistantChatMessage = useCallback((text, meta = "") => {
    setChatMessages((messages) => [
      ...messages,
      {
        id: createChatId("assistant"),
        role: "assistant",
        title: "助手回复",
        text,
        meta
      }
    ]);
  }, []);

  const appendChatMessages = useCallback((nextMessages) => {
    if (!nextMessages.length) return;
    setChatMessages((messages) => [...messages, ...nextMessages]);
  }, []);

  const createDetailForm = useCallback((schedule) => ({
    title: schedule?.title || "",
    start_time: schedule?.start_time || "",
    end_time: schedule?.end_time || "",
    all_day: Boolean(schedule?.all_day),
    location: schedule?.location || "",
    description: schedule?.description || "",
    category: schedule?.category || "personal",
    participants_text: Array.isArray(schedule?.participants) ? schedule.participants.join("，") : "",
    recurrence: normalizeRecurrence(schedule?.recurrence),
    reminder_minutes: normalizeReminderMinutes(schedule?.reminder_minutes)
  }), []);

  const openScheduleDetail = useCallback(async (scheduleId) => {
    if (!scheduleId) {
      return;
    }

    const schedule = await getScheduleById(scheduleId);
    if (!schedule) {
      appendAssistantChatMessage("没有找到这个日程，可能已经被删除。", "本地日历");
      return;
    }

    setDetailError("");
    setDetailSchedule(schedule);
    setDetailForm(createDetailForm(schedule));
    setDetailPickerTarget(null);
    animateSheetRef.current?.(SHEET_CLOSED_Y, false);
  }, [appendAssistantChatMessage, createDetailForm]);

  const closeScheduleDetail = useCallback(() => {
    setDetailSchedule(null);
    setDetailForm(null);
    setDetailError("");
    setIsSavingDetail(false);
    setDetailPickerTarget(null);
  }, []);

  const updateDetailField = useCallback((field, value) => {
    setDetailForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const updateDetailDateTime = useCallback((field, updater) => {
    setDetailForm((current) => {
      if (!current) return current;
      const baseDate =
        parseDateTime(current[field]) ||
        parseDateTime(current.start_time) ||
        selectedDateRef.current ||
        new Date();
      const nextDate = updater(new Date(baseDate));
      return {
        ...current,
        [field]: formatDateTime(nextDate)
      };
    });
  }, []);

  const updateDetailRecurrence = useCallback((updates) => {
    setDetailForm((current) => {
      if (!current) return current;
      return {
        ...current,
        recurrence: normalizeRecurrence({
          ...current.recurrence,
          ...updates
        })
      };
    });
  }, []);

  const toggleDetailWeekday = useCallback((weekday) => {
    setDetailForm((current) => {
      if (!current) return current;
      const recurrence = normalizeRecurrence(current.recurrence);
      const weekdays = recurrence.weekdays.includes(weekday)
        ? recurrence.weekdays.filter((item) => item !== weekday)
        : [...recurrence.weekdays, weekday];
      return {
        ...current,
        recurrence: {
          ...recurrence,
          weekdays
        }
      };
    });
  }, []);

  const saveScheduleDetail = useCallback(async () => {
    if (!detailSchedule || !detailForm || isSavingDetail) {
      return;
    }

    const title = detailForm.title.trim();
    const startTime = detailForm.start_time.trim();
    const endTime = detailForm.end_time.trim();

    if (!title) {
      setDetailError("标题不能为空");
      return;
    }
    if (!parseDateTime(startTime) || !parseDateTime(endTime)) {
      setDetailError("时间格式必须是 YYYY-MM-DD HH:mm");
      return;
    }
    if (startTime > endTime) {
      setDetailError("结束时间不能早于开始时间");
      return;
    }

    const participants = detailForm.participants_text
      .split(/[,，、\s]+/)
      .map((participant) => participant.trim())
      .filter(Boolean);

    setIsSavingDetail(true);
    setDetailError("");
    try {
      const updated = await repoUpdateSchedule(detailSchedule.id, {
        title,
        start_time: startTime,
        end_time: endTime,
        all_day: Boolean(detailForm.all_day),
        location: detailForm.location.trim(),
        description: detailForm.description.trim(),
        category: detailForm.category,
        participants,
        recurrence: normalizeRecurrence(detailForm.recurrence),
        reminder_minutes: normalizeReminderMinutes(detailForm.reminder_minutes)
      });

      if (!updated) {
        setDetailError("日程不存在，可能已经被删除");
        return;
      }

      const nextDate = parseDateTime(updated?.start_time || startTime) || selectedDateRef.current || selectedDate;
      setSelectedDate(nextDate);
      await loadVisibleSchedules(nextDate);
      setDetailSchedule(updated);
      setDetailForm(createDetailForm(updated));
      appendAssistantChatMessage("日程已更新。", "本地日历");
    } catch (error) {
      setDetailError(error?.message || "保存失败");
    } finally {
      setIsSavingDetail(false);
    }
  }, [
    appendAssistantChatMessage,
    createDetailForm,
    detailForm,
    detailSchedule,
    isSavingDetail,
    loadVisibleSchedules,
    selectedDate
  ]);

  const runAgentForText = useCallback(
    async (text) => {
      try {
        let messages = [
          ...agentMessagesRef.current,
          {
            role: "user",
            content: text
          }
        ];

        for (let step = 0; step < 4; step += 1) {
          const result = await runCalendarAgent({
            messages,
            currentDate: formatDateTime(new Date()),
            timezone: "Asia/Shanghai"
          });

          if (result.assistant_message) {
            messages = [...messages, result.assistant_message];
          }

          if (result.status === "done") {
            agentMessagesRef.current = messages;
            appendAssistantChatMessage(result.reply || "已完成。");
            appendChatMessages(buildEventResultMessages(result));
            await loadVisibleSchedules(selectedDateRef.current || selectedDate);
            return;
          }

          if (result.status === "needs_user_input") {
            const toolResults = await executeAgentToolCalls(result.tool_calls || []);
            messages = [...messages, ...toolResults];

            agentMessagesRef.current = messages;
            appendAssistantChatMessage(result.reply || "我需要再确认一下。", "等待补充信息");
            appendChatMessages(buildEventResultMessages(result));
            return;
          }

          if (result.status === "tool_calls") {
            const toolResults = await executeAgentToolCalls(result.tool_calls || []);
            messages = [...messages, ...toolResults];
            appendChatMessages(buildEventResultMessages(result));
            await loadVisibleSchedules(selectedDateRef.current || selectedDate);
            continue;
          }
        }

        agentMessagesRef.current = messages;
        appendAssistantChatMessage("这个操作有点复杂，我先停在这里。", "工具循环已停止");
      } catch (error) {
        appendAssistantChatMessage(error?.message || "Agent 调用失败", "请检查后端服务和模型接口");
      }
    },
    [appendAssistantChatMessage, appendChatMessages, loadVisibleSchedules, selectedDate]
  );

  const voice = useVoiceInput({
    chatMessages,
    setChatMessages,
    animateSheetRef,
    onRecognizedText: runAgentForText
  });
  const getEventsForDate = useCallback((date) => {
    const source = (schedulesByDate[getDateKey(date)] || [])
      .filter((schedule) => schedule && schedule.start_time)
      .map(scheduleToEvent);
    return [...source].sort((a, b) => a.time.localeCompare(b.time));
  }, [schedulesByDate]);
  const currentEvents = useMemo(() => getEventsForDate(selectedDate), [getEventsForDate, selectedDate]);
  const nextEvent = currentEvents[0];

  useEffect(() => {
    (async () => {
      if (!hasSeededTestSchedulesRef.current) {
        hasSeededTestSchedulesRef.current = true;
        await seedTestSchedulesForDate(selectedDate);
      }
      await loadVisibleSchedules(selectedDate);
    })().catch((error) => {
      console.warn("[calendar] failed to prepare schedules", error);
    });
  }, [selectedDate, loadVisibleSchedules]);

  const animateSheet = useCallback((toValue, open) => {
    setIsSheetOpen(open);
    if (!open) {
      voice.cancelSpeechRecognition();
    }
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.9
    }).start();
  }, [voice.cancelSpeechRecognition, sheetY]);
  animateSheetRef.current = animateSheet;

  useEffect(() => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [chatMessages, voice.speechText, voice.isListening]);

  useEffect(() => {
    if (!voice.isListening) {
      voiceBars.forEach((bar, i) => { bar.stopAnimation(); bar.setValue([0.45,0.72,0.38,0.86,0.55][i]); });
      voicePulseA.stopAnimation(); voicePulseB.stopAnimation();
      voicePulseA.setValue(0); voicePulseB.setValue(0);
      return;
    }
    const barAnims = voiceBars.map((bar, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 90),
      Animated.timing(bar, { toValue: i % 2 === 0 ? 0.92 : 0.36, duration: 230, useNativeDriver: true }),
      Animated.timing(bar, { toValue: i % 2 === 0 ? 0.34 : 1, duration: 260, useNativeDriver: true }),
      Animated.timing(bar, { toValue: [0.58,0.82,0.48,0.72,0.62][i], duration: 210, useNativeDriver: true }),
    ])));
    const pA = Animated.loop(Animated.sequence([Animated.delay(0), Animated.timing(voicePulseA, { toValue: 1, duration: 1450, useNativeDriver: true }), Animated.timing(voicePulseA, { toValue: 0, duration: 0, useNativeDriver: true })]));
    const pB = Animated.loop(Animated.sequence([Animated.delay(650), Animated.timing(voicePulseB, { toValue: 1, duration: 1450, useNativeDriver: true }), Animated.timing(voicePulseB, { toValue: 0, duration: 0, useNativeDriver: true })]));
    [...barAnims, pA, pB].forEach(a => a.start());
    return () => [...barAnims, pA, pB].forEach(a => a.stop());
  }, [voice.isListening, voiceBars, voicePulseA, voicePulseB]);

  useEffect(() => {
    if (!selectedDateRef.current) selectedDateRef.current = selectedDate;
  }, []);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { calendarPreviewDateRef.current = calendarPreviewDate; }, [calendarPreviewDate]);

  useEffect(() => {
    if (displayedNavigationTitle === navigationTitle) return;
    const runId = navigationTitleAnimationRun.current + 1;
    navigationTitleAnimationRun.current = runId;
    navigationTitleOpacity.stopAnimation((cur) => {
      Animated.timing(navigationTitleOpacity, { toValue: 0, duration: Math.max(40, Math.round(90 * cur)), easing: Easing.out(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (!finished || runId !== navigationTitleAnimationRun.current) return;
        setDisplayedNavigationTitle(navigationTitle);
        requestAnimationFrame(() => {
          if (runId !== navigationTitleAnimationRun.current) return;
          Animated.timing(navigationTitleOpacity, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        });
      });
    });
  }, [displayedNavigationTitle, navigationTitle, navigationTitleOpacity]);

  useEffect(() => {
    calendarActiveScale.stopAnimation();
    calendarActiveScale.setValue(0.02);
    Animated.spring(calendarActiveScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 310,
      mass: 0.72,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001
    }).start();
  }, [fixedCalendarKey, calendarActiveScale]);

  useEffect(() => {
    if (!leavingDate) {
      return;
    }

    const runId = calendarLeavingAnimationRun.current + 1;
    calendarLeavingAnimationRun.current = runId;
    calendarLeavingScale.stopAnimation();
    calendarLeavingScale.setValue(1);
    Animated.timing(calendarLeavingScale, {
      toValue: 0,
      duration: 170,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished && runId === calendarLeavingAnimationRun.current) {
        setLeavingDate(null);
      }
    });
  }, [leavingDate, calendarLeavingScale]);

  const isTimelineAtBottom = () =>
    timelineScrollY.current + timelineViewportHeight.current >= timelineContentHeight.current - 2;

  const isTimelineAtTopBoundary = () => timelineScrollY.current <= 2;

  const getCalendarPanelHeight = () => calendarPanelHeightRef.current;

  const applyPullElasticity = (distance) =>
    TIMELINE_PULL_INITIAL_RESISTANCE *
    TIMELINE_PULL_ELASTIC_DISTANCE *
    (1 - Math.exp(-distance / TIMELINE_PULL_ELASTIC_DISTANCE));

  const applyCalendarPullElasticity = (distance) => {
    const height = getCalendarPanelHeight();
    if (!height) {
      return 0;
    }

    const easedDistance =
      CALENDAR_PULL_INITIAL_RESISTANCE *
      CALENDAR_PULL_ELASTIC_DISTANCE *
      (1 - Math.exp(-distance / CALENDAR_PULL_ELASTIC_DISTANCE));

    return Math.min(height, easedDistance);
  };

  const animateCalendar = (toValue, open) => {
    isCalendarOpenRef.current = open;
    if (open) {
      setIsCalendarOpen(true);
    }
    Animated.spring(calendarHeight, {
      toValue,
      useNativeDriver: false,
      damping: 34,
      stiffness: 400,
      mass: 0.7,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5
    }).start(({ finished }) => {
      if (finished && !open) {
        setIsCalendarOpen(false);
        timelineScrollY.current = 0;
        timelineScrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    });
  };

  const handleTimelineScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    timelineScrollY.current = offsetY;
  };

  const handleCalendarLayout = (event) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (!nextHeight || nextHeight === calendarPanelHeightRef.current) {
      return;
    }

    calendarPanelHeightRef.current = nextHeight;
    setCalendarPanelHeight(nextHeight);
  };

  const applyDaySwipeElasticity = (distance, width) => {
    const sign = Math.sign(distance);
    const absoluteDistance = Math.abs(distance);

    if (absoluteDistance <= width) {
      return distance;
    }

    return sign * (width + (absoluteDistance - width) * DAY_SWIPE_EDGE_RESISTANCE);
  };

  const getDayPreviewThreshold = (width) => width * DAY_PREVIEW_WIDTH_RATIO;

  const getPagerWidth = () => dayPageWidthState || dayPageWidth.current || 360;

  const resetDayPagerPosition = () => {
    daySlideX.stopAnimation();
    daySlideX.setValue(0);
    requestAnimationFrame(() => {
      daySlideX.setValue(0);
    });
  };

  const primeCalendarHighlightAnimation = () => {
    calendarActiveScale.stopAnimation();
    calendarActiveScale.setValue(0.02);
    calendarLeavingScale.stopAnimation();
    calendarLeavingScale.setValue(1);
  };

  const startCalendarSwipePreview = (direction, targetDate = null) => {
    const baseDate = selectedDateRef.current || selectedDate;
    const fixedDate = calendarPreviewDateRef.current || baseDate;
    const previewDate = targetDate ? new Date(targetDate) : addDays(baseDate, direction);
    const isCrossMonthPreview = getMonthKey(baseDate) !== getMonthKey(previewDate);

    if (
      daySwipePreviewDirection.current === direction &&
      calendarPreviewDateRef.current &&
      isSameDay(calendarPreviewDateRef.current, previewDate)
    ) {
      return;
    }

    daySwipePreviewDirection.current = direction;
    if (!isCrossMonthPreview) {
      setCrossMonthSwipe(false);
      return;
    }

    setCrossMonthSwipe(true);
    primeCalendarHighlightAnimation();
    setLeavingDate(new Date(fixedDate));
    calendarPreviewDateRef.current = previewDate;
    setCalendarPreviewDate(previewDate);
  };

  const resetCalendarSwipePreview = () => {
    const previewDate = calendarPreviewDateRef.current;
    if (!previewDate) {
      daySwipePreviewDirection.current = 0;
      return;
    }

    daySwipePreviewDirection.current = 0;
    setCrossMonthSwipe(false);
    primeCalendarHighlightAnimation();
    setLeavingDate(new Date(previewDate));
    calendarPreviewDateRef.current = null;
    setCalendarPreviewDate(null);
  };

  const settleDaySlideBack = (onComplete) => {
    Animated.spring(daySlideX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 260,
      mass: 0.9,
      restDisplacementThreshold: 1,
      restSpeedThreshold: 1
    }).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  };

  const startDaySlideAnimation = (direction, nextSelectedDate) => {
    if (isDayTransitioning.current) {
      return;
    }

    const width = getPagerWidth();
    const runId = daySwipeRunId.current + 1;
    daySwipeRunId.current = runId;
    isDayTransitioning.current = true;
    pendingDayDirection.current = direction;

    Animated.timing(daySlideX, {
      toValue: -direction * width,
      useNativeDriver: true,
      duration: 210,
      easing: Easing.out(Easing.cubic)
    }).start(({ finished }) => {
      if (runId !== daySwipeRunId.current) {
        return;
      }

      if (!finished) {
        isDayTransitioning.current = false;
        return;
      }

      daySlideX.stopAnimation();
      daySlideX.setValue(0);
      selectedDateRef.current = nextSelectedDate;
      calendarPreviewDateRef.current = null;
      dayTransitionTargetDateRef.current = null;
      daySwipePreviewDirection.current = 0;
      setCrossMonthSwipe(false);
      pendingDayDirection.current = 0;
      isDayTransitioning.current = false;
      setSelectedDate(nextSelectedDate);
      setCalendarPreviewDate(null);
      setDayTransitionTargetDate(null);
      timelineScrollY.current = 0;
      timelineScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  };

  const changeDay = (direction, targetDate = null) => {
    if (isDayTransitioning.current) {
      return;
    }

    const baseDate = selectedDateRef.current || selectedDate;
    const nextSelectedDate = targetDate ? new Date(targetDate) : addDays(baseDate, direction);

    if (isSameDay(baseDate, nextSelectedDate)) {
      return;
    }

    if (!targetDate) {
      startDaySlideAnimation(direction, nextSelectedDate);
      return;
    }

    startCalendarSwipePreview(direction, nextSelectedDate);
    dayTransitionTargetDateRef.current = nextSelectedDate;
    setDayTransitionTargetDate(nextSelectedDate);
    requestAnimationFrame(() => {
      if (
        dayTransitionTargetDateRef.current &&
        isSameDay(dayTransitionTargetDateRef.current, nextSelectedDate)
      ) {
        startDaySlideAnimation(direction, nextSelectedDate);
      }
    });
  };

  const handleCalendarDayPress = (targetDate) => {
    const baseDate = selectedDateRef.current || selectedDate;
    const baseTime = getDayStartTime(baseDate);
    const targetTime = getDayStartTime(targetDate);

    if (targetTime === baseTime) {
      return;
    }

    changeDay(targetTime > baseTime ? 1 : -1, targetDate);
  };

  const daySwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 18 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
        onPanResponderGrant: () => {
          daySwipeRunId.current += 1;
          daySlideX.stopAnimation();
          setCrossMonthSwipe(false);
          if (isDayTransitioning.current && pendingDayDirection.current) {
            const nextSelectedDate =
              dayTransitionTargetDateRef.current ||
              addDays(selectedDateRef.current || selectedDate, pendingDayDirection.current);
            daySlideX.setValue(0);
            selectedDateRef.current = nextSelectedDate;
            setSelectedDate(nextSelectedDate);
            calendarPreviewDateRef.current = null;
            setCalendarPreviewDate(null);
            dayTransitionTargetDateRef.current = null;
            setDayTransitionTargetDate(null);
            pendingDayDirection.current = 0;
          }
          isDayTransitioning.current = false;
          daySwipePreviewDirection.current = 0;
          daySlideX.setValue(0);
        },
        onPanResponderMove: (_, gesture) => {
          const width = getPagerWidth();
          const nextX = applyDaySwipeElasticity(gesture.dx, width);
          const previewThreshold = getDayPreviewThreshold(width);
          if (
            Math.abs(gesture.dx) > previewThreshold &&
            (!daySwipePreviewDirection.current ||
              Math.sign(gesture.dx) !== -daySwipePreviewDirection.current)
          ) {
            startCalendarSwipePreview(gesture.dx < 0 ? 1 : -1);
          }
          daySlideX.setValue(Math.max(-width * 1.18, Math.min(width * 1.18, nextX)));
        },
        onPanResponderRelease: (_, gesture) => {
          const width = getPagerWidth();
          const shouldSwitch = Math.abs(gesture.dx) > width * 0.28 || Math.abs(gesture.vx) > 0.55;

          if (shouldSwitch) {
            changeDay(gesture.dx < 0 ? 1 : -1);
            return;
          }

          settleDaySlideBack();
          resetCalendarSwipePreview();
        },
        onPanResponderTerminate: () => {
          settleDaySlideBack();
          resetCalendarSwipePreview();
        }
      }),
    [daySlideX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          sheetY.stopAnimation((value) => {
            dragStartY.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextY = Math.max(0, Math.min(SHEET_CLOSED_Y, dragStartY.current + gesture.dy));
          sheetY.setValue(nextY);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dy) < 6 && Math.abs(gesture.dx) < 6) {
            toggleVoiceSheet();
            return;
          }

          const projectedY = dragStartY.current + gesture.dy;
          const shouldClose = gesture.vy > 0.6 || projectedY > SHEET_CLOSE_THRESHOLD;
          animateSheet(shouldClose ? SHEET_CLOSED_Y : 0, !shouldClose);
        },
        onPanResponderTerminate: () => {
          animateSheet(isSheetOpen ? 0 : SHEET_CLOSED_Y, isSheetOpen);
        }
      }),
    [isSheetOpen, sheetY]
  );

  const timelinePullResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => {
          if (Math.abs(gesture.dy) <= 6 || Math.abs(gesture.dy) <= Math.abs(gesture.dx)) {
            timelineEdgeTarget.current = null;
            return false;
          }

          if (!isCalendarOpenRef.current && getCalendarPanelHeight() > 0 && isTimelineAtTopBoundary() && gesture.dy > 6) {
            timelineEdgeTarget.current = "calendar-open";
            return true;
          }

          if (isCalendarOpenRef.current && gesture.dy < -6) {
            timelineEdgeTarget.current = "calendar-close";
            return true;
          }

          if (!isCalendarOpenRef.current && !isSheetOpen && isTimelineAtBottom() && gesture.dy < -6) {
            timelineEdgeTarget.current = "sheet";
            return true;
          }

          timelineEdgeTarget.current = null;
          return false;
        },
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (Math.abs(gesture.dy) <= 6 || Math.abs(gesture.dy) <= Math.abs(gesture.dx)) {
            timelineEdgeTarget.current = null;
            return false;
          }

          if (!isCalendarOpenRef.current && getCalendarPanelHeight() > 0 && isTimelineAtTopBoundary() && gesture.dy > 6) {
            timelineEdgeTarget.current = "calendar-open";
            return true;
          }

          if (isCalendarOpenRef.current && gesture.dy < -6) {
            timelineEdgeTarget.current = "calendar-close";
            return true;
          }

          if (!isCalendarOpenRef.current && !isSheetOpen && isTimelineAtBottom() && gesture.dy < -6) {
            timelineEdgeTarget.current = "sheet";
            return true;
          }

          timelineEdgeTarget.current = null;
          return false;
        },
        onPanResponderGrant: () => {
          if (timelineEdgeTarget.current === "calendar-open" || timelineEdgeTarget.current === "calendar-close") {
            if (timelineEdgeTarget.current === "calendar-open") {
              setIsCalendarOpen(true);
            }
            calendarHeight.stopAnimation();
            return;
          }

          if (timelineEdgeTarget.current === "sheet") {
            sheetY.stopAnimation((value) => {
              timelinePullStartY.current = value;
            });
          }
        },
        onPanResponderMove: (_, gesture) => {
          if (timelineEdgeTarget.current === "calendar-open") {
            if (!isCalendarOpen) {
              setIsCalendarOpen(true);
            }
            const pullDistance = Math.max(0, gesture.dy);
            const panelHeight = getCalendarPanelHeight();
            const nextHeight = Math.min(panelHeight, applyCalendarPullElasticity(pullDistance));
            calendarHeight.setValue(nextHeight);
            return;
          }

          if (timelineEdgeTarget.current === "calendar-close") {
            const pullDistance = Math.max(0, -gesture.dy);
            const panelHeight = getCalendarPanelHeight();
            const elasticDistance = applyCalendarPullElasticity(pullDistance);
            const nextHeight = Math.max(0, panelHeight - elasticDistance);
            calendarHeight.setValue(nextHeight);
            return;
          }

          if (timelineEdgeTarget.current === "sheet") {
            const pullDistance = Math.max(0, -gesture.dy);
            const elasticDistance = applyPullElasticity(pullDistance);
            const nextY = Math.max(0, Math.min(SHEET_CLOSED_Y, timelinePullStartY.current - elasticDistance));
            sheetY.setValue(nextY);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (timelineEdgeTarget.current === "calendar-open") {
            const pullDistance = Math.max(0, gesture.dy);
            const panelHeight = getCalendarPanelHeight();
            const shouldOpen = pullDistance > CALENDAR_PULL_OPEN_THRESHOLD || gesture.vy > 0.45;
            animateCalendar(shouldOpen ? panelHeight : 0, shouldOpen);
            timelineEdgeTarget.current = null;
            return;
          }

          if (timelineEdgeTarget.current === "calendar-close") {
            const pullDistance = Math.max(0, -gesture.dy);
            const panelHeight = getCalendarPanelHeight();
            const shouldClose = pullDistance > CALENDAR_PULL_OPEN_THRESHOLD || gesture.vy < -0.45;
            animateCalendar(shouldClose ? 0 : panelHeight, !shouldClose);
            timelineEdgeTarget.current = null;
            return;
          }

          if (timelineEdgeTarget.current === "sheet") {
            const pullDistance = Math.max(0, -gesture.dy);
            const shouldOpen = pullDistance > TIMELINE_PULL_OPEN_THRESHOLD || gesture.vy < -0.45;
            animateSheet(shouldOpen ? 0 : SHEET_CLOSED_Y, shouldOpen);
            timelineEdgeTarget.current = null;
          }
        },
        onPanResponderTerminate: () => {
          if (timelineEdgeTarget.current === "calendar-open" || timelineEdgeTarget.current === "calendar-close") {
            animateCalendar(isCalendarOpenRef.current ? getCalendarPanelHeight() : 0, isCalendarOpenRef.current);
          }

          if (timelineEdgeTarget.current === "sheet") {
            animateSheet(isSheetOpen ? 0 : SHEET_CLOSED_Y, isSheetOpen);
          }

          timelineEdgeTarget.current = null;
        }
      }),
    [isCalendarOpen, isSheetOpen, sheetY]
  );

  const toggleVoiceSheet = () => {
    animateSheet(isSheetOpen ? SHEET_CLOSED_Y : 0, !isSheetOpen);
  };

  const micTranslateY = sheetY.interpolate({
    inputRange: [0, SHEET_CLOSED_Y],
    outputRange: [0, MIC_CLOSED_TRANSLATE_Y],
    extrapolate: "clamp"
  });

  const voiceBarStyles = voiceBars.map((bar) => ({
    opacity: bar.interpolate({
      inputRange: [0, 1],
      outputRange: [0.65, 1]
    }),
    transform: [
      {
        scaleY: bar.interpolate({
          inputRange: [0, 1],
          outputRange: [0.32, 1]
        })
      }
    ]
  }));

  const voicePulseAStyle = {
    opacity: voicePulseA.interpolate({
      inputRange: [0, 1],
      outputRange: [0.24, 0]
    }),
    transform: [
      {
        scale: voicePulseA.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.72]
        })
      }
    ]
  };

  const voicePulseBStyle = {
    opacity: voicePulseB.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0]
    }),
    transform: [
      {
        scale: voicePulseB.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.48]
        })
      }
    ]
  };

  const calendarTranslateY = calendarHeight.interpolate({
    inputRange: [0, Math.max(calendarPanelHeight, 1)],
    outputRange: [-10, 0],
    extrapolate: "clamp"
  });
  const pagerWidth = getPagerWidth();
  const calendarActiveTextBaseOpacity = calendarActiveScale.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [1, 1, 0],
    extrapolate: "clamp"
  });
  const calendarActiveTextWhiteOpacity = calendarActiveScale.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [0, 0, 1],
    extrapolate: "clamp"
  });
  const leavingDateKey = leavingDate
    ? getDateKey(leavingDate)
    : null;
  const previousDate = useMemo(() => {
    if (
      dayTransitionTargetDate &&
      getDayStartTime(dayTransitionTargetDate) < getDayStartTime(selectedDate)
    ) {
      return dayTransitionTargetDate;
    }

    return addDays(selectedDate, -1);
  }, [selectedDate, dayTransitionTargetDate]);
  const nextDate = useMemo(() => {
    if (
      dayTransitionTargetDate &&
      getDayStartTime(dayTransitionTargetDate) > getDayStartTime(selectedDate)
    ) {
      return dayTransitionTargetDate;
    }

    return addDays(selectedDate, 1);
  }, [selectedDate, dayTransitionTargetDate]);
  const shouldSlideToPreviousMonth = getMonthKey(selectedDate) !== getMonthKey(previousDate);
  const shouldSlideToNextMonth = getMonthKey(selectedDate) !== getMonthKey(nextDate);

  const renderCalendarDays = (model, isInteractive = true) =>
    model.days.map((day) => {
      const isActiveDay = day.isToday;
      const isLeavingDay = isInteractive && leavingDateKey === day.id && !day.isToday;
      const DayWrapper = isInteractive ? TouchableOpacity : View;
      const dayWrapperProps = isInteractive
        ? {
            activeOpacity: 0.72,
            onPress: () => handleCalendarDayPress(day.date)
          }
        : {};

      return (
        <DayWrapper
          style={styles.calendarDay}
          key={day.id}
          {...dayWrapperProps}
        >
          {isActiveDay && (
            <View pointerEvents="none" style={styles.calendarDayActiveSlot}>
              <Animated.View
                style={[
                  styles.calendarDayActiveBg,
                  { transform: [{ scale: calendarActiveScale }] }
                ]}
              />
            </View>
          )}
          {isLeavingDay && (
            <View pointerEvents="none" style={styles.calendarDayActiveSlot}>
              <Animated.View
                style={[
                  styles.calendarDayActiveBg,
                  { transform: [{ scale: calendarLeavingScale }] }
                ]}
              />
            </View>
          )}
          <View pointerEvents="none" style={styles.calendarDayTextLayer}>
            {isActiveDay ? (
              <>
                <Animated.Text
                  style={[
                    styles.calendarDayText,
                    styles.calendarDayTextAnimated,
                    styles.calendarDayTextTodayBase,
                    { opacity: calendarActiveTextBaseOpacity }
                  ]}
                >
                  {day.day}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.calendarDayText,
                    styles.calendarDayTextAnimated,
                    styles.calendarDayTextActive,
                    { opacity: calendarActiveTextWhiteOpacity }
                  ]}
                >
                  {day.day}
                </Animated.Text>
              </>
            ) : (
              <Text
                style={[
                  styles.calendarDayText,
                  !day.isCurrentMonth && styles.calendarDayMuted,
                  isLeavingDay && styles.calendarDayTextActive
                ]}
              >
                {day.day}
              </Text>
            )}
          </View>
        </DayWrapper>
      );
    });

  const renderCalendarPanel = (
    date,
    isInteractive = false,
    layerStyle = styles.inlineCalendarLayer,
    heightStyle = { height: calendarHeight },
    counterTranslateX
  ) => {
    const model = createCalendarModel(date);

    const pullPanelTransform = [{ translateY: calendarTranslateY }];
    if (counterTranslateX) {
      pullPanelTransform.push({ translateX: counterTranslateX });
    }

    const outerStyle = heightStyle ? [layerStyle, heightStyle] : layerStyle;

    return (
      <Animated.View
        pointerEvents={isInteractive ? "auto" : "none"}
        style={outerStyle}
      >
        <Animated.View
          style={[styles.calendarPullPanel, { transform: pullPanelTransform }]}
        >
          <View style={styles.calendarPanel}>
            <View style={styles.weekRow}>
              {weekDays.map((day) => (
                <Text style={styles.weekDay} key={day}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {renderCalendarDays(model, isInteractive)}
            </View>
          </View>
          <View style={styles.calendarBottomGap} />
        </Animated.View>
      </Animated.View>
    );
  };

  const renderCalendarMeasurer = () => {
    const model = createCalendarModel(fixedCalendarDate);

    return (
      <View pointerEvents="none" style={styles.calendarMeasureLayer}>
        <View style={styles.calendarPullPanel} onLayout={handleCalendarLayout}>
          <View style={styles.calendarPanel}>
            <View style={styles.weekRow}>
              {weekDays.map((day) => (
                <Text style={styles.weekDay} key={day}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {renderCalendarDays(model, false)}
            </View>
          </View>
          <View style={styles.calendarBottomGap} />
        </View>
      </View>
    );
  };

  const renderDayContent = (date, paneKey, isCurrentPane = false) => {
    const model = isCurrentPane ? calendarModel : createCalendarModel(date);
    const paneEvents = getEventsForDate(date);
    const shouldShowInlineCalendar =
      isCalendarOpen &&
      crossMonthSwipe &&
      (isCurrentPane ||
        (paneKey === "previous-day" && shouldSlideToPreviousMonth) ||
        (paneKey === "next-day" && shouldSlideToNextMonth));

    return (
      <View
        collapsable={false}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.dayPane, { width: pagerWidth }]}
        key={paneKey}
      >
        <Text style={styles.date}>
          {model.dateLabel.split(" ")[0]}{" "}
          <Text style={styles.dateWeekday}>{model.dateLabel.split(" ")[1]}</Text>
        </Text>

        <View style={styles.timelineArea}>
          <View
            style={styles.timelineList}
            {...(isCurrentPane ? timelinePullResponder.panHandlers : {})}
          >
            <ScrollView
              ref={isCurrentPane ? timelineScrollRef : undefined}
              style={styles.timeline}
              contentContainerStyle={styles.timelineContent}
              scrollEnabled={isCurrentPane && !isCalendarOpen}
              alwaysBounceVertical={false}
              bounces={false}
              overScrollMode="never"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onLayout={
                isCurrentPane
                  ? (event) => {
                      timelineViewportHeight.current = event.nativeEvent.layout.height;
                    }
                  : undefined
              }
              onContentSizeChange={
                isCurrentPane
                  ? (_, height) => {
                      timelineContentHeight.current = height;
                    }
                  : undefined
              }
              onScroll={
                isCurrentPane
                  ? handleTimelineScroll
                  : undefined
              }
            >
              <View style={styles.timelineTopSpacer} />
              {shouldShowInlineCalendar
                ? renderCalendarPanel(date, isCurrentPane, styles.inlineCalendarLayer, { height: calendarHeight })
                : renderCalendarPanel(date, false, [styles.inlineCalendarLayer, { opacity: 0 }], { height: calendarHeight })
              }
              <View style={styles.timelineRows}>
                <View
                  style={[
                    styles.timelineTrack,
                    { height: EVENT_ROW_HEIGHT * (Math.max(paneEvents.length, 1) - 1) }
                  ]}
                />
                {paneEvents.length === 0 && (
                  <View style={styles.emptyTimeline}>
                    <Text style={styles.emptyTimelineTitle}>暂无日程</Text>
                    <Text style={styles.emptyTimelineMeta}>可以用语音添加一个新的安排</Text>
                  </View>
                )}
                {paneEvents.map((event) => (
                  <EventRow
                    key={event.id || `${event.time}-${event.title}`}
                    event={event}
                    onPress={() => openScheduleDetail(event.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderDateTimePicker = () => {
    if (!detailForm || !detailPickerTarget) return null;

    const currentDate =
      parseDateTime(detailForm[detailPickerTarget]) ||
      parseDateTime(detailForm.start_time) ||
      selectedDateRef.current ||
      new Date();
    const dateOptions = Array.from({ length: 91 }, (_, index) => addDays(currentDate, index - 45));
    const selectedDateKey = getDateOnlyKey(currentDate);
    const selectedHour = currentDate.getHours();
    const selectedMinute = currentDate.getMinutes();

    return (
      <View style={styles.detailPickerPanel}>
        <View style={styles.detailPickerHeader}>
          <Text style={styles.detailPickerTitle}>
            选择{detailPickerTarget === "start_time" ? "开始时间" : "结束时间"}
          </Text>
          <TouchableOpacity onPress={() => setDetailPickerTarget(null)} activeOpacity={0.72}>
            <Text style={styles.detailPickerDone}>完成</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.detailPickerColumns}>
          <ScrollView style={styles.detailPickerDateColumn} showsVerticalScrollIndicator={false}>
            {dateOptions.map((date) => {
              const active = getDateOnlyKey(date) === selectedDateKey;
              return (
                <TouchableOpacity
                  key={getDateOnlyKey(date)}
                  style={[styles.detailPickerOption, active && styles.detailPickerOptionActive]}
                  activeOpacity={0.72}
                  onPress={() =>
                    updateDetailDateTime(detailPickerTarget, (nextDate) => {
                      nextDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      return nextDate;
                    })
                  }
                >
                  <Text style={[styles.detailPickerOptionText, active && styles.detailPickerOptionTextActive]}>
                    {formatPickerDateLabel(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.detailPickerNumberColumn} showsVerticalScrollIndicator={false}>
            {Array.from({ length: 24 }, (_, hour) => {
              const active = hour === selectedHour;
              return (
                <TouchableOpacity
                  key={hour}
                  style={[styles.detailPickerOption, active && styles.detailPickerOptionActive]}
                  activeOpacity={0.72}
                  onPress={() =>
                    updateDetailDateTime(detailPickerTarget, (nextDate) => {
                      nextDate.setHours(hour);
                      return nextDate;
                    })
                  }
                >
                  <Text style={[styles.detailPickerOptionText, active && styles.detailPickerOptionTextActive]}>
                    {String(hour).padStart(2, "0")}时
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.detailPickerNumberColumn} showsVerticalScrollIndicator={false}>
            {minuteOptions.map((minute) => {
              const active = minute === selectedMinute;
              return (
                <TouchableOpacity
                  key={minute}
                  style={[styles.detailPickerOption, active && styles.detailPickerOptionActive]}
                  activeOpacity={0.72}
                  onPress={() =>
                    updateDetailDateTime(detailPickerTarget, (nextDate) => {
                      nextDate.setMinutes(minute);
                      return nextDate;
                    })
                  }
                >
                  <Text style={[styles.detailPickerOptionText, active && styles.detailPickerOptionTextActive]}>
                    {String(minute).padStart(2, "0")}分
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderDetailPage = () => {
    if (!detailForm) return null;

    return (
      <View style={styles.detailPage}>
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.detailIconButton} onPress={closeScheduleDetail} activeOpacity={0.72}>
            <Text style={styles.detailBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>日程详情</Text>
          <TouchableOpacity
            style={[styles.detailSaveButton, isSavingDetail && styles.detailSaveButtonDisabled]}
            onPress={saveScheduleDetail}
            activeOpacity={0.78}
            disabled={isSavingDetail}
          >
            <Text style={styles.detailSaveText}>{isSavingDetail ? "保存中" : "保存"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>标题</Text>
            <TextInput
              style={styles.detailInput}
              value={detailForm.title}
              onChangeText={(value) => updateDetailField("title", value)}
              placeholder="日程标题"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>开始时间</Text>
            <TouchableOpacity
              style={styles.detailTimeField}
              activeOpacity={0.72}
              onPress={() => setDetailPickerTarget("start_time")}
            >
              <Text style={styles.detailTimeFieldText}>{detailForm.start_time}</Text>
              <Text style={styles.detailTimeFieldIcon}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>结束时间</Text>
            <TouchableOpacity
              style={styles.detailTimeField}
              activeOpacity={0.72}
              onPress={() => setDetailPickerTarget("end_time")}
            >
              <Text style={styles.detailTimeFieldText}>{detailForm.end_time}</Text>
              <Text style={styles.detailTimeFieldIcon}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.detailSwitchRow}
            activeOpacity={0.72}
            onPress={() => updateDetailField("all_day", !detailForm.all_day)}
          >
            <Text style={styles.detailSwitchLabel}>全天</Text>
            <View style={[styles.detailSwitch, detailForm.all_day && styles.detailSwitchActive]}>
              <View style={[styles.detailSwitchThumb, detailForm.all_day && styles.detailSwitchThumbActive]} />
            </View>
          </TouchableOpacity>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>分类</Text>
            <View style={styles.detailChipGrid}>
              {CATEGORIES.map((category) => {
                const active = detailForm.category === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.detailChip, active && styles.detailChipActive]}
                    activeOpacity={0.72}
                    onPress={() => updateDetailField("category", category)}
                  >
                    <Text style={[styles.detailChipText, active && styles.detailChipTextActive]}>
                      {categoryLabels[category]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>提醒</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailReminderRow}>
              {REMINDER_OPTIONS.map((minutes) => {
                const active = detailForm.reminder_minutes === minutes;
                return (
                  <TouchableOpacity
                    key={minutes}
                    style={[styles.detailChip, active && styles.detailChipActive]}
                    activeOpacity={0.72}
                    onPress={() => updateDetailField("reminder_minutes", minutes)}
                  >
                    <Text style={[styles.detailChipText, active && styles.detailChipTextActive]}>
                      {reminderLabels[minutes]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>重复</Text>
            <View style={styles.detailChipGrid}>
              {Object.keys(recurrenceLabels).map((type) => {
                const active = detailForm.recurrence.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.detailChip, active && styles.detailChipActive]}
                    activeOpacity={0.72}
                    onPress={() => updateDetailRecurrence({ type })}
                  >
                    <Text style={[styles.detailChipText, active && styles.detailChipTextActive]}>
                      {recurrenceLabels[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {detailForm.recurrence.type === "weekly" && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>重复星期</Text>
              <View style={styles.detailChipGrid}>
                {WEEKDAYS.map((weekday) => {
                  const active = detailForm.recurrence.weekdays.includes(weekday);
                  return (
                    <TouchableOpacity
                      key={weekday}
                      style={[styles.detailChip, active && styles.detailChipActive]}
                      activeOpacity={0.72}
                      onPress={() => toggleDetailWeekday(weekday)}
                    >
                      <Text style={[styles.detailChipText, active && styles.detailChipTextActive]}>
                        {weekdayLabels[weekday]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {detailForm.recurrence.type !== "none" && (
            <TouchableOpacity
              style={styles.detailSwitchRow}
              activeOpacity={0.72}
              onPress={() => updateDetailRecurrence({ skip_holidays: !detailForm.recurrence.skip_holidays })}
            >
              <Text style={styles.detailSwitchLabel}>跳过节假日</Text>
              <View style={[styles.detailSwitch, detailForm.recurrence.skip_holidays && styles.detailSwitchActive]}>
                <View
                  style={[
                    styles.detailSwitchThumb,
                    detailForm.recurrence.skip_holidays && styles.detailSwitchThumbActive
                  ]}
                />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>地点</Text>
            <TextInput
              style={styles.detailInput}
              value={detailForm.location}
              onChangeText={(value) => updateDetailField("location", value)}
              placeholder="地点"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>参与人</Text>
            <TextInput
              style={styles.detailInput}
              value={detailForm.participants_text}
              onChangeText={(value) => updateDetailField("participants_text", value)}
              placeholder="用逗号分隔"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>备注</Text>
            <TextInput
              style={[styles.detailInput, styles.detailTextArea]}
              value={detailForm.description}
              onChangeText={(value) => updateDetailField("description", value)}
              placeholder="补充说明"
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />
          </View>

          {Boolean(detailError) && <Text style={styles.detailError}>{detailError}</Text>}
        </ScrollView>
        {renderDateTimePicker()}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        {detailSchedule ? (
          renderDetailPage()
        ) : (
          <>
        <TopBar title={displayedNavigationTitle} titleOpacity={navigationTitleOpacity} />

        <View
          style={styles.dayPage}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            dayPageWidth.current = width;
            setDayPageWidthState((currentWidth) => (currentWidth === width ? currentWidth : width));
          }}
          {...daySwipeResponder.panHandlers}
        >
          {isCalendarOpen && !crossMonthSwipe &&
            renderCalendarPanel(
              fixedCalendarDate,
              true,
              styles.fixedCalendarLayer,
              { height: calendarHeight }
            )}
          <Animated.View
            collapsable={false}
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.dayPagerTrack,
              {
                width: pagerWidth * 3,
                marginLeft: -pagerWidth,
                transform: [{ translateX: daySlideX }]
              }
            ]}
          >
            {renderDayContent(previousDate, "previous-day")}
            {renderDayContent(selectedDate, "current-day", true)}
            {renderDayContent(nextDate, "next-day")}
          </Animated.View>

          {renderCalendarMeasurer()}

          <TouchableOpacity
            style={styles.fixedSummary}
            activeOpacity={0.82}
            onPress={() => nextEvent?.id && openScheduleDetail(nextEvent.id)}
            disabled={!nextEvent?.id}
          >
            <Text style={styles.summaryLabel}>下一项</Text>
            <Text style={styles.summaryTime}>{nextEvent?.time || "--:--"}</Text>
            <Text style={styles.summaryEvent}>{nextEvent?.title || "暂无日程"}</Text>
            <View style={styles.summarySpacer} />
            <Text style={styles.summaryChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <VoiceSheet
          messages={chatMessages}
          speechText={voice.speechText}
          isListening={voice.isListening}
          chatScrollRef={chatScrollRef}
          panResponder={panResponder}
          sheetY={sheetY}
          showTextInput={voice.showTextInput}
          textInputValue={voice.textInputValue}
          onTextInputChange={voice.setTextInputValue}
          onTextSend={voice.handleSendText}
        />

        <MicButton
          micTranslateY={micTranslateY}
          isListening={voice.isListening}
          onPress={voice.handleMicPress}
          voiceBarStyles={voiceBarStyles}
          voicePulseAStyle={voicePulseAStyle}
          voicePulseBStyle={voicePulseBStyle}
        />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eff6ff",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight ?? 24 : 0
  },
  app: {
    flex: 1,
    paddingTop: 12,
    backgroundColor: "#f8fbff"
  },
  detailPage: {
    flex: 1,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING
  },
  detailHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  detailIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef6ff",
    borderWidth: 1,
    borderColor: "#dbeafe"
  },
  detailBackText: {
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "500"
  },
  detailHeaderTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900"
  },
  detailSaveButton: {
    height: 40,
    minWidth: 66,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#2563eb"
  },
  detailSaveButtonDisabled: {
    opacity: 0.62
  },
  detailSaveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  detailScroll: {
    flex: 1
  },
  detailContent: {
    paddingTop: 10,
    paddingBottom: 34,
    gap: 14
  },
  detailSection: {
    gap: 8
  },
  detailLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800"
  },
  detailInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700"
  },
  detailTextArea: {
    minHeight: 104
  },
  detailHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600"
  },
  detailTimeField: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center"
  },
  detailTimeFieldText: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800"
  },
  detailTimeFieldIcon: {
    color: "#94a3b8",
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "400"
  },
  detailPickerPanel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  detailPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  detailPickerTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900"
  },
  detailPickerDone: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "900"
  },
  detailPickerColumns: {
    height: 168,
    flexDirection: "row",
    gap: 8
  },
  detailPickerDateColumn: {
    flex: 1.55
  },
  detailPickerNumberColumn: {
    flex: 1
  },
  detailPickerOption: {
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    backgroundColor: "#f8fbff"
  },
  detailPickerOptionActive: {
    backgroundColor: "#2563eb"
  },
  detailPickerOptionText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800"
  },
  detailPickerOptionTextActive: {
    color: "#ffffff"
  },
  detailChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  detailReminderRow: {
    gap: 8,
    paddingRight: 12
  },
  detailChip: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff"
  },
  detailChipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb"
  },
  detailChipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800"
  },
  detailChipTextActive: {
    color: "#ffffff"
  },
  detailSwitchRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  detailSwitchLabel: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800"
  },
  detailSwitch: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: "#cbd5e1"
  },
  detailSwitchActive: {
    backgroundColor: "#2563eb"
  },
  detailSwitchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff"
  },
  detailSwitchThumbActive: {
    transform: [{ translateX: 18 }]
  },
  detailError: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "800"
  },
  date: {
    color: "#0f172a",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0,
    height: 43,
    marginBottom: 6
  },
  dateWeekday: {
    color: "#64748b",
    fontSize: 18,
    fontWeight: "600"
  },
  dayPage: {
    flex: 1,
    overflow: "hidden"
  },
  dayPagerTrack: {
    flex: 1,
    flexDirection: "row"
  },
  dayPane: {
    flex: 1,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING
  },
  timelineArea: {
    flex: 1,
    position: "relative",
    overflow: "visible"
  },
  fixedSummary: {
    position: "absolute",
    left: PAGE_HORIZONTAL_PADDING,
    right: PAGE_HORIZONTAL_PADDING,
    top: DATE_BLOCK_HEIGHT + FLOATING_SUMMARY_TOP,
    zIndex: 30,
    elevation: 30,
    flexDirection: "row",
    alignItems: "center",
    height: FLOATING_SUMMARY_HEIGHT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  summaryLabel: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 16
  },
  summaryTime: {
    color: "#1d4ed8",
    fontSize: 17,
    fontWeight: "800",
    marginRight: 10
  },
  summaryEvent: {
    color: "#1d4ed8",
    fontSize: 17,
    fontWeight: "800"
  },
  summarySpacer: {
    flex: 1
  },
  summaryChevron: {
    color: "#94a3b8",
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "300"
  },
  inlineCalendarLayer: {
    width: "100%",
    overflow: "hidden"
  },
  calendarMeasureLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -1000,
    opacity: 0
  },
  calendarPullPanel: {
    width: "100%"
  },
  calendarPanel: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    backgroundColor: "#f8fbff"
  },
  calendarBottomGap: {
    height: CALENDAR_BOTTOM_GAP
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6
  },
  weekDay: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 4
  },
  calendarDay: {
    width: "14.2857%",
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  calendarDayActiveSlot: {
    position: "absolute",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  calendarDayActiveBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563eb"
  },
  calendarDayTextLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    elevation: 3
  },
  calendarDayText: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800"
  },
  calendarDayTextAnimated: {
    position: "absolute"
  },
  calendarDayTextTodayBase: {
    color: "#0f172a"
  },
  calendarDayMuted: {
    color: "#cbd5e1"
  },
  calendarDayTextActive: {
    color: "#ffffff"
  },
  timelineList: {
    flex: 1,
    width: "100%"
  },
  timeline: {
    flex: 1,
    width: "100%"
  },
  timelineContent: {
    flexGrow: 1,
    paddingBottom: TIMELINE_CONTENT_BOTTOM,
    position: "relative"
  },
  timelineTopSpacer: {
    width: "100%",
    height: TIMELINE_LIST_HEADROOM
  },
  timelineRows: {
    position: "relative",
    width: "100%"
  },
  emptyTimeline: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 28
  },
  emptyTimelineTitle: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "800"
  },
  emptyTimelineMeta: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8
  },
  timelineTrack: {
    position: "absolute",
    left: 69,
    top: MARKER_CENTER_Y,
    height: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: "#e2e8f0"
  },
  fixedCalendarLayer: {
    position: "absolute",
    left: PAGE_HORIZONTAL_PADDING,
    right: PAGE_HORIZONTAL_PADDING,
    top: DATE_BLOCK_HEIGHT + TIMELINE_LIST_HEADROOM,
    zIndex: 28,
    elevation: 28,
    overflow: "hidden"
  }
});

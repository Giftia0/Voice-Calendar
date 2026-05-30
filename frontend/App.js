import { StatusBar } from "expo-status-bar";
import { Bell, Check, ChevronRight, Menu, Mic } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const SHEET_HEIGHT = 300;
const SHEET_BOTTOM = 18;
const SHEET_CLOSED_Y = SHEET_HEIGHT + SHEET_BOTTOM + 12;
const SHEET_CLOSE_THRESHOLD = 110;
const MIC_SIZE = 64;
const MIC_GAP = 16;
const MIC_OPEN_BOTTOM = SHEET_BOTTOM + SHEET_HEIGHT + MIC_GAP;
const MIC_CLOSED_BOTTOM = 24;
const MIC_CLOSED_TRANSLATE_Y = MIC_OPEN_BOTTOM - MIC_CLOSED_BOTTOM;
const PAGE_HORIZONTAL_PADDING = 22;
const EVENT_ROW_HEIGHT = 92;
const MARKER_CENTER_Y = 34;
const DATE_BLOCK_HEIGHT = 49;
const FLOATING_SUMMARY_HEIGHT = 60;
const FLOATING_SUMMARY_TOP = 8;
const FLOATING_SUMMARY_GAP = 22;
const TIMELINE_LIST_HEADROOM = FLOATING_SUMMARY_TOP + FLOATING_SUMMARY_HEIGHT + FLOATING_SUMMARY_GAP;
const TIMELINE_CONTENT_BOTTOM = 0;
const TIMELINE_PULL_OPEN_THRESHOLD = 96;
const TIMELINE_PULL_ELASTIC_DISTANCE = 125;
const TIMELINE_PULL_INITIAL_RESISTANCE = 0.56;
const CALENDAR_PULL_OPEN_THRESHOLD = 68;
const CALENDAR_PULL_ELASTIC_DISTANCE = 260;
const CALENDAR_PULL_INITIAL_RESISTANCE = 0.9;
const CALENDAR_BOTTOM_GAP = 20;
const DAY_SWIPE_EDGE_RESISTANCE = 0.28;
const DAY_PREVIEW_WIDTH_RATIO = 0.5;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const events = [
  { time: "09:00", title: "周会", meta: "团队例会", tone: "soft" },
  { time: "11:30", title: "牙医", meta: "提前30分钟提醒", tone: "light" },
  { time: "15:00", title: "项目评审", meta: "会议室 A", tone: "primary" },
  { time: "18:30", title: "晚餐", meta: "家庭安排", tone: "warm" },
];

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
const fullWeekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const isSameDay = (firstDate, secondDate) =>
  firstDate.getFullYear() === secondDate.getFullYear() &&
  firstDate.getMonth() === secondDate.getMonth() &&
  firstDate.getDate() === secondDate.getDate();

const getDateKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const getMonthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

const getCalendarDayIndex = (date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS);

const formatNavigationTitle = (date, today = new Date()) => {
  const dayDiff = getCalendarDayIndex(date) - getCalendarDayIndex(today);

  if (Math.abs(dayDiff) <= 7) {
    if (dayDiff === 0) {
      return "今天";
    }

    if (dayDiff === -1) {
      return "昨天";
    }

    if (dayDiff === 1) {
      return "明天";
    }

    return dayDiff < 0 ? `${Math.abs(dayDiff)}天前` : `${dayDiff}天后`;
  }

  if (date.getFullYear() !== today.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const getDayStartTime = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const addDays = (date, amount) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

const createCalendarModel = (baseDate) => {
  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth();
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const mondayFirstOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const visibleRows = Math.max(5, Math.ceil((mondayFirstOffset + daysInMonth) / 7));
  const totalVisibleDays = visibleRows * 7;

  return {
    year,
    month: monthIndex + 1,
    day: baseDate.getDate(),
    dateLabel: `${monthIndex + 1}月${baseDate.getDate()}日 ${fullWeekDays[baseDate.getDay()]}`,
    title: `${year}年${monthIndex + 1}月`,
    days: Array.from({ length: totalVisibleDays }, (_, index) => {
      const date = new Date(year, monthIndex, 1 - mondayFirstOffset + index);
      return {
        id: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        date,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === monthIndex,
        isToday: isSameDay(date, baseDate)
      };
    })
  };
};

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
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const recognitionHadErrorRef = useRef(false);
  const chatScrollRef = useRef(null);
  const messageIdRef = useRef(1);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarPanelHeight, setCalendarPanelHeight] = useState(0);
  const [dayPageWidthState, setDayPageWidthState] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarPreviewDate, setCalendarPreviewDate] = useState(null);
  const [dayTransitionTargetDate, setDayTransitionTargetDate] = useState(null);
  const [leavingDate, setLeavingDate] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState("");
  const [speechError, setSpeechError] = useState("");
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

  useEffect(() => {
    if (!selectedDateRef.current) {
      selectedDateRef.current = selectedDate;
    }
  }, []);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    calendarPreviewDateRef.current = calendarPreviewDate;
  }, [calendarPreviewDate]);

  useEffect(() => {
    if (displayedNavigationTitle === navigationTitle) {
      return;
    }

    const runId = navigationTitleAnimationRun.current + 1;
    navigationTitleAnimationRun.current = runId;

    navigationTitleOpacity.stopAnimation((currentOpacity) => {
      Animated.timing(navigationTitleOpacity, {
        toValue: 0,
        duration: Math.max(40, Math.round(90 * currentOpacity)),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start(({ finished }) => {
        if (!finished || runId !== navigationTitleAnimationRun.current) {
          return;
        }

        setDisplayedNavigationTitle(navigationTitle);

        requestAnimationFrame(() => {
          if (runId !== navigationTitleAnimationRun.current) {
            return;
          }

          Animated.timing(navigationTitleOpacity, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }).start();
        });
      });
    });
  }, [displayedNavigationTitle, navigationTitle, navigationTitleOpacity]);

  useEffect(() => {
    if (!isListening) {
      voiceBars.forEach((bar, index) => {
        bar.stopAnimation();
        bar.setValue([0.45, 0.72, 0.38, 0.86, 0.55][index]);
      });
      voicePulseA.stopAnimation();
      voicePulseB.stopAnimation();
      voicePulseA.setValue(0);
      voicePulseB.setValue(0);
      return undefined;
    }

    const barAnimations = voiceBars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            toValue: index % 2 === 0 ? 0.92 : 0.36,
            duration: 230,
            useNativeDriver: true
          }),
          Animated.timing(bar, {
            toValue: index % 2 === 0 ? 0.34 : 1,
            duration: 260,
            useNativeDriver: true
          }),
          Animated.timing(bar, {
            toValue: [0.58, 0.82, 0.48, 0.72, 0.62][index],
            duration: 210,
            useNativeDriver: true
          })
        ])
      )
    );
    const createPulse = (value, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1450,
            useNativeDriver: true
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true
          })
        ])
      );
    const pulseAnimations = [createPulse(voicePulseA, 0), createPulse(voicePulseB, 650)];
    const animations = [...barAnimations, ...pulseAnimations];

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [isListening, voiceBars, voicePulseA, voicePulseB]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    []
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [chatMessages, speechText, isListening]);

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

  const createMessageId = (prefix) => {
    messageIdRef.current += 1;
    return `${prefix}-${messageIdRef.current}`;
  };

  const appendAssistantMessage = ({ title = "助手回复", text, meta = "当前为固定占位回复" }) => {
    setChatMessages((messages) => [
      ...messages,
      {
        id: createMessageId("assistant"),
        role: "assistant",
        title,
        text,
        meta
      }
    ]);
  };

  const appendRecognizedConversation = (text) => {
    setChatMessages((messages) => [
      ...messages,
      {
        id: createMessageId("user"),
        role: "user",
        text
      },
      {
        id: createMessageId("assistant"),
        role: "assistant",
        title: "助手回复",
        text: "我会在这里展示解析后的日程结果",
        meta: "当前为固定占位回复"
      }
    ]);
  };

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // The browser may already have ended the recognition session.
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      appendAssistantMessage({
        title: "识别提示",
        text: "当前预览环境不支持语音识别",
        meta: "请在 Chrome 或 Edge 浏览器中预览"
      });
      setIsListening(false);
      return;
    }

    setSpeechText("");
    setSpeechError("");
    transcriptRef.current = "";
    recognitionHadErrorRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript || "";
      }
      const nextText = transcript.trim();
      transcriptRef.current = nextText;
      setSpeechText(nextText);
    };

    recognition.onerror = (event) => {
      const nextError = event.error === "not-allowed" ? "麦克风权限未开启" : "语音识别暂时不可用";
      recognitionHadErrorRef.current = true;
      setSpeechError(nextError);
      appendAssistantMessage({
        title: "识别提示",
        text: nextError,
        meta: "请检查麦克风权限后重试"
      });
      setIsListening(false);
    };

    recognition.onend = () => {
      const finalText = transcriptRef.current.trim();
      if (finalText && !recognitionHadErrorRef.current) {
        appendRecognizedConversation(finalText);
      }
      setSpeechText("");
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current?.stop();
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setSpeechError("语音识别启动失败");
      appendAssistantMessage({
        title: "识别提示",
        text: "语音识别启动失败",
        meta: "请稍后重试"
      });
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const animateSheet = (toValue, open) => {
    setIsSheetOpen(open);
    if (!open) {
      stopSpeechRecognition();
    }
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.9
    }).start();
  };

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
    setIsCalendarOpen(open);
    Animated.spring(calendarHeight, {
      toValue,
      useNativeDriver: false,
      damping: 24,
      stiffness: 240,
      mass: 0.9
    }).start();
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

    if (
      daySwipePreviewDirection.current === direction &&
      calendarPreviewDateRef.current &&
      isSameDay(calendarPreviewDateRef.current, previewDate)
    ) {
      return;
    }

    daySwipePreviewDirection.current = direction;
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

      selectedDateRef.current = nextSelectedDate;
      calendarPreviewDateRef.current = null;
      dayTransitionTargetDateRef.current = null;
      daySwipePreviewDirection.current = 0;
      pendingDayDirection.current = 0;
      isDayTransitioning.current = false;
      setSelectedDate(nextSelectedDate);
      setCalendarPreviewDate(null);
      setDayTransitionTargetDate(null);
      requestAnimationFrame(resetDayPagerPosition);
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
          if (isDayTransitioning.current && pendingDayDirection.current) {
            const nextSelectedDate =
              dayTransitionTargetDateRef.current ||
              addDays(selectedDateRef.current || selectedDate, pendingDayDirection.current);
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

          if (!isCalendarOpen && getCalendarPanelHeight() > 0 && isTimelineAtTopBoundary() && gesture.dy > 6) {
            timelineEdgeTarget.current = "calendar-open";
            return true;
          }

          if (isCalendarOpen && gesture.dy < -6) {
            timelineEdgeTarget.current = "calendar-close";
            return true;
          }

          if (!isCalendarOpen && !isSheetOpen && isTimelineAtBottom() && gesture.dy < -6) {
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

          if (!isCalendarOpen && getCalendarPanelHeight() > 0 && isTimelineAtTopBoundary() && gesture.dy > 6) {
            timelineEdgeTarget.current = "calendar-open";
            return true;
          }

          if (isCalendarOpen && gesture.dy < -6) {
            timelineEdgeTarget.current = "calendar-close";
            return true;
          }

          if (!isCalendarOpen && !isSheetOpen && isTimelineAtBottom() && gesture.dy < -6) {
            timelineEdgeTarget.current = "sheet";
            return true;
          }

          timelineEdgeTarget.current = null;
          return false;
        },
        onPanResponderGrant: () => {
          if (timelineEdgeTarget.current === "calendar-open" || timelineEdgeTarget.current === "calendar-close") {
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
            animateCalendar(isCalendarOpen ? getCalendarPanelHeight() : 0, isCalendarOpen);
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

  const handleMicPress = () => {
    if (isListening) {
      stopSpeechRecognition();
      return;
    }

    if (!isSheetOpen) {
      animateSheet(0, true);
    }
    startSpeechRecognition();
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
  const shouldPrepareSlidingCalendar = shouldSlideToPreviousMonth || shouldSlideToNextMonth;
  const calendarFadeDistance = Math.max(1, pagerWidth * 0.08);
  const previousCalendarOpacity = daySlideX.interpolate({
    inputRange: [0, calendarFadeDistance],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const nextCalendarOpacity = daySlideX.interpolate({
    inputRange: [-calendarFadeDistance, 0],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });
  const slidingCalendarOpacity = shouldSlideToPreviousMonth
    ? previousCalendarOpacity
    : nextCalendarOpacity;
  const fixedCalendarOpacity = shouldPrepareSlidingCalendar
    ? slidingCalendarOpacity.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
        extrapolate: "clamp"
      })
    : 1;

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
    layerStyle = styles.paneCalendarLayer,
    heightStyle = { height: calendarHeight }
  ) => {
    const model = createCalendarModel(date);

    return (
      <Animated.View
        pointerEvents={isInteractive ? "auto" : "none"}
        style={[layerStyle, heightStyle]}
      >
        <Animated.View
          style={[styles.calendarPullPanel, { transform: [{ translateY: calendarTranslateY }] }]}
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
    const shouldRenderPaneCalendar =
      shouldPrepareSlidingCalendar &&
      (isCurrentPane ||
        (paneKey === "previous-day" && shouldSlideToPreviousMonth) ||
        (paneKey === "next-day" && shouldSlideToNextMonth));
    const paneCalendarOpacity =
      paneKey === "previous-day"
        ? previousCalendarOpacity
        : paneKey === "next-day"
          ? nextCalendarOpacity
          : slidingCalendarOpacity;

    return (
      <View style={[styles.dayPane, { width: pagerWidth }]} key={paneKey}>
        <Text style={styles.date}>{model.dateLabel}</Text>

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
              {renderCalendarPanel(
                date,
                isCurrentPane,
                styles.inlineCalendarLayer,
                { height: calendarHeight }
              )}
              <View style={styles.timelineRows}>
                <View style={styles.timelineTrack} />
                {events.map((event) => (
                  <View style={styles.eventRow} key={event.time}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.time}>{event.time}</Text>
                    </View>
                    <View style={styles.markerColumn}>
                      <View style={[styles.markerDot, styles[`${event.tone}Dot`]]} />
                    </View>
                    <View style={[styles.eventCard, styles[`${event.tone}Event`]]}>
                      <View>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventMeta}>{event.meta}</Text>
                      </View>
                      {event.title === "项目评审" && (
                        <View style={styles.eventBadge}>
                          <Bell size={14} color="#1d4ed8" strokeWidth={2.2} />
                          <Text style={styles.eventBadgeText}>10分钟</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
          {shouldRenderPaneCalendar &&
            renderCalendarPanel(
              date,
              false,
              [styles.paneCalendarLayer, { opacity: paneCalendarOpacity }],
              { height: calendarHeight }
            )}

        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <View style={styles.topBar}>
          <View style={styles.topIconPlaceholder} />
          <Animated.Text style={[styles.screenTitle, { opacity: navigationTitleOpacity }]}>
            {displayedNavigationTitle}
          </Animated.Text>
          <TouchableOpacity style={styles.topIconButton} activeOpacity={0.75}>
            <Menu size={24} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View
          style={styles.dayPage}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            dayPageWidth.current = width;
            setDayPageWidthState((currentWidth) => (currentWidth === width ? currentWidth : width));
          }}
          {...daySwipeResponder.panHandlers}
        >
          <Animated.View
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

          <TouchableOpacity style={styles.fixedSummary} activeOpacity={0.82}>
            <Text style={styles.summaryLabel}>下一项</Text>
            <Text style={styles.summaryTime}>18:30</Text>
            <Text style={styles.summaryEvent}>晚餐</Text>
            <View style={styles.summarySpacer} />
            <ChevronRight size={24} color="#94a3b8" strokeWidth={2.1} />
          </TouchableOpacity>
        </View>

        <Animated.View
          style={[styles.voiceSheet, { transform: [{ translateY: sheetY }] }]}
        >
          <View
            style={styles.sheetHandleHitArea}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
          </View>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatThread}
            contentContainerStyle={styles.chatContent}
            alwaysBounceVertical={false}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
          >
            {chatMessages.map((message) =>
              message.role === "user" ? (
                <View style={styles.userMessageRow} key={message.id}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{message.text}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.assistantMessageRow} key={message.id}>
                  <View style={styles.assistantAvatar}>
                    <Check size={15} color="#ffffff" strokeWidth={2.6} />
                  </View>
                  <View style={styles.assistantBubble}>
                    <Text style={styles.assistantBubbleTitle}>{message.title}</Text>
                    <Text style={styles.assistantBubbleText}>{message.text}</Text>
                    <Text style={styles.assistantBubbleMeta}>{message.meta}</Text>
                  </View>
                </View>
              )
            )}

            {(isListening || speechText) && (
              <View style={styles.userMessageRow}>
                <View style={[styles.userBubble, styles.liveUserBubble]}>
                  <Text style={styles.userBubbleText}>{speechText || "正在听..."}</Text>
                </View>
              </View>
            )}
          </ScrollView>

        </Animated.View>

        <Animated.View style={[styles.micButtonWrap, { transform: [{ translateY: micTranslateY }] }]}>
          {isListening && (
            <>
              <Animated.View pointerEvents="none" style={[styles.voicePulseRing, voicePulseAStyle]} />
              <Animated.View pointerEvents="none" style={[styles.voicePulseRing, styles.voicePulseRingSoft, voicePulseBStyle]} />
            </>
          )}
          <TouchableOpacity style={styles.micButton} activeOpacity={0.86} onPress={handleMicPress}>
            {isListening ? (
              <View style={styles.voiceWave}>
                {voiceBarStyles.map((barStyle, index) => (
                  <Animated.View key={`voice-bar-${index}`} style={[styles.voiceWaveBar, barStyle]} />
                ))}
              </View>
            ) : (
              <Mic size={30} color="#ffffff" strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eff6ff"
  },
  app: {
    flex: 1,
    paddingTop: 12,
    backgroundColor: "#f8fbff"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    marginBottom: 22
  },
  topIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  topIconPlaceholder: {
    width: 38,
    height: 38
  },
  screenTitle: {
    position: "absolute",
    left: 72,
    right: 72,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0
  },
  date: {
    color: "#0f172a",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0,
    height: 43,
    marginBottom: 6
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
  paneCalendarLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: TIMELINE_LIST_HEADROOM,
    zIndex: 24,
    elevation: 24,
    overflow: "hidden"
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
  timelineTrack: {
    position: "absolute",
    left: 69,
    top: MARKER_CENTER_Y,
    height: EVENT_ROW_HEIGHT * (events.length - 1),
    width: 2,
    borderRadius: 1,
    backgroundColor: "#e2e8f0"
  },
  eventRow: {
    flexDirection: "row",
    minHeight: EVENT_ROW_HEIGHT,
    alignItems: "flex-start"
  },
  timeColumn: {
    width: 58,
    height: 68,
    justifyContent: "center",
    alignItems: "flex-start"
  },
  time: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "650",
    lineHeight: 22
  },
  markerColumn: {
    width: 22,
    minHeight: EVENT_ROW_HEIGHT,
    alignItems: "center"
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 28,
    borderWidth: 2,
    borderColor: "#f8fbff",
    zIndex: 2
  },
  eventCard: {
    flex: 1,
    height: 68,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 0,
    marginLeft: 14,
    marginBottom: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  softEvent: {
    backgroundColor: "#eef6ff",
    borderColor: "#bfdbfe"
  },
  lightEvent: {
    backgroundColor: "#ffffff",
    borderColor: "#dbeafe"
  },
  primaryEvent: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd"
  },
  warmEvent: {
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe"
  },
  softDot: {
    backgroundColor: "#3b82f6"
  },
  lightDot: {
    backgroundColor: "#22c55e"
  },
  primaryDot: {
    backgroundColor: "#f97316"
  },
  warmDot: {
    backgroundColor: "#8b5cf6"
  },
  eventTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800"
  },
  eventMeta: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 5,
    fontWeight: "500"
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ffffff"
  },
  eventBadgeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800"
  },
  voiceSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: SHEET_BOTTOM,
    height: SHEET_HEIGHT,
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.13,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10
  },
  sheetHandleHitArea: {
    alignSelf: "stretch",
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1"
  },
  chatThread: {
    flex: 1,
    paddingTop: 2
  },
  chatContent: {
    gap: 12,
    paddingBottom: 8
  },
  userMessageRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  userBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    backgroundColor: "#2563eb"
  },
  liveUserBubble: {
    opacity: 0.86
  },
  userBubbleText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  assistantMessageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb"
  },
  assistantBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff"
  },
  assistantBubbleTitle: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 5
  },
  assistantBubbleText: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800"
  },
  assistantBubbleMeta: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    fontWeight: "600"
  },
  micButtonWrap: {
    position: "absolute",
    alignSelf: "center",
    bottom: MIC_OPEN_BOTTOM,
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12
  },
  voicePulseRing: {
    position: "absolute",
    left: 0,
    top: 0,
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: "#2563eb"
  },
  voicePulseRingSoft: {
    backgroundColor: "#60a5fa"
  },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d4ed8",
    zIndex: 2,
    elevation: 13
  },
  voiceWave: {
    height: 30,
    minWidth: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  voiceWaveBar: {
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: "#ffffff"
  }
});

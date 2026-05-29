import { StatusBar } from "expo-status-bar";
import { Bell, CalendarDays, Check, ChevronRight, Menu, Mic, Pencil } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
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
const EVENT_ROW_HEIGHT = 92;
const MARKER_CENTER_Y = 34;
const FLOATING_SUMMARY_HEIGHT = 60;
const FLOATING_SUMMARY_TOP = 8;
const FLOATING_SUMMARY_GAP = 22;
const TIMELINE_LIST_HEADROOM = FLOATING_SUMMARY_TOP + FLOATING_SUMMARY_HEIGHT + FLOATING_SUMMARY_GAP;
const TIMELINE_CONTENT_BOTTOM = 0;

const events = [
  { time: "09:00", title: "周会", meta: "团队例会", tone: "soft" },
  { time: "11:30", title: "牙医", meta: "提前30分钟提醒", tone: "light" },
  { time: "15:00", title: "项目评审", meta: "会议室 A", tone: "primary" },
  { time: "18:30", title: "晚餐", meta: "家庭安排", tone: "warm" },
  { time: "15:00", title: "项目评审", meta: "会议室 A", tone: "primary" },
  { time: "18:30", title: "晚餐", meta: "家庭安排", tone: "warm" },
  { time: "15:00", title: "项目评审", meta: "会议室 A", tone: "primary" },
  { time: "18:30", title: "晚餐", meta: "家庭安排", tone: "warm" },
  { time: "15:00", title: "项目评审", meta: "会议室 A", tone: "primary" },
  { time: "18:30", title: "晚餐", meta: "家庭安排", tone: "warm" }
];

export default function App() {
  const sheetY = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);
  const [isSheetOpen, setIsSheetOpen] = useState(true);

  const animateSheet = (toValue, open) => {
    setIsSheetOpen(open);
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.9
    }).start();
  };

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

  const toggleVoiceSheet = () => {
    animateSheet(isSheetOpen ? SHEET_CLOSED_Y : 0, !isSheetOpen);
  };

  const micTranslateY = sheetY.interpolate({
    inputRange: [0, SHEET_CLOSED_Y],
    outputRange: [0, MIC_CLOSED_TRANSLATE_Y],
    extrapolate: "clamp"
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIconButton} activeOpacity={0.75}>
            <Menu size={24} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>今天</Text>
          <TouchableOpacity style={styles.topIconButton} activeOpacity={0.75}>
            <CalendarDays size={23} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.date}>5月29日 周五</Text>

        <View style={styles.timelineArea}>
          <View style={styles.timelineList}>
            <ScrollView
              style={styles.timeline}
              contentContainerStyle={styles.timelineContent}
              alwaysBounceVertical={false}
              bounces={false}
              overScrollMode="never"
              snapToInterval={EVENT_ROW_HEIGHT}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
            >
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
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.summary} activeOpacity={0.82}>
            <Text style={styles.summaryLabel}>下一项</Text>
            <Text style={styles.summaryTime}>18:30</Text>
            <Text style={styles.summaryEvent}>晚餐</Text>
            <View style={styles.summarySpacer} />
            <ChevronRight size={24} color="#94a3b8" strokeWidth={2.1} />
          </TouchableOpacity>
        </View>

        <Animated.View
          style={[styles.voiceSheet, { transform: [{ translateY: sheetY }] }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity style={styles.sheetHandleHitArea} activeOpacity={0.75} onPress={toggleVoiceSheet}>
            <View style={styles.sheetHandle} />
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>识别到</Text>
          <Text style={styles.recognizedText}>明天下午三点提醒我开会</Text>

          <View style={styles.parseCard}>
            <View style={styles.parseIcon}>
              <Check size={18} color="#ffffff" strokeWidth={2.5} />
            </View>
            <View style={styles.parseCopy}>
              <Text style={styles.parseLabel}>将添加</Text>
              <Text style={styles.parseText}>开会 · 明天 15:00 · 提前10分钟</Text>
            </View>
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.82}>
              <Check size={18} color="#ffffff" strokeWidth={2.4} />
              <Text style={styles.primaryButtonText}>确认添加</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.78}>
              <Pencil size={17} color="#1d4ed8" strokeWidth={2.2} />
              <Text style={styles.secondaryButtonText}>修改</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={[styles.micButtonWrap, { transform: [{ translateY: micTranslateY }] }]}>
          <TouchableOpacity style={styles.micButton} activeOpacity={0.86} onPress={toggleVoiceSheet}>
            <Mic size={30} color="#ffffff" strokeWidth={2.4} />
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
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: "#f8fbff"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: 22
  },
  topIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
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
    marginBottom: 6
  },
  timelineArea: {
    flex: 1,
    position: "relative",
    overflow: "visible"
  },
  summary: {
    position: "absolute",
    left: 0,
    right: 0,
    top: FLOATING_SUMMARY_TOP,
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
    paddingTop: TIMELINE_LIST_HEADROOM,
    paddingBottom: TIMELINE_CONTENT_BOTTOM,
    position: "relative"
  },
  timelineTrack: {
    position: "absolute",
    left: 69,
    top: TIMELINE_LIST_HEADROOM + MARKER_CENTER_Y,
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
  sheetTitle: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7
  },
  recognizedText: {
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "800",
    marginBottom: 14
  },
  parseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  parseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb"
  },
  parseCopy: {
    flex: 1
  },
  parseLabel: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800"
  },
  parseText: {
    color: "#0f172a",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "700"
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#2563eb"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryButton: {
    width: 96,
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#ffffff"
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontSize: 15,
    fontWeight: "800"
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
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d4ed8",
    borderWidth: 6,
    borderColor: "#ffffff"
  }
});

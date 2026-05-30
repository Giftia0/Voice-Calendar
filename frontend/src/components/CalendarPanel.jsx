import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { weekDays } from "./calendarConstants";
import { createCalendarModel } from "./calendarHelpers";
import { CALENDAR_BOTTOM_GAP } from "./constants";

export function CalendarDays({ model, isInteractive, onDayPress, activeScale, leavingScale, leavingDateKey, activeTextBaseOpacity, activeTextWhiteOpacity }) {
  return model.days.map((day) => {
    const isActiveDay = day.isToday;
    const isLeavingDay = isInteractive && leavingDateKey === day.id && !day.isToday;
    const Wrapper = isInteractive ? TouchableOpacity : View;
    const wrapperProps = isInteractive
      ? { activeOpacity: 0.72, onPress: () => onDayPress(day.date) }
      : {};

    return (
      <Wrapper style={styles.calendarDay} key={day.id} {...wrapperProps}>
        {isActiveDay && (
          <View pointerEvents="none" style={styles.calendarDayActiveSlot}>
            <Animated.View style={[styles.calendarDayActiveBg, { transform: [{ scale: activeScale }] }]} />
          </View>
        )}
        {isLeavingDay && (
          <View pointerEvents="none" style={styles.calendarDayActiveSlot}>
            <Animated.View style={[styles.calendarDayActiveBg, { transform: [{ scale: leavingScale }] }]} />
          </View>
        )}
        <View pointerEvents="none" style={styles.calendarDayTextLayer}>
          {isActiveDay ? (
            <>
              <Animated.Text style={[styles.calendarDayText, styles.calendarDayTextAnimated, styles.calendarDayTextTodayBase, { opacity: activeTextBaseOpacity }]}>
                {day.day}
              </Animated.Text>
              <Animated.Text style={[styles.calendarDayText, styles.calendarDayTextAnimated, styles.calendarDayTextActive, { opacity: activeTextWhiteOpacity }]}>
                {day.day}
              </Animated.Text>
            </>
          ) : (
            <Text style={[styles.calendarDayText, !day.isCurrentMonth && styles.calendarDayMuted, isLeavingDay && styles.calendarDayTextActive]}>
              {day.day}
            </Text>
          )}
        </View>
      </Wrapper>
    );
  });
}

export function CalendarPanel({ date, isInteractive, onDayPress, activeScale, leavingScale, leavingDateKey, activeTextBaseOpacity, activeTextWhiteOpacity, translateY, heightStyle, layerStyle, onLayout }) {
  const model = date ? createCalendarModel(date) : null;
  if (!model) return null;

  return (
    <Animated.View pointerEvents={isInteractive ? "auto" : "none"} style={[layerStyle, heightStyle]}>
      <Animated.View style={[styles.calendarPullPanel, { transform: [{ translateY }] }]}>
        <View style={styles.calendarPanel} onLayout={onLayout}>
          <View style={styles.weekRow}>
            {weekDays.map((d) => <Text style={styles.weekDay} key={d}>{d}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            <CalendarDays
              model={model}
              isInteractive={isInteractive}
              onDayPress={onDayPress}
              activeScale={activeScale}
              leavingScale={leavingScale}
              leavingDateKey={leavingDateKey}
              activeTextBaseOpacity={activeTextBaseOpacity}
              activeTextWhiteOpacity={activeTextWhiteOpacity}
            />
          </View>
        </View>
        <View style={styles.calendarBottomGap} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  calendarPullPanel: { width: "100%" },
  calendarPanel: {
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14,
    borderWidth: 1, borderColor: "#dbeafe", borderRadius: 18, backgroundColor: "#f8fbff",
  },
  calendarBottomGap: { height: CALENDAR_BOTTOM_GAP },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekDay: { flex: 1, color: "#94a3b8", fontSize: 12, fontWeight: "800", textAlign: "center" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  calendarDay: { width: "14.2857%", height: 32, alignItems: "center", justifyContent: "center" },
  calendarDayActiveSlot: { position: "absolute", width: 32, height: 32, alignItems: "center", justifyContent: "center", zIndex: 1 },
  calendarDayActiveBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2563eb" },
  calendarDayTextLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 3, elevation: 3 },
  calendarDayText: { color: "#0f172a", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  calendarDayTextAnimated: { position: "absolute" },
  calendarDayTextTodayBase: { color: "#0f172a" },
  calendarDayMuted: { color: "#cbd5e1" },
  calendarDayTextActive: { color: "#ffffff" },
});

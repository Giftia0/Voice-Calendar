import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const toneColors = {
  soft: { dot: "#3b82f6", card: { backgroundColor: "#eef6ff", borderColor: "#bfdbfe" } },
  light: { dot: "#22c55e", card: { backgroundColor: "#ffffff", borderColor: "#dbeafe" } },
  primary: { dot: "#f97316", card: { backgroundColor: "#dbeafe", borderColor: "#93c5fd" } },
  warm: { dot: "#8b5cf6", card: { backgroundColor: "#f8fbff", borderColor: "#bfdbfe" } },
};

function formatReminder(minutes) {
  switch (minutes) {
    case 0:
      return "准时";
    case 60:
      return "1小时";
    case 120:
      return "2小时";
    case 1440:
      return "1天";
    case 2880:
      return "2天";
    case 4320:
      return "3天";
    case 10080:
      return "1周";
    default:
      return `${minutes}分钟`;
  }
}

export default function EventRow({ event, onPress }) {
  const tone = toneColors[event.tone] || toneColors.soft;
  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <View style={styles.eventRow}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{event.time}</Text>
      </View>
      <View style={styles.markerColumn}>
        <View style={[styles.markerDot, { backgroundColor: tone.dot }]} />
      </View>
      <CardComponent
        style={[styles.eventCard, tone.card]}
        {...(onPress ? { activeOpacity: 0.78, onPress } : {})}
      >
        <View>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {Boolean(event.meta) && <Text style={styles.eventMeta}>{event.meta}</Text>}
        </View>
        {event.reminderMinutes !== undefined && event.reminderMinutes !== null && (
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeIcon}>!</Text>
            <Text style={styles.eventBadgeText}>{formatReminder(event.reminderMinutes)}</Text>
          </View>
        )}
      </CardComponent>
    </View>
  );
}

const styles = StyleSheet.create({
  eventRow: {
    flexDirection: "row",
    minHeight: 92,
    alignItems: "flex-start",
  },
  timeColumn: {
    width: 58,
    height: 68,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  time: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "650",
    lineHeight: 22,
  },
  markerColumn: {
    width: 22,
    minHeight: 92,
    alignItems: "center",
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 28,
    borderWidth: 2,
    borderColor: "#f8fbff",
    zIndex: 2,
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
    justifyContent: "space-between",
  },
  eventTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  eventMeta: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 5,
    fontWeight: "500",
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  eventBadgeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  eventBadgeIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#1d4ed8",
    color: "#1d4ed8",
    fontSize: 10,
    lineHeight: 11,
    textAlign: "center",
    fontWeight: "900",
  },
});

import { StyleSheet, Text, View } from "react-native";

const toneColors = {
  soft: { dot: "#3b82f6", card: { backgroundColor: "#eef6ff", borderColor: "#bfdbfe" } },
  light: { dot: "#22c55e", card: { backgroundColor: "#ffffff", borderColor: "#dbeafe" } },
  primary: { dot: "#f97316", card: { backgroundColor: "#dbeafe", borderColor: "#93c5fd" } },
  warm: { dot: "#8b5cf6", card: { backgroundColor: "#f8fbff", borderColor: "#bfdbfe" } },
};

export default function EventRow({ event }) {
  const tone = toneColors[event.tone] || toneColors.soft;

  return (
    <View style={styles.eventRow}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{event.time}</Text>
      </View>
      <View style={styles.markerColumn}>
        <View style={[styles.markerDot, { backgroundColor: tone.dot }]} />
      </View>
      <View style={[styles.eventCard, tone.card]}>
        <View>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventMeta}>{event.meta}</Text>
        </View>
        {event.title === "项目评审" && (
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeIcon}>!</Text>
            <Text style={styles.eventBadgeText}>10分钟</Text>
          </View>
        )}
      </View>
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

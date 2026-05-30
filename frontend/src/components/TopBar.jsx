import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function TopBar({ title, titleOpacity }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topIconPlaceholder} />
      <Animated.Text style={[styles.screenTitle, { opacity: titleOpacity }]}>
        {title}
      </Animated.Text>
      <TouchableOpacity style={styles.topIconButton} activeOpacity={0.75}>
        <View style={styles.menuIcon}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  topIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  topIconPlaceholder: {
    width: 38,
    height: 38,
  },
  screenTitle: {
    position: "absolute",
    left: 72,
    right: 72,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
  },
  menuIcon: {
    width: 24,
    height: 20,
    justifyContent: "space-between",
  },
  menuLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#0f172a",
  },
});

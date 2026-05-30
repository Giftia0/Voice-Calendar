import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";

const MIC_SIZE = 64;
const MIC_GAP = 16;
const SHEET_HEIGHT = 300;
const SHEET_BOTTOM = 18;
const MIC_OPEN_BOTTOM = SHEET_BOTTOM + SHEET_HEIGHT + MIC_GAP;

export default function MicButton({
  micTranslateY,
  isListening,
  onPress,
  voiceBarStyles,
  voicePulseAStyle,
  voicePulseBStyle,
}) {
  return (
    <Animated.View
      style={[
        styles.micButtonWrap,
        { transform: [{ translateY: micTranslateY }] },
      ]}
    >
      {isListening && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.voicePulseRing, voicePulseAStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.voicePulseRing, styles.voicePulseRingSoft, voicePulseBStyle]}
          />
        </>
      )}
      <TouchableOpacity
        style={styles.micButton}
        activeOpacity={0.86}
        onPress={onPress}
      >
        {isListening ? (
          <View style={styles.voiceWave}>
            {voiceBarStyles.map((barStyle, index) => (
              <Animated.View
                key={`voice-bar-${index}`}
                style={[styles.voiceWaveBar, barStyle]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.micGlyph}>
            <View style={styles.micHead} />
            <View style={styles.micStem} />
            <View style={styles.micBase} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    elevation: 12,
  },
  voicePulseRing: {
    position: "absolute",
    left: 0,
    top: 0,
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: "#2563eb",
  },
  voicePulseRingSoft: {
    backgroundColor: "#60a5fa",
  },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d4ed8",
    zIndex: 2,
    elevation: 13,
  },
  voiceWave: {
    height: 30,
    minWidth: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  voiceWaveBar: {
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  micGlyph: {
    width: 30,
    height: 34,
    alignItems: "center",
  },
  micHead: {
    width: 15,
    height: 21,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  micStem: {
    width: 3,
    height: 8,
    backgroundColor: "#ffffff",
    borderRadius: 2,
    marginTop: -1,
  },
  micBase: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
});

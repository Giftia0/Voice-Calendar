import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const SHEET_HEIGHT = 300;
const SHEET_BOTTOM = 18;

export default function VoiceSheet({
  messages,
  speechText,
  isListening,
  chatScrollRef,
  panResponder,
  sheetY,
  showTextInput,
  textInputValue,
  onTextInputChange,
  onTextSend,
}) {
  return (
    <Animated.View
      style={[
        styles.voiceSheet,
        { transform: [{ translateY: sheetY }] },
      ]}
    >
      <View style={styles.sheetHandleHitArea} {...panResponder.panHandlers}>
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
        {messages.map((message) =>
          message.role === "user" ? (
            <View style={styles.userMessageRow} key={message.id}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{message.text}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.assistantMessageRow} key={message.id}>
              <View style={styles.assistantAvatar}>
                <Text style={styles.assistantAvatarMark}>✓</Text>
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
              <Text style={styles.userBubbleText}>
                {speechText || "正在听..."}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {showTextInput && (
        <View style={styles.textInputRow}>
          <TextInput
            style={styles.textInput}
            value={textInputValue}
            onChangeText={onTextInputChange}
            placeholder="输入日程描述..."
            placeholderTextColor="#94a3b8"
            returnKeyType="send"
            onSubmitEditing={onTextSend}
            autoFocus
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={onTextSend}
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    elevation: 10,
  },
  sheetHandleHitArea: {
    alignSelf: "stretch",
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  chatThread: {
    flex: 1,
    paddingTop: 2,
  },
  chatContent: {
    gap: 12,
    paddingBottom: 8,
  },
  userMessageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  userBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    backgroundColor: "#2563eb",
  },
  liveUserBubble: {
    opacity: 0.86,
  },
  userBubbleText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  assistantMessageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  assistantAvatarMark: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900",
  },
  assistantBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  assistantBubbleTitle: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 5,
  },
  assistantBubbleText: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  assistantBubbleMeta: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    fontWeight: "600",
  },
  textInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: "#f1f5f9",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
  },
});

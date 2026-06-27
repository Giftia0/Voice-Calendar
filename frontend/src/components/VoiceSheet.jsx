import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const SHEET_HEIGHT = 300;
const SHEET_BOTTOM = 18;

const eventResultToneStyles = {
  success: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    badgeBackground: "#16a34a",
    titleColor: "#166534",
  },
  info: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    badgeBackground: "#2563eb",
    titleColor: "#1d4ed8",
  },
  danger: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    badgeBackground: "#dc2626",
    titleColor: "#991b1b",
  },
  warning: {
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    badgeBackground: "#d97706",
    titleColor: "#92400e",
  },
};

function EventResultCard({ message }) {
  const tone = eventResultToneStyles[message.tone] || eventResultToneStyles.info;
  const isConflict = message.resultType === "conflict";
  const details = [message.time, message.location].filter(Boolean).join(" · ");
  const requestedDetails = [message.requested?.time, message.requested?.location].filter(Boolean).join(" · ");

  return (
    <View style={[styles.eventResultCard, { borderColor: tone.borderColor, backgroundColor: tone.backgroundColor }]}>
      <View style={styles.eventResultHeader}>
        <View style={[styles.eventResultBadge, { backgroundColor: tone.badgeBackground }]}>
          <Text style={styles.eventResultBadgeText}>{message.operation}</Text>
        </View>
      </View>
      {!isConflict && (
        <>
          <Text style={[styles.eventResultTitle, { color: tone.titleColor }]} numberOfLines={2}>
            {message.title}
          </Text>
          {!!details && <Text style={styles.eventResultDetail}>{details}</Text>}
          {!!message.description && <Text style={styles.eventResultDescription}>{message.description}</Text>}
        </>
      )}
      {isConflict && (
        <View style={styles.conflictContent}>
          {!!message.requested && (
            <View style={styles.conflictBlock}>
              <Text style={styles.conflictLabel}>{message.requestedLabel}</Text>
              <Text style={styles.conflictEventTitle}>{message.requested.title}</Text>
              {!!requestedDetails && <Text style={styles.conflictEventMeta}>{requestedDetails}</Text>}
            </View>
          )}
          <View style={styles.conflictBlock}>
            <Text style={styles.conflictLabel}>已有安排</Text>
            {message.conflicts.map((item, index) => {
              const conflictDetails = [item.time, item.location].filter(Boolean).join(" · ");
              return (
                <View style={styles.conflictItem} key={`${item.title}-${index}`}>
                  <Text style={styles.conflictEventTitle}>{item.title}</Text>
                  {!!conflictDetails && <Text style={styles.conflictEventMeta}>{conflictDetails}</Text>}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

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
          ) : message.variant === "event_result" ? (
            <View style={[styles.assistantMessageRow, styles.eventResultRow]} key={message.id}>
              <View style={styles.assistantAvatar}>
                <Text style={styles.assistantAvatarMark}>✓</Text>
              </View>
              <EventResultCard message={message} />
            </View>
          ) : (
            <View style={styles.assistantMessageRow} key={message.id}>
              <View style={styles.assistantAvatar}>
                <Text style={styles.assistantAvatarMark}>✓</Text>
              </View>
              <View style={styles.assistantBubble}>
                <Text style={styles.assistantBubbleTitle}>{message.title}</Text>
                <Text style={styles.assistantBubbleText}>{message.text}</Text>
                {!!message.meta && <Text style={styles.assistantBubbleMeta}>{message.meta}</Text>}
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

      <View style={styles.textInputRow}>
        <TextInput
          style={styles.textInput}
          value={textInputValue}
          onChangeText={onTextInputChange}
          placeholder="输入日程描述..."
          placeholderTextColor="#94a3b8"
          returnKeyType="send"
          onSubmitEditing={onTextSend}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={onTextSend}
          activeOpacity={0.7}
        >
          <Text style={styles.sendButtonText}>›</Text>
        </TouchableOpacity>
      </View>
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
  eventResultRow: {
    width: "100%",
    alignItems: "flex-start",
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
  eventResultCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  eventResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  eventResultBadge: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  eventResultBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
  },
  eventResultTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  eventResultDetail: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
    fontWeight: "700",
  },
  eventResultDescription: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: "600",
  },
  conflictContent: {
    marginTop: 10,
    gap: 9,
  },
  conflictBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  conflictLabel: {
    color: "#92400e",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    marginBottom: 5,
  },
  conflictItem: {
    paddingTop: 7,
    marginTop: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(180, 83, 9, 0.16)",
  },
  conflictEventTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  conflictEventMeta: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    fontWeight: "700",
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

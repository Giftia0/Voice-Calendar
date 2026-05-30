import React from "react";
import { Animated, ScrollView, Text, View } from "react-native";
import EventRow from "./EventRow";

const DayPane = ({
  date,
  paneKey,
  isCurrentPane,
  calendarModel,
  createCalendarModel,
  pagerWidth,
  shouldPrepareSlidingCalendar,
  shouldSlideToPreviousMonth,
  shouldSlideToNextMonth,
  previousCalendarOpacity,
  nextCalendarOpacity,
  slidingCalendarOpacity,
  calendarHeight,
  isCalendarOpen,
  timelinePullResponder,
  timelineScrollRef,
  handleTimelineScroll,
  timelineViewportHeight,
  timelineContentHeight,
  events,
  renderCalendarPanel,
  styles,
}) => {
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
            onScroll={isCurrentPane ? handleTimelineScroll : undefined}
          >
            <View style={styles.timelineTopSpacer} />
            {shouldPrepareSlidingCalendar
              ? renderCalendarPanel(date, isCurrentPane, styles.inlineCalendarLayer, { height: calendarHeight })
              : renderCalendarPanel(date, false, [styles.inlineCalendarLayer, { opacity: 0 }], { height: calendarHeight })}
            <View style={styles.timelineRows}>
              <View style={styles.timelineTrack} />
              {events.map((event) => (
                <EventRow key={event.time} event={event} />
              ))}
            </View>
          </ScrollView>
        </View>
        {shouldRenderPaneCalendar && (
          <Animated.View
            pointerEvents="none"
            style={[styles.paneCalendarLayer, { height: calendarHeight }]}
          >
            <Animated.View style={{ flex: 1, opacity: paneCalendarOpacity }}>
              {renderCalendarPanel(date, false, {}, null)}
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

export default DayPane;

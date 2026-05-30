import { DAY_IN_MS, fullWeekDays } from './calendarConstants';

export const isSameDay = (firstDate, secondDate) =>
  firstDate.getFullYear() === secondDate.getFullYear() &&
  firstDate.getMonth() === secondDate.getMonth() &&
  firstDate.getDate() === secondDate.getDate();

export const getDateKey = (date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

export const getMonthKey = (date) =>
  `${date.getFullYear()}-${date.getMonth()}`;

export const getCalendarDayIndex = (date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS);

export const formatNavigationTitle = (date, today = new Date()) => {
  const dayDiff = getCalendarDayIndex(date) - getCalendarDayIndex(today);
  if (Math.abs(dayDiff) <= 7) {
    if (dayDiff === 0) return "今天";
    if (dayDiff === -1) return "昨天";
    if (dayDiff === 1) return "明天";
    return dayDiff < 0 ? `${Math.abs(dayDiff)}天前` : `${dayDiff}天后`;
  }
  if (date.getFullYear() !== today.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

export const getDayStartTime = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const addDays = (date, amount) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

export const createCalendarModel = (baseDate) => {
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
        isToday: isSameDay(date, baseDate),
      };
    }),
  };
};

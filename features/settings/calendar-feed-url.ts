export const calendarFeedUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/u, "")}/api/calendar/${token}.ics`;

import {
  parseISO,
  isSameDay,
  isAfter,
  startOfDay,
  endOfDay,
  nextFriday,
  nextSaturday,
  nextSunday,
} from "date-fns";

import { toZonedTime } from "date-fns-tz";

export interface Show {
  title: string;
  category: string;
  image: string;
  bookingUrl: string;
  eventId: string;
  description: string;
  venue: string;
  address: string;
  startDate: string;
  endDate: string;
  duration: string;
  price: string;
  currency: string;
  performers: string[];
  languages: string[];
}

export interface ShowSection {
  title: string;
  shows: Show[];
}

export function groupShows(shows: Show[]): ShowSection[] {
  const sorted = [...shows].sort(
    (a, b) =>
      parseISO(a.startDate).getTime() -
      parseISO(b.startDate).getTime()
  );


const today = toZonedTime(new Date(), "Asia/Kolkata");

  const friday = startOfDay(nextFriday(today));
  const saturday = startOfDay(nextSaturday(today));
  const sunday = startOfDay(nextSunday(today));
  const sundayEnd = endOfDay(nextSunday(today));

  const todayShows = sorted.filter((show) =>
    isSameDay(parseISO(show.startDate), today)
  );

  const fridayShows = sorted.filter((show) =>
    isSameDay(parseISO(show.startDate), friday)
  );

  const saturdayShows = sorted.filter((show) =>
    isSameDay(parseISO(show.startDate), saturday)
  );

  const sundayShows = sorted.filter((show) =>
    isSameDay(parseISO(show.startDate), sunday)
  );

  const comingSoon = sorted.filter((show) => {
    const date = parseISO(show.startDate);
    return isAfter(date, sundayEnd);
  });

  const weekday = today.getDay(); // 0 = Sun ... 6 = Sat

  const sections: ShowSection[] = [];

  if (todayShows.length) {
    sections.push({
      title: "Tonight",
      shows: todayShows,
    });
  }

  switch (weekday) {
    case 1: // Monday
    case 2: // Tuesday
    case 3: // Wednesday
    case 4: // Thursday
      if (fridayShows.length) {
        sections.push({
          title: "Friday",
          shows: fridayShows,
        });
      }

      if (saturdayShows.length) {
        sections.push({
          title: "Saturday",
          shows: saturdayShows,
        });
      }

      if (sundayShows.length) {
        sections.push({
          title: "Sunday",
          shows: sundayShows,
        });
      }
      break;

    case 5: // Friday
      if (saturdayShows.length) {
        sections.push({
          title: "Saturday",
          shows: saturdayShows,
        });
      }

      if (sundayShows.length) {
        sections.push({
          title: "Sunday",
          shows: sundayShows,
        });
      }
      break;

    case 6: // Saturday
      if (sundayShows.length) {
        sections.push({
          title: "Sunday",
          shows: sundayShows,
        });
      }
      break;

    case 0: // Sunday
      break;
  }

  if (comingSoon.length) {
    sections.push({
      title: "Coming Soon",
      shows: comingSoon,
    });
  }

  return sections;
}

import { Show } from "@/types/show";
import {
  format,
  isToday,
  parseISO,
} from "date-fns";

export interface Sections {
  tonight: Show[];
  friday: Show[];
  saturday: Show[];
  sunday: Show[];
  comingSoon: Show[];
}

export function categorizeShows(shows: Show[]): Sections {

  const tonight: Show[] = [];
  const friday: Show[] = [];
  const saturday: Show[] = [];
  const sunday: Show[] = [];
  const comingSoon: Show[] = [];

  shows.forEach((show) => {

const date = parseISO(show.startDate);

    if (isToday(date)) {
      tonight.push(show);
      return;
    }

    const day = format(date, "EEEE");

    switch (day) {

      case "Friday":
        friday.push(show);
        break;

      case "Saturday":
        saturday.push(show);
        break;

      case "Sunday":
        sunday.push(show);
        break;

      default:
        comingSoon.push(show);
    }

  });

  return {
    tonight,
    friday,
    saturday,
    sunday,
    comingSoon,
  };
}

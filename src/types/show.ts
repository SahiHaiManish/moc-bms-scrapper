export interface Show {
  id: string;

  title: string;

  image: string;

  bookingUrl: string;

  date: string;

  startTime: string;

  performers: string[];

  source: "bookmyshow" | "manual";
}

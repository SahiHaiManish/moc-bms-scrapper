export interface ShowSummary {
  eventId: string;

  title: string;
  category: string;

  bookingUrl: string;
  image: string;

  languages: string[];
}

export interface EventDetails {
  eventId: string;
  /** unique per date+time; eventId alone repeats for multi-date listings */
  sessionId?: string;

  title: string;
  description: string;

  bookingUrl: string;
  image: string;

  venue: string;
  address: string;

  startDate: string;
  endDate: string;

  duration: string;

  price: number;
  currency: string;

  performers: string[];
}

export type Show = ShowSummary & EventDetails;

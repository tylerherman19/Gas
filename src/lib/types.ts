export type Station = {
  station_id: number;
  name: string;
  city: string;
  state: string;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  last_checked_at: string | null;
  regular: number | null;
  premium: number | null;
  diesel: number | null;
  observed_at: string | null;
};

export type DailyPoint = {
  station_id: number;
  day: string;
  regular: number | null;
  premium: number | null;
};

export type PriceChange = {
  station_id: number;
  observed_at: string;
  regular: number | null;
  premium: number | null;
  previous_regular: number | null;
};

export type Grade = "regular" | "premium";

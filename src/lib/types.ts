export const GENRES = [
  "All",
  "Pop",
  "Hip-Hop",
  "R&B",
  "Rock",
  "Indie",
  "Electronic",
  "Latin",
  "K-Pop",
  "Country",
  "Metal",
  "Jazz",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];
export type GenreFilter = Genre;
export type TimeFilter = "all" | "today" | "yesterday" | "month";

export type Spot = {
  id: string;
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  genre: Exclude<Genre, "All">;
  bid: number;
  clicks: number;
  raisedAt: number;
  askingPrice?: number;
};

export type Activity = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  bid: number;
  at: number;
};

export type BoardState = {
  spots: Spot[];
  activity: Activity[];
  online: number;
};

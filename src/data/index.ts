import type { Client, Holding, HouseViewEntry, NewsItem, PositionEvent, ReviewLogEntry, Rm, Theme } from "../types";
import rmsJson from "./rms.json";
import clientsJson from "./clients.json";
import holdingsJson from "./holdings.json";
import newsJson from "./news.json";
import themesJson from "./themes.json";
import positionEventsJson from "./positionEvents.json";
import seedReviewLogJson from "./seedReviewLog.json";
import houseViewJson from "./houseView.json";

export interface DataSet {
  rms: Rm[];
  clients: Client[];
  holdings: Holding[];
  news: NewsItem[];
  themes: Theme[];
  positionEvents: PositionEvent[];
  houseView: HouseViewEntry[];
}

export const data: DataSet = {
  rms: rmsJson as Rm[],
  clients: clientsJson as Client[],
  holdings: holdingsJson as Holding[],
  news: newsJson as NewsItem[],
  themes: themesJson as Theme[],
  positionEvents: positionEventsJson as PositionEvent[],
  houseView: houseViewJson as HouseViewEntry[],
};

/** Two earlier Portfolio Review log entries for Kevin Tan's #1 client, so the review timeline has history. */
export const SEED_REVIEW_LOG = seedReviewLogJson as ReviewLogEntry[];

/** Fixed demo date: Monday, 12 October 2026. */
export const DEMO_DATE = "2026-10-12";
export const SCAN_TIME = "08:30";
export const DELIVERY_TIME = "09:00";
/** The demo shows the day as it stands at 14:00 SGT: the brief, the overnight alert and the 13:21 alert are all in. */
export const DEMO_NOW = "14:00";
export const HOLDINGS_AS_OF = "Holdings as of 9 Oct 2026 (sample bank statements and Trade Plotter)";
export const SAMPLE_BANNER =
  "Prototype with sample data. Illustrative scenario, not real market news or client data.";

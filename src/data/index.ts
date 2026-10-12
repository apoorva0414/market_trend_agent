import type { Client, Holding, HouseViewEntry, NewsItem, Product, Rm, Theme } from "../types";
import rmsJson from "./rms.json";
import clientsJson from "./clients.json";
import holdingsJson from "./holdings.json";
import newsJson from "./news.json";
import themesJson from "./themes.json";
import productsJson from "./products.json";
import houseViewJson from "./houseView.json";

export interface DataSet {
  rms: Rm[];
  clients: Client[];
  holdings: Holding[];
  news: NewsItem[];
  themes: Theme[];
  products: Product[];
  houseView: HouseViewEntry[];
}

export const data: DataSet = {
  rms: rmsJson as Rm[],
  clients: clientsJson as Client[],
  holdings: holdingsJson as Holding[],
  news: newsJson as NewsItem[],
  themes: themesJson as Theme[],
  products: productsJson as Product[],
  houseView: houseViewJson as HouseViewEntry[],
};

/** Fixed demo date: Monday, 12 October 2026. */
export const DEMO_DATE = "2026-10-12";
export const SCAN_TIME = "08:30";
export const DELIVERY_TIME = "09:00";
export const AD_HOC_TIME = "13:45";
export const HOLDINGS_AS_OF = "Holdings as of 9 Oct 2026 (sample bank statements and Trade Plotter)";
export const SAMPLE_BANNER =
  "Prototype with sample data. Illustrative scenario, not real market news or client data.";

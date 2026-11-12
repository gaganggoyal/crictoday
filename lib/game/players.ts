import data from "@/data/game/players.json";

/** Mystery Cricketer's players and their labels. The data is built by scripts/game/build_players.py. */

export type Country =
  | "Afghanistan"
  | "Australia"
  | "Bangladesh"
  | "England"
  | "India"
  | "Ireland"
  | "New Zealand"
  | "Pakistan"
  | "South Africa"
  | "Sri Lanka"
  | "West Indies"
  | "Zimbabwe";

export type Role = "bat" | "bowl" | "ar" | "wk";
export type Hand = "L" | "R";
export type Bowling =
  "right-pace" | "left-pace" | "off-spin" | "leg-spin" | "left-finger" | "left-wrist";
export type IplTeam =
  | "CSK"
  | "DC"
  | "GT"
  | "KKR"
  | "LSG"
  | "MI"
  | "PBKS"
  | "RCB"
  | "RR"
  | "SRH"
  | "DCG"
  | "GL"
  | "KTK"
  | "PWI"
  | "RPS";

export type Player = {
  id: string;
  name: string;
  country: Country;
  role: Role;
  bats: Hand;
  /** The style he bowls, or null if he bowled in fewer than a quarter of his internationals. */
  bowls: Bowling | null;
  /** YYYY-MM-DD. */
  born: string;
  /** The year of his first international for the country shown. */
  debut: number;
  /** The IPL franchise he last played for, or null if he never played in the IPL. */
  ipl: IplTeam | null;
  /** Other names people search for him by. */
  aka?: string[];
  /** One of the well-known players a day's answer is chosen from. */
  answer?: boolean;
  /** Every IPL franchise he has played for; kept for answers only. */
  iplTeams?: IplTeam[];
};

export type Region = "Asia" | "Oceania" | "Europe" | "Africa" | "the Americas";

export const COUNTRIES: Record<Country, { code: string; region: Region; slug: string }> = {
  Afghanistan: { code: "AFG", region: "Asia", slug: "afghanistan" },
  Australia: { code: "AUS", region: "Oceania", slug: "australia" },
  Bangladesh: { code: "BAN", region: "Asia", slug: "bangladesh" },
  England: { code: "ENG", region: "Europe", slug: "england" },
  India: { code: "IND", region: "Asia", slug: "india" },
  Ireland: { code: "IRE", region: "Europe", slug: "ireland" },
  "New Zealand": { code: "NZ", region: "Oceania", slug: "new-zealand" },
  Pakistan: { code: "PAK", region: "Asia", slug: "pakistan" },
  "South Africa": { code: "SA", region: "Africa", slug: "south-africa" },
  "Sri Lanka": { code: "SL", region: "Asia", slug: "sri-lanka" },
  "West Indies": { code: "WI", region: "the Americas", slug: "west-indies" },
  Zimbabwe: { code: "ZIM", region: "Africa", slug: "zimbabwe" },
};

export const ROLES: Record<Role, string> = {
  bat: "Batter",
  bowl: "Bowler",
  ar: "All-rounder",
  wk: "Keeper",
};

export const BOWLING: Record<Bowling, string> = {
  "right-pace": "Right-arm pace",
  "left-pace": "Left-arm pace",
  "off-spin": "Off-spin",
  "leg-spin": "Leg-spin",
  "left-finger": "Left-arm orthodox",
  "left-wrist": "Left-arm wrist spin",
};

export const IPL_TEAMS: Record<IplTeam, string> = {
  CSK: "Chennai Super Kings",
  DC: "Delhi Capitals",
  GT: "Gujarat Titans",
  KKR: "Kolkata Knight Riders",
  LSG: "Lucknow Super Giants",
  MI: "Mumbai Indians",
  PBKS: "Punjab Kings",
  RCB: "Royal Challengers Bengaluru",
  RR: "Rajasthan Royals",
  SRH: "Sunrisers Hyderabad",
  DCG: "Deccan Chargers",
  GL: "Gujarat Lions",
  KTK: "Kochi Tuskers Kerala",
  PWI: "Pune Warriors India",
  RPS: "Rising Pune Supergiant",
};

export const PLAYERS = data.players as Player[];
/** The day the data was built, as YYYY-MM-DD. */
export const PLAYERS_UPDATED = data.updated;
export const ANSWERS = PLAYERS.filter((player) => player.answer);

const BY_ID = new Map(PLAYERS.map((player) => [player.id, player]));

export function playerById(id: string) {
  return BY_ID.get(id);
}

import { slugify } from "@/lib/domain/slug";

// India's 28 states and 8 union territories, each with its main cricket towns. The menu, the
// state and city pages, and the club and match forms use this list. A town that is not listed
// can still be typed in a form; it is then shown under its state.

export type IndiaCity = { slug: string; name: string };
export type IndiaState = {
  slug: string;
  name: string;
  territory: boolean;
  cities: IndiaCity[];
};

function state(name: string, cities: string[], territory = false): IndiaState {
  return {
    slug: slugify(name),
    name,
    territory,
    cities: cities.map((city) => ({ slug: slugify(city), name: city })),
  };
}

export const INDIA_STATES: IndiaState[] = [
  state("Andhra Pradesh", [
    "Visakhapatnam",
    "Vijayawada",
    "Guntur",
    "Nellore",
    "Tirupati",
    "Kurnool",
    "Kakinada",
    "Rajahmundry",
    "Anantapur",
    "Kadapa",
  ]),
  state("Arunachal Pradesh", ["Itanagar", "Pasighat"]),
  state("Assam", ["Guwahati", "Dibrugarh", "Jorhat", "Silchar", "Tezpur"]),
  state("Bihar", ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia"]),
  state("Chhattisgarh", ["Raipur", "Bhilai", "Bilaspur", "Durg", "Korba"]),
  state("Goa", ["Panaji", "Margao", "Vasco da Gama", "Mapusa"]),
  state("Gujarat", [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Gandhinagar",
    "Bhavnagar",
    "Jamnagar",
    "Junagadh",
    "Anand",
  ]),
  state("Haryana", [
    "Gurugram",
    "Faridabad",
    "Panchkula",
    "Rohtak",
    "Panipat",
    "Ambala",
    "Karnal",
    "Hisar",
    "Sonipat",
  ]),
  state("Himachal Pradesh", ["Dharamshala", "Shimla", "Mandi", "Solan"]),
  state("Jharkhand", ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"]),
  state("Karnataka", [
    "Bengaluru",
    "Mysuru",
    "Hubballi",
    "Mangaluru",
    "Belagavi",
    "Shivamogga",
    "Davanagere",
    "Kalaburagi",
    "Tumakuru",
  ]),
  state("Kerala", [
    "Thiruvananthapuram",
    "Kochi",
    "Kozhikode",
    "Thrissur",
    "Kollam",
    "Kannur",
    "Alappuzha",
    "Palakkad",
  ]),
  state("Madhya Pradesh", [
    "Indore",
    "Bhopal",
    "Gwalior",
    "Jabalpur",
    "Ujjain",
    "Sagar",
    "Rewa",
    "Satna",
  ]),
  state("Maharashtra", [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Thane",
    "Navi Mumbai",
    "Nashik",
    "Chhatrapati Sambhajinagar",
    "Kolhapur",
    "Solapur",
    "Sangli",
    "Amravati",
  ]),
  state("Manipur", ["Imphal"]),
  state("Meghalaya", ["Shillong"]),
  state("Mizoram", ["Aizawl"]),
  state("Nagaland", ["Dimapur", "Kohima"]),
  state("Odisha", ["Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur", "Berhampur", "Puri"]),
  state("Punjab", ["Mohali", "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"]),
  state("Rajasthan", ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar"]),
  state("Sikkim", ["Gangtok"]),
  state("Tamil Nadu", [
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Tiruchirappalli",
    "Salem",
    "Tirunelveli",
    "Vellore",
    "Erode",
    "Tiruppur",
    "Dindigul",
  ]),
  state("Telangana", ["Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam"]),
  state("Tripura", ["Agartala"]),
  state("Uttar Pradesh", [
    "Lucknow",
    "Kanpur",
    "Noida",
    "Greater Noida",
    "Ghaziabad",
    "Varanasi",
    "Agra",
    "Prayagraj",
    "Meerut",
    "Gorakhpur",
    "Bareilly",
    "Aligarh",
  ]),
  state("Uttarakhand", ["Dehradun", "Haridwar", "Haldwani", "Rudrapur", "Rishikesh"]),
  state("West Bengal", ["Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol", "Kharagpur"]),
  state("Andaman and Nicobar Islands", ["Sri Vijaya Puram"], true),
  state("Chandigarh", ["Chandigarh"], true),
  state("Dadra and Nagar Haveli and Daman and Diu", ["Daman", "Silvassa", "Diu"], true),
  state("Delhi", ["Delhi"], true),
  state("Jammu and Kashmir", ["Jammu", "Srinagar"], true),
  state("Ladakh", ["Leh"], true),
  state("Lakshadweep", ["Kavaratti"], true),
  state("Puducherry", ["Puducherry"], true),
];

const STATE_BY_SLUG = new Map(INDIA_STATES.map((item) => [item.slug, item]));
const STATE_BY_CITY = new Map(
  INDIA_STATES.flatMap((item) => item.cities.map((city) => [city.slug, item] as const)),
);

/** Cities people look for first, shown before the state list. */
export const POPULAR_CITIES = [
  "mumbai",
  "delhi",
  "bengaluru",
  "chennai",
  "kolkata",
  "hyderabad",
  "ahmedabad",
  "pune",
  "lucknow",
  "jaipur",
  "indore",
  "chandigarh",
].map((slug) => {
  const home = STATE_BY_CITY.get(slug)!;
  return { ...home.cities.find((city) => city.slug === slug)!, stateSlug: home.slug };
});

export function indiaState(slug: string | null | undefined) {
  return slug ? (STATE_BY_SLUG.get(slug) ?? null) : null;
}

/** The state a listed Indian town belongs to. Unlisted towns return null. */
export function stateOfCity(citySlug: string | null | undefined) {
  return citySlug ? (STATE_BY_CITY.get(citySlug) ?? null) : null;
}

/** A listed town's name, or null. */
export function indiaCity(citySlug: string | null | undefined) {
  const home = stateOfCity(citySlug);
  return home?.cities.find((city) => city.slug === citySlug) ?? null;
}

/** The state of an Indian place: the stored one, else the one its town is listed under. */
export function placeState(place: {
  countrySlug: string;
  citySlug: string;
  stateSlug: string | null;
}) {
  if (place.countrySlug !== "india") return null;
  return indiaState(place.stateSlug) ?? stateOfCity(place.citySlug);
}

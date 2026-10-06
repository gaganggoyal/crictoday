import "server-only";
import { stateOfCity } from "@/lib/data/india";
import { createClient } from "@supabase/supabase-js";
import type { StoredAcademy, StoredMatch, StoredOffer } from "@/lib/domain/types";

export function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type MatchRow = {
  id: string;
  slug: string;
  competition_name: string;
  competition_slug: string;
  kind: StoredMatch["kind"];
  season_name: string | null;
  season_slug: string | null;
  home_name: string;
  home_short: string;
  home_slug: string;
  away_name: string;
  away_short: string;
  away_slug: string;
  venue_name: string;
  venue_slug: string;
  venue_address: string;
  city_name: string;
  city_slug: string;
  country_name: string;
  country_slug: string;
  starts_at: string;
  ends_at: string | null;
  source_timezone: string;
  format: StoredMatch["format"];
  status: StoredMatch["status"];
  attendance_type: StoredMatch["attendanceType"];
  source_type: StoredMatch["sourceType"];
  source_external_id: string | null;
  source_url: string | null;
  source_label: string | null;
  featured_rank: number;
  last_verified_at: string | null;
  published_at: string | null;
  entry_notes: string | null;
  academy_slug: string | null;
  offers: StoredOffer[] | null;
};

export function mapMatchRow(row: MatchRow): StoredMatch {
  return {
    id: row.id,
    slug: row.slug,
    competitionName: row.competition_name,
    competitionSlug: row.competition_slug,
    kind: row.kind,
    seasonName: row.season_name,
    seasonSlug: row.season_slug,
    homeName: row.home_name,
    homeShort: row.home_short,
    homeSlug: row.home_slug,
    awayName: row.away_name,
    awayShort: row.away_short,
    awaySlug: row.away_slug,
    venueName: row.venue_name,
    venueSlug: row.venue_slug,
    venueAddress: row.venue_address,
    cityName: row.city_name,
    citySlug: row.city_slug,
    // The Supabase schema predates states, so Indian towns take theirs from the town list.
    stateName: row.country_slug === "india" ? (stateOfCity(row.city_slug)?.name ?? null) : null,
    stateSlug: row.country_slug === "india" ? (stateOfCity(row.city_slug)?.slug ?? null) : null,
    countryName: row.country_name,
    countrySlug: row.country_slug,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.source_timezone,
    format: row.format,
    status: row.status,
    attendanceType: row.attendance_type,
    sourceType: row.source_type,
    sourceExternalId: row.source_external_id,
    sourceUrl: row.source_url,
    sourceLabel: row.source_label || "Listed source",
    featuredRank: row.featured_rank,
    lastVerifiedAt: row.last_verified_at,
    publishedAt: row.published_at,
    entryNotes: row.entry_notes,
    demo: false,
    academySlug: row.academy_slug,
    offers: row.offers ?? [],
  };
}

type AcademyRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  city_name: string;
  city_slug: string;
  country_name: string;
  country_slug: string;
  website: string | null;
  phone: string | null;
  contact_email: string | null;
  age_groups: string[];
  facilities: string[];
  verification_status: StoredAcademy["verificationStatus"];
  verification_label: string | null;
  last_verified_at: string | null;
};

/** Supabase stores academies only, without the profile fields the MySQL schema added. */
export function mapAcademyRow(row: AcademyRow): StoredAcademy {
  const home = row.country_slug === "india" ? stateOfCity(row.city_slug) : null;
  return {
    id: row.id,
    slug: row.slug,
    kind: "academy",
    name: row.name,
    description: row.description,
    address: row.address,
    cityName: row.city_name,
    citySlug: row.city_slug,
    stateName: home?.name ?? null,
    stateSlug: home?.slug ?? null,
    countryName: row.country_name,
    countrySlug: row.country_slug,
    timezone: null,
    website: row.website,
    phone: row.phone,
    whatsapp: null,
    contactEmail: row.contact_email,
    links: {},
    ageGroups: row.age_groups ?? [],
    facilities: row.facilities ?? [],
    offerings: [],
    logo: null,
    cover: null,
    photos: [],
    verificationStatus: row.verification_status,
    verificationLabel: row.verification_label,
    reviewNotes: null,
    lastVerifiedAt: row.last_verified_at,
    ownerEmail: null,
    demo: false,
  };
}

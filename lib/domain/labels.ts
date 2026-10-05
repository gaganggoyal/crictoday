import type { CompetitionKind, MatchFormat, MatchStatus } from "@/lib/domain/types";

export const FORMAT_LABEL: Record<MatchFormat, string> = {
  test: "Test",
  odi: "ODI",
  t20: "T20",
  t10: "T10",
  hundred: "The Hundred",
  other: "Other",
};

export const KIND_LABEL: Record<CompetitionKind, string> = {
  international: "International",
  league: "League",
  domestic: "Domestic",
  academy: "Academy",
};

export const STATUS_LABEL: Record<MatchStatus, string> = {
  draft: "Draft",
  pending: "Pending review",
  published: "Scheduled",
  postponed: "Postponed",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const TIMEZONES = [
  "Asia/Kolkata",
  "Europe/London",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Australia/Adelaide",
  "Africa/Johannesburg",
  "America/Port_of_Spain",
  "America/Barbados",
  "Pacific/Auckland",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Colombo",
];

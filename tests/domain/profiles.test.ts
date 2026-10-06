import { describe, expect, it } from "vitest";
import { profilePath, shortName, telHref, whatsappHref } from "@/lib/domain/profiles";
import { offeringSchema, ownerMatchSchema, profileSchema } from "@/lib/validation/profile";

const profile = {
  kind: "club",
  name: "Shivaji Park Gymkhana",
  description: "A club that plays weekend league cricket and takes junior members.",
  country: "india",
  state: "maharashtra",
  city: "Mumbai",
  address: "Shivaji Park, Dadar",
  timezone: "",
  contactEmail: "club@example.com",
  phone: "+91 98765 43210",
  whatsapp: "",
  website: "",
  instagram: "https://www.instagram.com/shivajipark",
  facebook: "",
  youtube: "",
  ageGroups: ["U14", "Senior"],
  facilities: ["Nets"],
  consent: "true",
};

describe("profiles", () => {
  it("puts academies under /academy and everything else under /club", () => {
    expect(profilePath({ kind: "academy", slug: "a" })).toBe("/academy/a");
    expect(profilePath({ kind: "committee", slug: "c" })).toBe("/club/c");
  });

  it("shortens team names for match cards", () => {
    expect(shortName("Shivaji Park Gymkhana")).toBe("SPG");
    expect(shortName("Mumbai Cricket Club")).toBe("MCC");
    expect(shortName("Strikers")).toBe("STR");
    expect(shortName("Young Stars XI (Under-16)")).toBe("YSXU");
  });

  it("builds WhatsApp and phone links only from real numbers", () => {
    expect(whatsappHref("+91 98765 43210")).toBe("https://wa.me/919876543210");
    expect(whatsappHref("12345")).toBeNull();
    expect(telHref("+91 (22) 2444 0000")).toBe("tel:+912224440000");
    expect(telHref("")).toBeNull();
  });

  it("accepts a complete profile", () => {
    expect(profileSchema.safeParse(profile).success).toBe(true);
  });

  it("asks an Indian profile for its state, and a kind for every profile", () => {
    const missing = profileSchema.safeParse({ ...profile, state: "", kind: "" });
    expect(missing.success).toBe(false);
    const paths = missing.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["state", "kind"]));
    expect(profileSchema.safeParse({ ...profile, country: "australia", state: "" }).success).toBe(
      true,
    );
  });

  it("checks social links point at their own sites", () => {
    const wrong = profileSchema.safeParse({ ...profile, instagram: "https://example.com/club" });
    expect(wrong.error?.issues[0]?.message).toMatch(/instagram\.com/);
    expect(
      profileSchema.safeParse({ ...profile, facebook: "http://facebook.com/club" }).success,
    ).toBe(false);
  });

  it("needs an offer's name, and a booking link that is a full https address", () => {
    const base = { profile: "p", category: "coaching", title: "U14 coaching" };
    expect(offeringSchema.safeParse(base).success).toBe(true);
    expect(offeringSchema.safeParse({ ...base, title: "U" }).success).toBe(false);
    expect(offeringSchema.safeParse({ ...base, url: "https://bit.ly/x" }).success).toBe(false);
  });

  it("refuses a match between the same two sides", () => {
    const match = ownerMatchSchema.safeParse({
      profile: "p",
      homeTeam: "Dadar Union",
      awayTeam: "dadar union",
      date: "2026-11-01",
      time: "09:30",
      ground: "Shivaji Park",
      state: "maharashtra",
      city: "Mumbai",
      format: "t20",
      attendance: "free",
    });
    expect(match.error?.issues[0]).toMatchObject({ path: ["awayTeam"] });
  });
});

describe("one-line fields", () => {
  it("fold line breaks into spaces, so names stay one line in pages and email subjects", () => {
    const parsed = profileSchema.parse({ ...profile, name: "Shivaji Park\r\nBcc: someone" });
    expect(parsed.name).toBe("Shivaji Park Bcc: someone");
    const match = ownerMatchSchema.parse({
      profile: "p",
      homeTeam: "Dadar\n  Union",
      awayTeam: "Matunga Lions",
      date: "2026-11-01",
      time: "09:30",
      ground: "Shivaji   Park",
      state: "maharashtra",
      city: "Mumbai",
      format: "t20",
      attendance: "free",
    });
    expect([match.homeTeam, match.ground]).toEqual(["Dadar Union", "Shivaji Park"]);
  });
});

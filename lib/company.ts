/** Who runs cricketmatch.today and how to reach them, for the about, contact and policy pages. */

export const CONTACT_EMAIL = "hello@cricketmatch.today";

/** The person India's IT Rules, 2021 ask a site with user posts to name for complaints. */
export const GRIEVANCE_OFFICER = { name: "Gagan", title: "Founder" };

/** When the privacy policy and the terms last changed, as YYYY-MM-DD. */
export const POLICIES_UPDATED = "2026-10-06";

export const FOUNDERS = [
  {
    name: "Gagan",
    title: "Founder",
    bio: "Gagan is an engineer from one of India's top engineering colleges. As founder, Gagan leads the product and the technology: the site, the match data, and the checks that keep every listing honest.",
  },
  {
    name: "Vansh",
    title: "Co-founder",
    bio: "Vansh is young, cricket-mad and wants to be a cricketer. Vansh brings the player's eye to the site: what a young cricketer needs to know, from where to train to where the next trial is and where to play.",
  },
] as const;

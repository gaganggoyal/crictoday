/** Who runs cricketmatch.today and how to reach them, for the about, contact and policy pages. */

export const CONTACT_EMAIL = "hello@cricketmatch.today";

/** When the privacy policy and the terms last changed, as YYYY-MM-DD. */
export const POLICIES_UPDATED = "2026-10-06";

/** When "How we check ticket links", the ticket policy, last changed, as YYYY-MM-DD. */
export const TICKET_POLICY_UPDATED = "2026-10-07";

/** The other site the same team runs, named in the footer and on the about page. */
export const SISTER_SITE = { name: "indiaoffers.in", url: "https://indiaoffers.in" } as const;

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

import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("link", { name: "Demo inbox: open the sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
}

test("a visitor can search, filter, and open a ground", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Country").selectOption("india");
  await page.getByRole("button", { name: "Search matches" }).click();
  await expect(page).toHaveURL(/country=india/);
  await expect(page.getByRole("link", { name: /India versus Australia/ }).first()).toBeVisible();

  await page.getByLabel("City").selectOption({ label: "Ahmedabad" });
  await page.getByLabel("Format").selectOption("test");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/city=ahmedabad/);
  await expect(page).toHaveURL(/format=test/);
  await page
    .getByRole("link", { name: /India versus Australia/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/match\/india-vs-australia/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("India vs Australia");
  await expect(page.getByText("Your time:")).toBeVisible();
  await expect(page.getByRole("link", { name: "Narendra Modi Stadium" })).toBeVisible();

  const calendar = await page.request.get(
    "/match/india-vs-australia-1st-test-ahmedabad-2026-10-16/calendar",
  );
  expect(calendar.status()).toBe(200);
  expect(calendar.headers()["content-type"]).toContain("text/calendar");
  expect(await calendar.text()).toContain("BEGIN:VCALENDAR");
});

test("ticket states and the outbound interstitial stay honest", async ({ page }) => {
  await page.goto("/match/victoria-vs-new-south-wales-melbourne-2026-10-27");
  await expect(page.getByText("Authorised partner").first()).toBeVisible();
  await expect(page.getByText("partner.demo.cricketmatch.today").first()).toBeVisible();

  await page.goto("/match/karnataka-vs-mumbai-bengaluru-2026-10-06");
  await expect(page.getByRole("heading", { name: "Free entry" })).toBeVisible();

  await page.goto("/match/maidan-pace-lab-trial-mumbai-2026-10-09");
  await expect(page.getByRole("heading", { name: "Private match" })).toBeVisible();

  await page.goto("/match/oval-invincibles-vs-birmingham-phoenix-2026-10-18");
  await expect(page.getByRole("heading", { name: "Sold out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join update list" })).toBeVisible();

  await page.goto("/match/england-vs-new-zealand-lords-2026-10-20");
  await expect(page.getByText("This match is postponed")).toBeVisible();

  await page.goto("/match/surrey-vs-yorkshire-birmingham-2026-10-22");
  await expect(page.getByText("This match is cancelled")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request ticket alert" })).toHaveCount(0);

  await page.goto("/match/india-vs-australia-1st-test-ahmedabad-2026-10-16");
  await page.getByRole("link", { name: "View official tickets" }).click();
  await expect(
    page.getByRole("heading", { name: "Check the seller before you continue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue to tickets.demo.cricketmatch.today/ }),
  ).toHaveAttribute("href", /^https:\/\/tickets\.demo\.cricketmatch\.today\//);
});

test("directories, leagues, and a missing match resolve", async ({ page }) => {
  await page.goto("/country/india");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("India");
  await page.getByRole("link", { name: "Ahmedabad" }).first().click();
  await expect(page).toHaveURL(/\/country\/india\/ahmedabad/);

  await page.goto("/league/ipl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Indian Premier League");
  await page.goto("/teams/india");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("India");
  await page.goto("/venues/narendra-modi-stadium");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Narendra Modi Stadium");
  await page.goto("/academies");
  await page.getByRole("link", { name: /Chandigarh Cricket Academy/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chandigarh Cricket Academy");

  await page.goto("/matches");
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("link", { name: "Previous" }).click();
  await expect(page).not.toHaveURL(/page=2/);

  const missing = await page.goto("/match/not-a-real-fixture");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("That page is not on the card.")).toBeVisible();

  for (const path of [
    "/legal/terms",
    "/legal/privacy",
    "/legal/ticket-policy",
    "/about/demo-data",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("a fan can request, confirm, and stop a ticket alert", async ({ page }) => {
  const email = `alert-${Date.now()}@example.com`;
  await page.goto("/match/india-vs-australia-2nd-test-delhi-2026-10-24");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Your country").fill("India");
  await page.getByRole("checkbox", { name: /Email me about this match only/ }).check();
  await page.getByRole("button", { name: "Request ticket alert" }).click();
  await expect(page.getByText("Check your email to confirm the alert.")).toBeVisible();
  const stopHref = await page
    .getByRole("link", { name: "Demo inbox: stop this alert" })
    .getAttribute("href");
  expect(stopHref).toContain("intent=unsubscribe");
  const confirmHref = await page
    .getByRole("link", { name: "Demo inbox: open the confirmation link" })
    .getAttribute("href");
  // Mail scanners open every link in a message. Opening one must not change the alert.
  await page.goto(stopHref || "/");
  await expect(page.getByRole("heading", { name: "Stop this ticket alert?" })).toBeVisible();
  await page.goto(confirmHref || "/");
  await expect(page.getByRole("heading", { name: "Confirm your ticket alert" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm alert" }).click();
  await expect(page.getByRole("heading", { name: "Alert confirmed" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the match" }).click();
  await expect(page).toHaveURL(/delhi-2026-10-24/);

  await signIn(page, email);
  await expect(page.getByText("Your ticket alerts").locator("xpath=..")).toContainText("1");
  await page.goto("/match/india-vs-australia-2nd-test-delhi-2026-10-24");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Your country").fill("India");
  await page.getByRole("checkbox", { name: /Email me about this match only/ }).check();
  await page.getByRole("button", { name: "Request ticket alert" }).click();
  await expect(page.getByText("You already have an alert for this match.")).toBeVisible();
  await page.goto(stopHref || "/");
  await page.getByRole("button", { name: "Stop alert" }).click();
  await expect(page.getByRole("heading", { name: "Alert stopped" })).toBeVisible();
});

test("an organiser lists a match and a moderator publishes the ticket link", async ({ page }) => {
  const stamp = Date.now();
  const email = `club-${stamp}@example.com`;
  const home = `Harbour ${stamp}`;
  await page.goto("/submit/match");
  await page.getByRole("textbox", { name: "Contact email" }).fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Competition" }).fill("Goa T20 Cup");
  await page.getByRole("textbox", { name: "Home side" }).fill(home);
  await page.getByRole("textbox", { name: "Away side" }).fill("Coastal XI");
  await page.getByRole("textbox", { name: "Start" }).fill("2026-12-02T15:30");
  await page.getByRole("textbox", { name: "Venue" }).fill("Campal Ground");
  await page.getByRole("textbox", { name: "City" }).fill("Panaji");
  await page.getByRole("textbox", { name: "Country" }).fill("India");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("textbox", { name: "Source URL" })
    .fill("https://example.com/harbour-fixture");
  await page
    .getByRole("textbox", { name: "Ticket URL, if you have one" })
    .fill("https://tickets.demo.cricketmatch.today/harbour");
  await page.getByRole("textbox", { name: "Seller name" }).fill("Demo Board");
  await page.getByRole("checkbox", { name: /I am allowed to submit this fixture/ }).check();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Submission received" })).toBeVisible();

  await signIn(page, email);
  await page.goto("/dashboard/matches");
  await expect(page.getByText(/match · pending/i)).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, "admin@cricketmatch.today");
  await page.goto("/admin/submissions");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page
    .getByRole("link", { name: new RegExp(email) })
    .first()
    .click();
  await expect(page.getByText(home)).toBeVisible();
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("Decision saved.")).toBeVisible();

  await page.goto("/admin/ticket-links");
  const card = page.locator("li").filter({ hasText: home });
  await card.getByRole("button", { name: "Approve link" }).click();
  await expect(
    page.getByText(`Approved · tickets.demo.cricketmatch.today · ${home} vs Coastal XI`),
  ).toBeVisible();

  await page.goto(`/matches?q=${encodeURIComponent(home)}`);
  await page
    .getByRole("link", { name: new RegExp(home) })
    .first()
    .click();
  await expect(page.getByText("tickets.demo.cricketmatch.today").first()).toBeVisible();
  await expect(page.getByText("DEMO").first()).toBeVisible();
});

test("an academy owner can submit a listing and report a correction", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/submit/academy");
  await page.getByRole("textbox", { name: "Academy name" }).fill(`Riverside Nets ${stamp}`);
  await page.getByRole("textbox", { name: "Address" }).fill("12 River Road");
  await page.getByRole("textbox", { name: "City" }).fill("Pune");
  await page.getByRole("textbox", { name: "Country" }).fill("India");
  await page.getByRole("textbox", { name: "Contact email" }).fill(`academy-${stamp}@example.com`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("textbox", { name: "Website", exact: true })
    .fill("https://example.com/riverside-nets");
  await page.getByRole("checkbox", { name: "U14" }).check();
  await page.getByRole("checkbox", { name: "Nets" }).check();
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("Evening nets for school players on a turf pitch in Pune.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("textbox", { name: "Ownership evidence" })
    .fill("I coach at this ground and can confirm the contact.");
  await page.getByRole("checkbox", { name: /These contact details are mine/ }).check();
  await page.getByRole("button", { name: "Submit academy" }).click();
  await expect(page.getByRole("heading", { name: "Academy submitted" })).toBeVisible();

  await page.goto("/match/india-vs-australia-1st-test-ahmedabad-2026-10-16");
  await page
    .getByLabel("What should change?")
    .fill("The gate opens 90 minutes before the start, not two hours.");
  await page.getByRole("button", { name: "Report incorrect details" }).click();
  await expect(page.getByText("A moderator will check this report.")).toBeVisible();

  await signIn(page, "moderator@cricketmatch.today");
  await page.goto("/admin/corrections");
  await page.getByText("The gate opens 90 minutes before the start").first().click();
  await page.getByLabel("Decision").selectOption("reject");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("A reason is required.")).toBeVisible();
  await expect(page.getByLabel("Decision")).toHaveValue("reject");
  await page.getByLabel("Reason").fill("Gate times come from the venue, not the organiser.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("Decision saved.")).toBeVisible();
  await expect(page.getByText("correction · rejected")).toBeVisible();
});

test("theme, share, sign-out, and a phone layout hold up", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/match/india-vs-australia-1st-test-ahmedabad-2026-10-16");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();

  await signIn(page, "fan@cricketmatch.today");
  await page.goto("/login");
  await expect(page.getByText("fan@cricketmatch.today")).toBeVisible();
  await page.getByRole("link", { name: "Your account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find the match. Feel the ground.",
  );

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const privacy = page.getByRole("contentinfo").getByRole("link", { name: "Privacy" });
  await privacy.scrollIntoViewIfNeeded();
  const linkBox = await privacy.boundingBox();
  const navBox = await page.getByRole("navigation", { name: "Mobile" }).boundingBox();
  expect(linkBox && navBox && linkBox.y + linkBox.height <= navBox.y + 1).toBe(true);
  await page
    .getByRole("navigation", { name: "Mobile" })
    .getByRole("link", { name: "Countries" })
    .click();
  await expect(page).toHaveURL(/\/countries/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("sign-in never redirects off the site", async ({ page }) => {
  await page.route("**://example.com/**", (route) => route.fulfill({ body: "external" }));
  for (const next of ["/\t/example.com", "/\r\n/example.com"]) {
    await page.context().clearCookies();
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(`redirect-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.getByRole("link", { name: "Demo inbox: open the sign-in link" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  }
});

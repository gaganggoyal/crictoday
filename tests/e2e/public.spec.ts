import { expect, test } from "@playwright/test";

test("home states the product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the match. Feel the ground.");
  await expect(page.getByText("Demo inventory. Fixtures, prices and ticket links are illustrative")).toBeVisible();
});

test("filters stay in the address bar", async ({ page }) => {
  await page.goto("/matches");
  await page.getByLabel("Search").fill("Ahmedabad");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=Ahmedabad/);
  await expect(page.getByRole("link", { name: /India versus Australia/ }).first()).toBeVisible();
});

test("a match shows the seller domain before the outbound link", async ({ page }) => {
  await page.goto("/match/india-vs-australia-1st-test-ahmedabad-2026-10-16");
  await expect(page.getByText("tickets.demo.cricketmatch.today").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View official tickets" })).toHaveAttribute(
    "href",
    /^\/go\//,
  );
});

test("a ticket alert requires an email", async ({ page }) => {
  await page.goto("/match/india-vs-australia-2nd-test-delhi-2026-10-24");
  await page.getByRole("button", { name: "Request ticket alert" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("a match submission validates the organiser email", async ({ page }) => {
  await page.goto("/submit/match");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter a valid contact email.")).toBeVisible();
});

test("a demo admin reaches moderation and the role form on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@cricketmatch.today");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("link", { name: "Demo inbox: open the sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Moderation queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
  await expect(page.getByLabel("Account email or user id")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test("the home and match pages fit a 375px screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/", "/matches", "/match/india-vs-australia-1st-test-ahmedabad-2026-10-16"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  }
});

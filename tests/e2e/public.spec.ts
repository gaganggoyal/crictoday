import { expect, test } from "@playwright/test";

test("home states the product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cricket matches today and upcoming fixtures",
  );
  await expect(
    page.getByText("Demo inventory. Fixtures, prices and ticket links are illustrative"),
  ).toBeVisible();
});

test("filters stay in the address bar", async ({ page }) => {
  await page.goto("/matches");
  await page.getByLabel("Search", { exact: true }).fill("Ahmedabad");
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
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
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

test("forms keep what was typed when the server rejects it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("fan@localhost");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("fan@localhost");

  await page.goto("/match/india-vs-australia-1st-test-ahmedabad-2026-10-16");
  const details = "The gate opens 90 minutes before the start, not two hours.";
  await page.getByLabel("What should change?").fill(details);
  await page.getByLabel("Email, optional").fill("fan@localhost");
  await page.getByRole("button", { name: "Report incorrect details" }).click();
  await expect(page.getByText("Enter a valid email.")).toBeVisible();
  await expect(page.getByLabel("What should change?")).toHaveValue(details);
});

test("a ticket alert is checked in the browser before it is sent", async ({ page }) => {
  await page.goto("/match/india-vs-australia-2nd-test-delhi-2026-10-24");
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
  });
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await email.fill("fan@example.com");
  await page.getByLabel("Your country").fill("India");
  await page.getByRole("button", { name: "Request ticket alert" }).click();
  await expect(page.getByText("Consent is required.")).toBeVisible();
  await expect(email).toHaveValue("fan@example.com");
  await expect(page.getByLabel("Your country")).toHaveValue("India");
  expect(posted).toBe(false);
});

test("the hero search stays readable in dark mode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/");
  for (const name of ["Team, league, city or venue", "Country"]) {
    const ratio = await page
      .getByLabel(name)
      .first()
      .evaluate((element) => {
        const luminance = (color: string) => {
          const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((part) => {
            const value = Number(part) / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const style = getComputedStyle(element);
        const [text, background] = [luminance(style.color), luminance(style.backgroundColor)];
        return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
      });
    expect(ratio, name).toBeGreaterThan(4.5);
  }
});

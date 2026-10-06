import { expect, test } from "@playwright/test";

test("the about, contact and policy pages are linked from the footer", async ({ page }) => {
  const pages: [string, string][] = [
    ["About us", "Cricket is everywhere. Finding it should be easy."],
    ["Contact us", "Talk to us"],
    ["Terms of use", "Terms of use"],
    ["Privacy policy", "Privacy policy"],
    ["Ticket policy", "Ticket policy"],
  ];
  for (const [link, heading] of pages) {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Grievance Officer" }).click();
  await expect(page).toHaveURL(/\/contact#grievance-officer$/);
  await expect(page.getByRole("heading", { name: "Grievance Officer" })).toBeVisible();
});

test("the about page introduces the founders", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Gagan", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vansh", exact: true })).toBeVisible();
});

test("the addresses people guess for the policies redirect", async ({ page }) => {
  const redirects: [string, string][] = [
    ["/privacy", "/legal/privacy"],
    ["/terms", "/legal/terms"],
    ["/about-us", "/about"],
    ["/contact-us", "/contact"],
  ];
  for (const [from, to] of redirects) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  }
});

test("pages carry a canonical, a share image and structured data", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(
    "Cricket matches today, fixtures and tickets · cricketmatch.today",
  );
  // The site's root, with or without the trailing slash: the same address to a search engine.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https?:\/\/[^/]+\/?$/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\/site$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  const home = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(home.join("")).toContain('"@type":"WebSite"');

  const slug = "india-vs-australia-1st-test-ahmedabad-2026-10-16";
  await page.goto(`/match/${slug}`);
  await expect(page).toHaveTitle(
    /^India vs Australia .*– Ahmedabad, 16 Oct 2026 · cricketmatch\.today$/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`/og/match/${slug}$`),
  );
  const data = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
    "",
  );
  expect(data).toContain('"@type":"SportsEvent"');
  expect(data).toContain('"@type":"BreadcrumbList"');

  const image = await page.request.get(`/og/match/${slug}`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("filtered views and empty places stay out of search and the sitemap", async ({ page }) => {
  await page.goto("/matches");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await page
    .getByRole("navigation", { name: "When" })
    .getByRole("link", { name: "This weekend" })
    .click();
  await expect(page).toHaveURL(/when=weekend/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cricket matches this weekend");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");

  await page.goto("/country/india/state/bihar");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/about</loc>");
  expect(sitemap).toContain("/contact</loc>");
  expect(sitemap).toContain("/match/india-vs-australia-1st-test-ahmedabad-2026-10-16</loc>");
  expect(sitemap).not.toContain("/state/bihar</loc>");
  expect(sitemap).not.toContain("/submit/");
});

test("the new pages fit a 320px screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const path of [
    "/",
    "/about",
    "/contact",
    "/legal/privacy",
    "/legal/terms",
    "/matches?when=today",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, path).toBe(false);
  }
});

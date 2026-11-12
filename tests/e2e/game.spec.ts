import { expect, test, type Page } from "@playwright/test";

const GAME = "/games/mystery-cricketer";

// Sachin Tendulkar is never a day's answer, so guessing him never ends the game by chance.
async function guessSachin(page: Page) {
  await page.getByRole("combobox", { name: "Guess a cricketer" }).fill("tendulkar");
  await page.getByRole("option", { name: /Sachin Tendulkar/ }).click();
}

test("a guess shows seven clues and is still there after a reload", async ({ page }) => {
  await page.goto(GAME);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mystery Cricketer");
  await expect(page.getByText("8 of 8 guesses left")).toBeVisible();

  await guessSachin(page);
  const guesses = page.getByRole("list", { name: "Your guesses, newest first" });
  const row = guesses.getByRole("listitem").filter({ hasText: "Sachin Tendulkar" }).first();
  await expect(row).toBeVisible();
  // Each clue says in words how it compares, for screen readers.
  for (const clue of ["Country India", "Role Batter", "Bats Right-handed", "Debut 1989"]) {
    await expect(row.getByText(new RegExp(`^${clue}: (match|close|no match)`))).toHaveCount(1);
  }
  await expect(page.getByText("7 of 8 guesses left")).toBeVisible();

  await page.reload();
  await expect(guesses.getByText("Sachin Tendulkar")).toBeVisible();
  await expect(page.getByText("7 of 8 guesses left")).toBeVisible();

  // A name already guessed is not offered again.
  await page.getByRole("combobox", { name: "Guess a cricketer" }).fill("tendulkar");
  await expect(page.getByText("You have already guessed Sachin Tendulkar.")).toBeVisible();
});

test("the game is linked from the footer, carries a share image and fits a 320px screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Mystery Cricketer" }).click();
  await expect(page).toHaveURL(new RegExp(`${GAME}$`));

  // Link previews read the page as served, so check its image on a fresh load: after moving
  // between pages in the browser, the last page's image tag can linger in the head.
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(GAME);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\/game$/);
  const image = await page.request.get("/og/game");
  expect(image.headers()["content-type"]).toBe("image/png");

  await guessSachin(page);
  await expect(page.getByText("7 of 8 guesses left")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});

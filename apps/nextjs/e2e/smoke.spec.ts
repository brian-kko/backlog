import { test, expect } from "@playwright/test";

test("renders Backlog web dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/T3 Turbo|Backlog/i);
});

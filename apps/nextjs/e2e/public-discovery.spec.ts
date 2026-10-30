import { expect, test } from "@playwright/test";

// Exercise the real Next.js route and tRPC streaming link. Unlike smoke.spec,
// this uses the public adapters, including their offline catalog fallback.
test("public pages load through the real API without browser or tRPC errors", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.emulateMedia({ colorScheme: "dark" });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/trpc/") && response.status() >= 400)
      errors.push(`tRPC HTTP ${response.status()}`);
  });
  page.on("requestfailed", (request) => {
    if (
      request.url().includes("/api/trpc/") &&
      request.failure()?.errorText !== "net::ERR_ABORTED"
    )
      errors.push(request.failure()?.errorText ?? "Failed tRPC request");
  });
  await page.goto("/");
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Estimated Value" })
      .locator("dd"),
  ).toHaveText(/^\$[\d,.]+$/, { timeout: 15000 });
  await expect(page.getByTestId("deal-card")).toHaveCount(4, {
    timeout: 15000,
  });
  await page.getByTestId("nav-deals").click();
  await expect(page.getByTestId("deal-card").first()).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("nav-library").click();
  await expect(page.getByTestId("library-card")).toHaveCount(3);
  const completion = page.getByLabel("Completion status for Cyberpunk 2077", {
    exact: true,
  });
  const contrast = await completion.evaluate((select) => {
    // Resolve CSS lab/oklch colors to sRGB before measuring WCAG contrast.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const luminance = (color: string) => {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data]
        .slice(0, 3)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
      return (
        channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      );
    };
    return [
      select,
      select.querySelector("option")!,
      document.querySelector('input[type="number"]')!,
    ].map((element) => {
      const style = getComputedStyle(element);
      const text = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return {
        tag: element.tagName,
        foreground: style.color,
        background: style.backgroundColor,
        ratio:
          (Math.max(text, background) + 0.05) /
          (Math.min(text, background) + 0.05),
      };
    });
  });
  await page.screenshot({
    path: testInfo.outputPath("library-contrast.png"),
    fullPage: true,
  });
  for (const item of contrast)
    expect(item.ratio, JSON.stringify(contrast)).toBeGreaterThan(7);
  await page.getByTestId("nav-wishlist").click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(0);
  await page.getByTestId("nav-updates").click();
  await expect(
    page.getByText("Loading Steam news…", { exact: true }),
  ).toHaveCount(0, { timeout: 15000 });
  await page.goto("/game/1091500");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cyberpunk 2077",
    { timeout: 15000 },
  );
  await expect(page.getByText(/^Historical low: \$[\d,.]+ · USD$/)).toBeVisible(
    { timeout: 15000 },
  );
  await expect(
    page.getByRole("link", { name: "View on Steam ↗", exact: true }),
  ).toHaveAttribute("href", "https://store.steampowered.com/app/1091500/");
  await page.screenshot({
    path: testInfo.outputPath("game-hub.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

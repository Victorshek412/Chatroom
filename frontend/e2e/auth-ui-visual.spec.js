import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.setTimeout(120000);

const artifactDir = path.resolve("e2e", "artifacts");

async function capturePage(page, route, prefix) {
  await page.goto(route);
  await page.setViewportSize({ width: 1440, height: 1024 });

  await page.evaluate(() => {
    window.localStorage.setItem("chatroom-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  });
  await page.reload();

  await page.screenshot({
    path: path.join(artifactDir, `${prefix}-light.png`),
    fullPage: true,
  });

  await page.locator('button[title="Dark mode"], button[title="Light mode"]').first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.screenshot({
    path: path.join(artifactDir, `${prefix}-dark.png`),
    fullPage: true,
  });
}

test("captures login and signup UI screenshots", async ({ page }) => {
  await mkdir(artifactDir, { recursive: true });
  await capturePage(page, "/login", "login-ui");
  await capturePage(page, "/signup", "signup-ui");
});

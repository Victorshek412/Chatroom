import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.setTimeout(120000);

const password = "password123";
const artifactDir = path.resolve("e2e", "artifacts");

const users = {
  alice: {
    id: "user-alice",
    name: "Alice Tester",
    email: "alice@example.com",
  },
  bob: {
    id: "user-bob",
    name: "Bob Stone",
    email: "bob@example.com",
  },
};

async function resetServer(request) {
  const response = await request.post("http://localhost:3100/test/reset");
  expect(response.ok()).toBeTruthy();
}

async function login(page, user) {
  await page.goto("/login");
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
}

async function openConversation(page, user) {
  await page.getByTestId("tab-chats").click();
  await page.getByTestId(`chat-item-${user.id}`).click();
  await expect(page.getByTestId("chat-header-name")).toHaveText(user.name);
}

async function sendMessage(page, text) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send-message").click();
}

test("captures chat UI reference screenshots in light and dark mode", async ({
  browser,
  page,
  request,
}) => {
  await mkdir(artifactDir, { recursive: true });
  await resetServer(request);

  const bobContext = await browser.newContext({ baseURL: "http://localhost:4173" });
  const bobPage = await bobContext.newPage();

  try {
    await login(page, users.alice);
    await login(bobPage, users.bob);

    await openConversation(page, users.bob);
    await openConversation(bobPage, users.alice);

    await sendMessage(bobPage, "1");
    await sendMessage(bobPage, "hi");
    await expect(page.getByTestId("message-list").getByText("1")).toBeVisible();
    await expect(page.getByTestId("message-list").getByText("hi")).toBeVisible();

    await sendMessage(page, "hi");
    await sendMessage(page, "hi");
    await expect(
      bobPage.getByTestId("message-list").getByText("hi").last(),
    ).toBeVisible();

    await sendMessage(bobPage, "hi");
    await expect(page.getByTestId("message-list").locator("text=hi").last()).toBeVisible();

    await sendMessage(page, "Yo");
    await expect(page.getByTestId("message-list").getByText("Yo")).toBeVisible();

    await bobContext.close();
    await expect(page.getByText("offline")).toBeVisible();

    await page.screenshot({
      path: path.join(artifactDir, "chat-ui-light.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.screenshot({
      path: path.join(artifactDir, "chat-ui-dark.png"),
      fullPage: true,
    });
  } finally {
    try {
      await bobContext.close();
    } catch {
      // Context may already be closed by the test body.
    }
  }
});

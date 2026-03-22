import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockServerUrl = "http://localhost:3100";
const frontendUrl = "http://localhost:4173";
const password = "password123";
const avatarFixturePath = path.resolve(__dirname, "../public/login.png");

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
  cara: {
    id: "user-cara",
    name: "Cara Lane",
    email: "cara@example.com",
  },
};

const soundFiles = [
  "/sound/mouse-click.mp3",
  "/sound/notification.mp3",
  "/sound/keystroke1.mp3",
  "/sound/keystroke2.mp3",
  "/sound/keystroke3.mp3",
  "/sound/keystroke4.mp3",
];

async function resetServer(request) {
  const response = await request.post(`${mockServerUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

async function login(page, user) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
  await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
}

async function openChat(page, user) {
  await page.getByTestId(`chat-item-${user.id}`).click();
  await expect(page.getByTestId("chat-header-name")).toHaveText(user.name);
}

function captureSoundFailures(page) {
  const failures = [];

  page.on("requestfailed", (request) => {
    if (request.url().includes("/sound/")) {
      failures.push(request.url());
    }
  });

  return failures;
}

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

test("clears chat state when logging out and back in as a different user", async ({
  page,
}) => {
  await login(page, users.alice);
  await openChat(page, users.bob);

  await expect(page.getByText("Bob says hello from the slow thread")).toBeVisible();

  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("login-submit")).toBeVisible();

  await page.getByTestId("login-email").fill(users.bob.email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
  await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
  await expect(
    page.getByText("Bob says hello from the slow thread"),
  ).toHaveCount(0);
});

test("keeps the latest chat selected when a slower previous response resolves later", async ({
  page,
}) => {
  await login(page, users.alice);

  await page.getByTestId(`chat-item-${users.bob.id}`).click();
  await page.getByTestId(`chat-item-${users.cara.id}`).click();

  await expect(page.getByTestId("chat-header-name")).toHaveText(users.cara.name);
  await expect(page.getByText("Cara has the latest fast thread")).toBeVisible();

  await page.waitForTimeout(700);

  await expect(page.getByTestId("chat-header-name")).toHaveText(users.cara.name);
  await expect(
    page.getByText("Bob says hello from the slow thread"),
  ).toHaveCount(0);
});

test("syncs sender messages across tabs without duplicating them", async ({
  page,
  context,
}) => {
  const messageText = "Phase 1 multi-tab sender sync";

  await login(page, users.alice);
  const secondTab = await context.newPage();
  await secondTab.goto("/");
  await expect(secondTab.getByTestId("profile-avatar-button")).toBeVisible();

  await openChat(page, users.bob);
  await openChat(secondTab, users.bob);

  await page.getByTestId("message-input").fill(messageText);
  await page.getByTestId("send-message").click();

  await expect(
    page.getByTestId("message-list").getByText(messageText),
  ).toHaveCount(1);
  await expect(
    secondTab.getByTestId("message-list").getByText(messageText),
  ).toHaveCount(1);

  await page.waitForTimeout(400);

  await expect(
    page.getByTestId("message-list").getByText(messageText),
  ).toHaveCount(1);
  await expect(
    secondTab.getByTestId("message-list").getByText(messageText),
  ).toHaveCount(1);
});

test("persists the uploaded avatar after refresh", async ({ page }) => {
  await login(page, users.alice);

  await page
    .getByTestId("profile-avatar-input")
    .setInputFiles(avatarFixturePath);

  await expect(page.getByTestId("profile-avatar-image")).toHaveAttribute(
    "src",
    /^data:image\//,
  );

  const uploadedAvatar = await page
    .getByTestId("profile-avatar-image")
    .getAttribute("src");

  expect(uploadedAvatar).toMatch(/^data:image\//);

  await page.reload();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
  await expect(page.getByTestId("profile-avatar-image")).toHaveAttribute(
    "src",
    uploadedAvatar,
  );
});

test("keeps touched sound assets valid during the covered chat flows", async ({
  page,
  request,
}) => {
  const soundFailures = captureSoundFailures(page);

  await login(page, users.alice);
  await page.getByTestId("sound-toggle").click();
  await openChat(page, users.bob);
  await page.getByTestId("message-input").pressSequentially("ping");

  const incomingText = "Incoming sound asset check";
  const pushMessageResponse = await request.post(
    `${mockServerUrl}/test/push-message`,
    {
      data: {
        senderId: users.bob.id,
        receiverId: users.alice.id,
        text: incomingText,
      },
    },
  );
  expect(pushMessageResponse.ok()).toBeTruthy();

  await expect(page.getByText(incomingText)).toBeVisible();

  for (const soundFile of soundFiles) {
    const response = await request.get(`${frontendUrl}${soundFile}`);
    expect(response.ok(), `${soundFile} should be reachable`).toBeTruthy();
  }

  await page.waitForTimeout(200);
  expect(soundFailures).toEqual([]);
});

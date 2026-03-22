import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendUrl = "http://localhost:4173";
const mockServerUrl = "http://localhost:3100";
const password = "password123";
const pdfFixturePath = path.resolve(
  __dirname,
  "./fixtures/sample-attachment.pdf",
);
const invalidFixturePath = path.resolve(__dirname, "./fixtures/invalid.txt");
const imageFixturePath = path.resolve(__dirname, "../public/login.png");

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
  const response = await request.post(`${mockServerUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

async function login(page, user) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
}

async function openChat(page, user) {
  await page.getByTestId(`chat-item-${user.id}`).click();
  await expect(page.getByTestId("chat-header-name")).toHaveText(user.name);
}

async function createOversizedPdf(testInfo) {
  const oversizedPdfPath = testInfo.outputPath("oversized-attachment.pdf");
  const oversizedPayload = Buffer.alloc(5 * 1024 * 1024 + 128, "a");

  await fs.writeFile(
    oversizedPdfPath,
    Buffer.concat([Buffer.from("%PDF-1.1\n"), oversizedPayload]),
  );

  return oversizedPdfPath;
}

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

test("uploads and sends a PDF attachment and the receiver sees it in chat", async ({
  page,
  browser,
}) => {
  await login(page, users.alice);
  await openChat(page, users.bob);

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(bobPage, users.bob);
    await openChat(bobPage, users.alice);

    await expect(page.getByTestId("image-attachment-button")).toBeVisible();
    await expect(page.getByTestId("file-attachment-button")).toBeVisible();

    await page.getByTestId("file-attachment-input").setInputFiles(pdfFixturePath);
    await expect(page.getByTestId("pending-attachment")).toContainText(
      "sample-attachment.pdf",
    );

    await page.getByTestId("send-message").click();

    await expect(
      page.getByTestId("message-list").getByText("sample-attachment.pdf"),
    ).toBeVisible();
    await expect(page.getByTestId("message-attachment-file").last()).toBeVisible();
    await expect(page.getByTestId("open-attachment-link").last()).toBeVisible();
    await expect(
      page.getByTestId("download-attachment-link").last(),
    ).toBeVisible();

    await expect(
      bobPage.getByTestId("message-list").getByText("sample-attachment.pdf"),
    ).toBeVisible();
    await expect(
      bobPage.getByTestId("message-attachment-file").last(),
    ).toBeVisible();
    await expect(
      bobPage.getByTestId("open-attachment-link").last(),
    ).toBeVisible();
    await expect(
      bobPage.getByTestId("download-attachment-link").last(),
    ).toBeVisible();
  } finally {
    await bobContext.close();
  }
});

test("uploads and sends an image attachment through the new multipart flow", async ({
  page,
}) => {
  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("image-attachment-input").setInputFiles(imageFixturePath);
  await expect(page.getByTestId("pending-attachment")).toContainText("login.png");

  await page.getByTestId("send-message").click();

  await expect(page.getByTestId("message-attachment-image").last()).toBeVisible();
});

test("rejects an invalid attachment type", async ({ page }) => {
  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("file-attachment-input").setInputFiles(invalidFixturePath);

  await expect(
    page.getByText("Only PDF files are allowed."),
  ).toBeVisible();
  await expect(page.getByTestId("pending-attachment")).toHaveCount(0);
});

test("rejects an oversized attachment", async ({ page }, testInfo) => {
  const oversizedPdfPath = await createOversizedPdf(testInfo);

  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("file-attachment-input").setInputFiles(oversizedPdfPath);

  await expect(
    page.getByText("Attachment must be 5 MB or smaller."),
  ).toBeVisible();
  await expect(page.getByTestId("pending-attachment")).toHaveCount(0);
});

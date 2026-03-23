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
const imageFixturePath = path.resolve(__dirname, "../public/login.png");
const legacyImageDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+F2sonQAAAABJRU5ErkJggg==";

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

const createFilePayload = (name, mimeType, contents) => ({
  name,
  mimeType,
  buffer: Buffer.isBuffer(contents) ? contents : Buffer.from(contents),
});

const createSizedFilePayload = (name, mimeType, sizeInBytes) => ({
  name,
  mimeType,
  buffer: Buffer.alloc(sizeInBytes, "a"),
});

const createPdfPayload = async () => ({
  name: "sample-attachment.pdf",
  mimeType: "application/pdf",
  buffer: await fs.readFile(pdfFixturePath),
});

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

async function dropFiles(page, files) {
  const dataTransfer = await page.evaluateHandle((nextFiles) => {
    const transfer = new DataTransfer();

    nextFiles.forEach((file) => {
      const fileObject = new File(
        [new Uint8Array(file.bytes)],
        file.name,
        { type: file.mimeType },
      );
      transfer.items.add(fileObject);
    });

    return transfer;
  }, files.map((file) => ({
    name: file.name,
    mimeType: file.mimeType,
    bytes: Array.from(file.buffer),
  })));

  await page.getByTestId("message-drop-zone").dispatchEvent("drop", {
    dataTransfer,
  });
}

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

test("sends multiple attachments and the receiver sees them in realtime", async ({
  page,
  browser,
}) => {
  const officeFile = createFilePayload(
    "quarterly-plan.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Quarterly plan",
  );
  const textFile = createFilePayload("release-notes.txt", "text/plain", "Notes");
  const pdfFile = await createPdfPayload();

  await login(page, users.alice);
  await openChat(page, users.bob);

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(bobPage, users.bob);
    await openChat(bobPage, users.alice);

    await page.getByTestId("file-attachment-input").setInputFiles([
      pdfFile,
      officeFile,
      textFile,
    ]);

    await expect(page.getByTestId("pending-attachment-item")).toHaveCount(3);
    await expect(page.getByTestId("pending-attachment-list")).toContainText(
      "quarterly-plan.docx",
    );
    await expect(page.getByTestId("pending-attachment-list")).toContainText(
      "release-notes.txt",
    );

    await page.getByTestId("send-message").click();

    await expect(page.getByTestId("message-attachment-file")).toHaveCount(3);
    await expect(page.getByTestId("message-list")).toContainText("DOCX");
    await expect(page.getByTestId("message-list")).toContainText("TXT");
    await expect(
      page
        .getByTestId("message-attachment-file")
        .filter({ hasText: "sample-attachment.pdf" })
        .getByTestId("open-attachment-link"),
    ).toHaveCount(1);
    await expect(
      page
        .getByTestId("message-attachment-file")
        .filter({ hasText: "sample-attachment.pdf" })
        .getByTestId("download-attachment-link"),
    ).toHaveCount(1);
    await expect(
      page
        .getByTestId("message-attachment-file")
        .filter({ hasText: "quarterly-plan.docx" })
        .getByTestId("open-attachment-link"),
    ).toHaveCount(0);
    await expect(
      page
        .getByTestId("message-attachment-file")
        .filter({ hasText: "quarterly-plan.docx" })
        .getByTestId("download-attachment-link"),
    ).toHaveCount(1);
    await expect(
      page
        .getByTestId("message-attachment-file")
        .filter({ hasText: "release-notes.txt" })
        .getByTestId("open-attachment-link"),
    ).toHaveCount(0);

    await expect(bobPage.getByTestId("message-attachment-file")).toHaveCount(3);
    await expect(bobPage.getByTestId("message-list")).toContainText(
      "quarterly-plan.docx",
    );
    await expect(bobPage.getByTestId("message-list")).toContainText(
      "release-notes.txt",
    );
  } finally {
    await bobContext.close();
  }
});

test("supports sending a mixed image and PDF message", async ({ page }) => {
  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("image-attachment-input").setInputFiles(imageFixturePath);
  await page.getByTestId("file-attachment-input").setInputFiles(pdfFixturePath);

  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(2);

  await page.getByTestId("send-message").click();

  await expect(page.getByTestId("message-attachment-image")).toHaveCount(1);
  await expect(page.getByTestId("message-attachment-file")).toHaveCount(1);
  await expect(page.getByTestId("open-attachment-link")).toHaveCount(1);
  await expect(page.getByTestId("download-attachment-link")).toHaveCount(1);
});

test("rejects unsupported file types", async ({ page }) => {
  const invalidFile = createFilePayload(
    "archive.zip",
    "application/zip",
    "not allowed",
  );

  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("file-attachment-input").setInputFiles(invalidFile);

  await expect(
    page.getByText(
      "Only PDFs, Word, Excel, PowerPoint, and text files are allowed.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(0);
});

test("rejects an oversized image attachment", async ({ page }) => {
  const oversizedImage = createSizedFilePayload(
    "oversized-image.png",
    "image/png",
    8 * 1024 * 1024 + 128,
  );

  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("image-attachment-input").setInputFiles(oversizedImage);

  await expect(
    page.getByText("Image files must be 8 MB or smaller."),
  ).toBeVisible();
  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(0);
});

test("rejects attachments that exceed the total message size limit", async ({
  page,
}) => {
  const largeTextFiles = [
    createSizedFilePayload("part-1.txt", "text/plain", 9 * 1024 * 1024),
    createSizedFilePayload("part-2.txt", "text/plain", 9 * 1024 * 1024),
    createSizedFilePayload("part-3.txt", "text/plain", 9 * 1024 * 1024),
  ];

  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("file-attachment-input").setInputFiles(largeTextFiles);

  await expect(
    page.getByText("Attachments in one message must total 25 MB or less."),
  ).toBeVisible();
  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(0);
});

test("rejects selecting more than five attachments", async ({ page }) => {
  const files = Array.from({ length: 6 }, (_, index) =>
    createFilePayload(
      `note-${index + 1}.txt`,
      "text/plain",
      `File ${index + 1}`,
    ),
  );

  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("file-attachment-input").setInputFiles(files);

  await expect(
    page.getByText("You can attach up to 5 files per message."),
  ).toBeVisible();
  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(0);
});

test("supports drag-and-drop uploads in the composer", async ({ page }) => {
  const droppedFile = createFilePayload("dropped-note.txt", "text/plain", "drop");

  await login(page, users.alice);
  await openChat(page, users.bob);

  await dropFiles(page, [droppedFile]);

  await expect(page.getByTestId("pending-attachment-list")).toContainText(
    "dropped-note.txt",
  );

  await page.getByTestId("send-message").click();

  await expect(page.getByTestId("message-list")).toContainText("dropped-note.txt");
});

test("allows removing a pending attachment before sending", async ({ page }) => {
  const removableFile = createFilePayload("remove-me.txt", "text/plain", "remove");
  const pdfFile = await createPdfPayload();

  await login(page, users.alice);
  await openChat(page, users.bob);

  await page.getByTestId("file-attachment-input").setInputFiles([
    pdfFile,
    removableFile,
  ]);

  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(2);

  await page
    .getByTestId("pending-attachment-item")
    .filter({ hasText: "remove-me.txt" })
    .getByTestId("remove-pending-attachment")
    .click();

  await expect(page.getByTestId("pending-attachment-item")).toHaveCount(1);
  await page.getByTestId("send-message").click();

  await expect(page.getByTestId("message-list")).toContainText(
    "sample-attachment.pdf",
  );
  await expect(page.getByTestId("message-list")).not.toContainText("remove-me.txt");
});

test("legacy image messages still render correctly", async ({ page, request }) => {
  await login(page, users.alice);
  await openChat(page, users.bob);

  const response = await request.post(`${mockServerUrl}/test/push-message`, {
    data: {
      senderId: users.bob.id,
      receiverId: users.alice.id,
      image: legacyImageDataUrl,
    },
  });

  expect(response.ok()).toBeTruthy();
  await expect(page.getByTestId("legacy-image-message")).toBeVisible();
});

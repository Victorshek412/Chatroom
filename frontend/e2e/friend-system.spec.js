import { expect, request as playwrightRequest, test } from "@playwright/test";

const mockServerUrl = "http://localhost:3100";
const password = "password123";

const users = {
  alice: {
    id: "user-alice",
    name: "Alice Tester",
    email: "alice@example.com",
    friendId: "ALC1-1001",
  },
  bob: {
    id: "user-bob",
    name: "Bob Stone",
    email: "bob@example.com",
    friendId: "BOB2-2002",
  },
  cara: {
    id: "user-cara",
    name: "Cara Lane",
    email: "cara@example.com",
    friendId: "CAR3-3003",
  },
};

test.describe.configure({ timeout: 60000 });

async function resetServer(request) {
  const response = await request.post(`${mockServerUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

async function createAuthenticatedApi(user) {
  const api = await playwrightRequest.newContext({ baseURL: mockServerUrl });
  const response = await api.post("/api/auth/login", {
    data: {
      email: user.email,
      password,
    },
  });
  expect(response.ok()).toBeTruthy();
  return api;
}

async function login(page, user) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
}

async function openConversationActions(page) {
  await page.getByTestId("tab-chats").click();
  const firstChat = page.locator('[data-testid^="chat-item-"]').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();
  await expect(page.getByTestId("chat-header-name")).toBeVisible();
}

async function openAddContactModal(page) {
  await openConversationActions(page);
  await page.getByTestId("chat-actions-trigger").click();
  await page.getByTestId("open-add-contact").click();
  await expect(page.getByTestId("friend-modal")).toBeVisible();
}

async function openCreateGroupModal(page) {
  await openConversationActions(page);
  await page.getByTestId("chat-actions-trigger").click();
  await page.getByTestId("open-create-group").click();
  await expect(page.getByRole("dialog", { name: "Create Group" })).toBeVisible();
}

async function openRequestDrawer(page) {
  await openConversationActions(page);
  await page.getByTestId("chat-actions-trigger").click();
  const openRequestsButton = page.getByTestId("open-requests");
  await expect(openRequestsButton).toBeVisible();
  await openRequestsButton.evaluate((button) => button.click());
  await expect(page.getByText("Friend Requests")).toBeVisible();
}

async function expectFocusTrap(page, dialog) {
  const activeElementIsInside = async () =>
    dialog.evaluate(
      (node) => node === document.activeElement || node.contains(document.activeElement),
    );

  await expect.poll(activeElementIsInside).toBe(true);

  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    await expect.poll(activeElementIsInside).toBe(true);
  }
}

async function searchFriendById(page, friendId) {
  await page.getByTestId("friend-id-input").fill(friendId);
  await page.getByTestId("friend-id-search").click();
}

async function createFriendship(sender, receiver) {
  const senderApi = await createAuthenticatedApi(sender);
  const receiverApi = await createAuthenticatedApi(receiver);

  try {
    const requestResponse = await senderApi.post("/api/friends/requests", {
      data: { friendId: receiver.friendId },
    });
    expect(requestResponse.ok()).toBeTruthy();

    const incomingResponse = await receiverApi.get("/api/friends/requests/incoming");
    expect(incomingResponse.ok()).toBeTruthy();

    const incomingData = await incomingResponse.json();
    expect(incomingData.requests).toHaveLength(1);

    const acceptResponse = await receiverApi.post(
      `/api/friends/requests/${incomingData.requests[0]._id}/accept`,
    );
    expect(acceptResponse.ok()).toBeTruthy();
  } finally {
    await Promise.all([senderApi.dispose(), receiverApi.dispose()]);
  }
}

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

test("shows Friend ID, supports sending requests, and keeps friends-only contacts", async ({
  page,
}) => {
  await login(page, users.alice);

  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId("empty-friends-state")).toBeVisible();
  await expect(page.getByTestId(`friend-item-${users.bob.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`friend-item-${users.cara.id}`)).toHaveCount(0);

  await openAddContactModal(page);
  await expect(page.getByTestId("my-friend-id-value")).toHaveText(
    users.alice.friendId,
  );
  await expect(page.getByTestId("copy-friend-id")).toBeVisible();

  await searchFriendById(page, users.bob.friendId);
  await expect(page.getByTestId("friend-search-result")).toContainText(
    users.bob.name,
  );
  await page.getByTestId("send-friend-request").click();
  await expect(page.getByTestId("send-friend-request")).toHaveText(
    "Requested",
  );

  const bobApi = await createAuthenticatedApi(users.bob);

  try {
    const incomingResponse = await bobApi.get("/api/friends/requests/incoming");
    expect(incomingResponse.ok()).toBeTruthy();

    const incomingData = await incomingResponse.json();
    expect(incomingData.requests).toHaveLength(1);
    expect(incomingData.requests[0].user.fullName).toBe(users.alice.name);

    const acceptResponse = await bobApi.post(
      `/api/friends/requests/${incomingData.requests[0]._id}/accept`,
    );
    expect(acceptResponse.ok()).toBeTruthy();
  } finally {
    await bobApi.dispose();
  }

  await page.reload();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId(`friend-item-${users.bob.id}`)).toBeVisible();
});

test("supports accepting friend requests from the redesigned request drawer", async ({
  page,
}) => {
  const bobApi = await createAuthenticatedApi(users.bob);

  try {
    const requestResponse = await bobApi.post("/api/friends/requests", {
      data: { friendId: users.alice.friendId },
    });
    expect(requestResponse.ok()).toBeTruthy();
  } finally {
    await bobApi.dispose();
  }

  await login(page, users.alice);
  await openRequestDrawer(page);
  await expect(page.getByTestId("incoming-requests-list")).toContainText(
    users.bob.name,
  );

  await page.locator('[data-testid^="accept-friend-request-"]').first().click();
  await expect(page.getByText("No pending requests.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Friend Requests")).toHaveCount(0);

  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId(`friend-item-${users.bob.id}`)).toBeVisible();
});

test("supports rejecting friend requests without creating a friendship", async ({
  page,
}) => {
  const caraApi = await createAuthenticatedApi(users.cara);

  try {
    const requestResponse = await caraApi.post("/api/friends/requests", {
      data: { friendId: users.alice.friendId },
    });
    expect(requestResponse.ok()).toBeTruthy();
  } finally {
    await caraApi.dispose();
  }

  await login(page, users.alice);
  await openRequestDrawer(page);
  await expect(page.getByTestId("incoming-requests-list")).toContainText(
    users.cara.name,
  );

  await page.locator('[data-testid^="reject-friend-request-"]').first().click();
  await expect(page.getByText("No pending requests.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Friend Requests")).toHaveCount(0);

  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId("empty-friends-state")).toBeVisible();

  await openAddContactModal(page);
  await searchFriendById(page, users.cara.friendId);
  await expect(page.getByTestId("send-friend-request")).toBeEnabled();
  await expect(page.getByTestId("send-friend-request")).toHaveText("Request");
  await page.getByTestId("close-friend-modal").click();
});

test("lets the user drag the friend requests popup after it opens", async ({
  page,
}) => {
  const bobApi = await createAuthenticatedApi(users.bob);

  try {
    const requestResponse = await bobApi.post("/api/friends/requests", {
      data: { friendId: users.alice.friendId },
    });
    expect(requestResponse.ok()).toBeTruthy();
  } finally {
    await bobApi.dispose();
  }

  await login(page, users.alice);
  await openRequestDrawer(page);

  const panel = page.getByTestId("friend-requests-panel");
  const dragHandle = page.getByTestId("friend-requests-drag-handle");

  const before = await panel.boundingBox();
  const handleBox = await dragHandle.boundingBox();

  expect(before).toBeTruthy();
  expect(handleBox).toBeTruthy();

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 - 120,
    handleBox.y + handleBox.height / 2 + 60,
    { steps: 12 },
  );
  await page.mouse.up();

  const after = await panel.boundingBox();

  expect(after).toBeTruthy();
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(80);
  expect(Math.abs(after.y - before.y)).toBeGreaterThan(30);
});

test("keeps modal accessibility hooks wired for add contact and group flows", async ({
  page,
}) => {
  await createFriendship(users.bob, users.alice);
  await login(page, users.alice);

  await openAddContactModal(page);

  const addContactDialog = page.getByRole("dialog", { name: "Add Contact" });
  await expect(addContactDialog).toHaveAttribute("aria-modal", "true");
  await expect(page.getByRole("button", { name: "Close add contact dialog" })).toBeVisible();
  await expect(page.getByTestId("friend-id-input")).toBeFocused();
  await expectFocusTrap(page, addContactDialog);

  await page.keyboard.press("Escape");
  await expect(addContactDialog).toHaveCount(0);

  await openCreateGroupModal(page);

  const createGroupDialog = page.getByRole("dialog", { name: "Create Group" });
  await expect(createGroupDialog).toHaveAttribute("aria-modal", "true");
  await expect(page.getByRole("button", { name: "Close create group dialog" })).toBeVisible();
  await expect(page.getByPlaceholder("Enter group name")).toBeFocused();
  await expectFocusTrap(page, createGroupDialog);

  await page.keyboard.press("Escape");
  await expect(createGroupDialog).toHaveCount(0);

  await openCreateGroupModal(page);
  await page.getByPlaceholder("Enter group name").fill("Team Launch");
  await page
    .getByRole("dialog", { name: "Create Group" })
    .getByRole("button", { name: /Bob Stone/ })
    .click();
  await page
    .getByRole("dialog", { name: "Create Group" })
    .getByRole("button", { name: "Create group", exact: true })
    .click();

  const createGroupSuccessDialog = page.getByRole("dialog", { name: /Team Launch/ });
  await expect(createGroupSuccessDialog).toHaveAttribute("aria-modal", "true");
  await expect(createGroupSuccessDialog).toBeFocused();
  await expectFocusTrap(page, createGroupSuccessDialog);

  await page.keyboard.press("Escape");
  await expect(createGroupSuccessDialog).toHaveCount(0);

  await openRequestDrawer(page);
  const requestDrawer = page.getByRole("dialog", { name: "Friend Requests" });
  await expect(requestDrawer).toHaveAttribute("aria-modal", "true");
  await expect(page.getByRole("button", { name: "Close friend requests" })).toBeFocused();
  await expectFocusTrap(page, requestDrawer);
  await page.keyboard.press("Escape");
  await expect(requestDrawer).toHaveCount(0);
});

test("supports the inline outgoing request toggle and self request validation", async ({
  page,
}) => {
  await login(page, users.alice);
  await openAddContactModal(page);

  await searchFriendById(page, users.bob.friendId);
  await page.getByTestId("send-friend-request").click();
  await expect(page.getByTestId("send-friend-request")).toHaveText("Requested");
  await expect(page.getByTestId("send-friend-request")).toBeEnabled();

  await page.getByTestId("send-friend-request").click();
  await expect(page.getByTestId("send-friend-request")).toHaveText("Request");

  await searchFriendById(page, users.alice.friendId);
  await expect(
    page.getByText("You cannot send a friend request to yourself."),
  ).toBeVisible();
});

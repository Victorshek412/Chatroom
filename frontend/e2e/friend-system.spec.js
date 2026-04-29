import { expect, request as playwrightRequest, test } from "@playwright/test";
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
  const firstChat = page.locator('[data-testid^="chat-item-user-"]').first();
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
  await page.getByTestId("tab-chats").click();
  await page.getByTestId("chat-actions-trigger").click();
  if (await page.getByTestId("open-create-group").count() === 0) {
    await page.getByTestId("close-chat-action").click();
    await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
    await page.getByTestId("chat-actions-trigger").click();
  }
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

async function createGroupViaApi(owner, { name, memberIds }) {
  const api = await createAuthenticatedApi(owner);

  try {
    const response = await api.post("/api/messages/groups", {
      data: { name, memberIds },
    });
    expect(response.ok()).toBeTruthy();
    return await response.json();
  } finally {
    await api.dispose();
  }
}

async function promoteGroupMemberViaApi(actor, groupId, memberId) {
  const api = await createAuthenticatedApi(actor);

  try {
    const response = await api.post(
      `/api/messages/groups/${groupId}/members/${memberId}/promote`,
      { data: {} },
    );
    expect(response.ok()).toBeTruthy();
    return await response.json();
  } finally {
    await api.dispose();
  }
}

async function openDirectChat(page, user) {
  await page.getByTestId("tab-chats").click();
  await page.getByTestId(`chat-item-${user.id}`).click();
  await expect(page.getByTestId("chat-header-name")).toHaveText(user.name);
}

async function openGroupChat(page, groupName) {
  await page.getByTestId("tab-chats").click();
  const groupRow = page
    .locator('[data-testid^="chat-item-"]')
    .filter({ hasText: groupName })
    .first();

  await expect(groupRow).toBeVisible();
  await groupRow.click();
  await expect(page.getByTestId("chat-header-name")).toHaveText(groupName);
}

async function readMenuLabels(page) {
  const labels = page.getByTestId("chat-actions-menu").locator("button > span:nth-child(2)");
  return (await labels.allTextContents()).map((label) => label.trim());
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

test("shows the incoming request badge before the requests menu is opened", async ({
  browser,
  page,
}) => {
  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(page, users.alice);
    await login(bobPage, users.bob);

    await openConversationActions(bobPage);
    await expect(bobPage.getByTestId("chat-actions-menu")).toHaveCount(0);
    await expect(bobPage.getByTestId("chat-actions-trigger")).not.toContainText("1");

    await openAddContactModal(page);
    await searchFriendById(page, users.bob.friendId);
    await page.getByTestId("send-friend-request").click();

    await expect(bobPage.getByTestId("chat-actions-menu")).toHaveCount(0);
    await expect(bobPage.getByTestId("chat-actions-trigger")).toContainText("1");
  } finally {
    await bobContext.close();
  }
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

test("keeps focus in the search friends input while typing in create group", async ({
  page,
}) => {
  await createFriendship(users.bob, users.alice);
  await login(page, users.alice);
  await openCreateGroupModal(page);

  const groupNameInput = page.getByPlaceholder("Enter group name");
  const searchInput = page.getByPlaceholder("Search friends");

  await searchInput.click();
  await expect(searchInput).toBeFocused();

  await searchInput.pressSequentially("b");

  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveValue("b");
  await expect(groupNameInput).toHaveValue("");
  await expect(
    page
      .getByRole("dialog", { name: "Create Group" })
      .getByRole("button", { name: /Bob Stone/ }),
  ).toBeVisible();
});

test("shows a newly created group to invited members immediately and syncs group messages", async ({
  browser,
  page,
}) => {
  const groupName = "Crew C";
  const groupMessage = "Welcome to Crew C";

  await createFriendship(users.alice, users.bob);

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(page, users.alice);
    await login(bobPage, users.bob);

    await expect(
      bobPage.locator('[data-testid^="chat-item-"]').filter({ hasText: groupName }),
    ).toHaveCount(0);

    await page.getByTestId("chat-actions-trigger").click();
    await page.getByTestId("open-create-group").click();
    await expect(page.getByRole("dialog", { name: "Create Group" })).toBeVisible();

    await page.getByPlaceholder("Enter group name").fill(groupName);
    await page
      .getByRole("dialog", { name: "Create Group" })
      .getByRole("button", { name: /Bob Stone/ })
      .click();
    await page
      .getByRole("dialog", { name: "Create Group" })
      .getByRole("button", { name: "Create group", exact: true })
      .click();

    const bobGroupRow = bobPage
      .locator('[data-testid^="chat-item-"]')
      .filter({ hasText: groupName })
      .first();

    await expect(bobGroupRow).toBeVisible();
    await bobGroupRow.click();
    await expect(bobPage.getByTestId("chat-header-name")).toHaveText(groupName);
    await expect(bobPage.getByTestId("message-input")).toBeVisible();

    await expect(page.getByTestId("chat-header-name")).toHaveText(groupName, {
      timeout: 5000,
    });
    await page.getByTestId("message-input").fill(groupMessage);
    await page.getByTestId("send-message").click();

    await expect(
      bobPage.getByTestId("message-list").getByText(groupMessage),
    ).toBeVisible({ timeout: 10000 });
  } finally {
    await bobContext.close();
  }
});

test("shows the latest message preview and unread badge in the chat list", async ({
  page,
}) => {
  const groupName = "Sidebar Activity";

  await createFriendship(users.alice, users.bob);
  const group = await createGroupViaApi(users.alice, {
    name: groupName,
    memberIds: [users.bob.id],
  });

  await login(page, users.alice);
  await expect(page.getByText("Online", { exact: true }).first()).toBeVisible();

  const bobRow = page.getByTestId(`chat-item-${users.bob.id}`);
  const groupRow = page.getByTestId(`chat-item-${group._id}`);

  await expect(bobRow).toContainText("Bob says hello from t...");
  await expect(groupRow).toContainText("Group created");

  const bobApi = await createAuthenticatedApi(users.bob);

  try {
    const sendResponse = await bobApi.post(`/api/messages/groups/${group._id}/messages`, {
      data: {
        text: "Meeting at 3pm today!",
      },
    });
    expect(sendResponse.ok()).toBeTruthy();
  } finally {
    await bobApi.dispose();
  }

  await expect(groupRow).toContainText("Meeting at 3pm today!");
  await expect(page.getByTestId(`chat-item-${group._id}-unread`)).toHaveText("1");
  await expect(page.locator('[data-testid^="chat-item-"]').first()).toHaveAttribute(
    "data-testid",
    `chat-item-${group._id}`,
  );

  await groupRow.click();
  await expect(page.getByTestId("chat-header-name")).toHaveText(groupName);
  await expect(page.getByTestId(`chat-item-${group._id}-unread`)).toHaveCount(0);
});

test("shows context-sensitive menus for direct chats, empty state, group administrators, and members", async ({
  browser,
  page,
}) => {
  const groupName = "Orbit Team";

  await createFriendship(users.alice, users.bob);
  await createGroupViaApi(users.alice, {
    name: groupName,
    memberIds: [users.bob.id],
  });

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(page, users.alice);
    await login(bobPage, users.bob);

    await openDirectChat(page, users.bob);
    await page.getByTestId("chat-actions-trigger").click();
    expect(await readMenuLabels(page)).toEqual([
      "Add Contact",
      "Requests",
      "Close chat",
    ]);
    await expect(page.getByTestId("open-group-members")).toHaveCount(0);
    await page.getByTestId("close-chat-action").click();

    await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
    await page.getByTestId("chat-actions-trigger").click();
    expect(await readMenuLabels(page)).toEqual([
      "Add Contact",
      "Create Group",
      "Requests",
      "Close chat",
    ]);
    await page.getByTestId("close-chat-action").click();
    await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();

    await openGroupChat(page, groupName);
    await page.getByTestId("chat-actions-trigger").click();
    expect(await readMenuLabels(page)).toEqual([
      "Members",
      "Rename group",
      "Change group avatar",
      "Add members",
      "Leave group",
      "Delete group",
      "Close chat",
    ]);

    await page.getByTestId("open-group-members").click();
    await expect(page.getByTestId("group-members-modal")).toContainText(users.alice.name);
    await expect(page.getByTestId("group-members-modal")).toContainText(users.bob.name);
    await expect(page.getByTestId("group-members-modal")).toContainText("Administrator");
    await expect(page.getByTestId("group-members-modal")).toContainText("Member");
    await expect(page.getByTestId("group-members-modal")).not.toContainText("Owner");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("group-members-modal")).toHaveCount(0);

    await openGroupChat(bobPage, groupName);
    await bobPage.getByTestId("chat-actions-trigger").click();
    expect(await readMenuLabels(bobPage)).toEqual([
      "Members",
      "Leave group",
      "Close chat",
    ]);
    await expect(bobPage.getByTestId("open-rename-group")).toHaveCount(0);
    await expect(bobPage.getByTestId("open-group-avatar")).toHaveCount(0);
    await expect(bobPage.getByTestId("delete-group-action")).toHaveCount(0);
  } finally {
    await bobContext.close();
  }
});

test("lets an administrator rename a group and change its avatar", async ({
  page,
}) => {
  const originalName = "Design Crew";
  const renamedName = "Design Crew HQ";

  await createFriendship(users.alice, users.bob);
  await createGroupViaApi(users.alice, {
    name: originalName,
    memberIds: [users.bob.id],
  });

  await login(page, users.alice);
  await openGroupChat(page, originalName);

  await page.getByTestId("chat-actions-trigger").click();
  await page.getByTestId("open-rename-group").click();
  await expect(page.getByTestId("rename-group-modal")).toBeVisible();
  await page.getByTestId("rename-group-input").fill(renamedName);
  await page.getByTestId("save-group-name").click();

  await expect(page.getByTestId("rename-group-modal")).toHaveCount(0);
  await expect(page.getByTestId("chat-header-name")).toHaveText(renamedName);
  await expect(
    page.locator('[data-testid^="chat-item-"]').filter({ hasText: renamedName }).first(),
  ).toBeVisible();

  await page.getByTestId("chat-actions-trigger").click();
  await page.getByTestId("open-group-avatar").click();
  await expect(page.getByTestId("change-group-avatar-modal")).toBeVisible();
  await page.getByTestId("group-avatar-input").setInputFiles(avatarFixturePath);
  await page.getByTestId("save-group-avatar").click();

  await expect(page.getByTestId("change-group-avatar-modal")).toHaveCount(0);
  await expect(page.locator(`img[alt="${renamedName}"]`).first()).toBeVisible();
  await expect(
    page
      .locator('[data-testid^="chat-item-"]')
      .filter({ hasText: renamedName })
      .first()
      .locator("img"),
  ).toBeVisible();
});

test("lets administrators drag the members modal, promote members, demote administrators, and remove another administrator", async ({
  browser,
  page,
}) => {
  test.slow();
  const groupName = "Admin Controls";

  await createFriendship(users.alice, users.bob);
  await createFriendship(users.alice, users.cara);

  await createGroupViaApi(users.alice, {
    name: groupName,
    memberIds: [users.bob.id],
  });

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(page, users.alice);
    await login(bobPage, users.bob);

    await openGroupChat(page, groupName);
    await page.getByTestId("chat-actions-trigger").click();
    expect(await readMenuLabels(page)).toEqual([
      "Members",
      "Rename group",
      "Change group avatar",
      "Add members",
      "Leave group",
      "Delete group",
      "Close chat",
    ]);
    await page.getByTestId("open-add-group-members").click();
    await expect(page.getByTestId("add-group-members-modal")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Search friends to add" }),
    ).toBeVisible();
    await page.getByTestId(`addable-group-friend-${users.cara.id}`).click();
    await page.getByTestId("add-group-members-submit").click();
    await expect(page.getByTestId("add-group-members-modal")).toHaveCount(0);

    await page.getByTestId("chat-actions-trigger").click();
    await page.getByTestId("open-group-members").click();
    await expect(page.getByTestId("group-members-modal")).toContainText("Administrator");
    await expect(page.getByTestId("group-members-modal")).toContainText(users.cara.name);

    const membersModal = page.getByTestId("group-members-modal");
    const dragHandle = page.getByTestId("group-members-drag-handle");
    const before = await membersModal.boundingBox();
    const handleBox = await dragHandle.boundingBox();

    expect(before).toBeTruthy();
    expect(handleBox).toBeTruthy();
    expect(before.width).toBeGreaterThan(450);
    expect(before.width).toBeLessThan(500);

    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2 - 90,
      handleBox.y + handleBox.height / 2 + 40,
      { steps: 10 },
    );
    await page.mouse.up();

    const after = await membersModal.boundingBox();
    expect(after).toBeTruthy();
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(50);
    expect(Math.abs(after.y - before.y)).toBeGreaterThan(20);

    await expect(page.locator('[data-testid^="group-member-actions-"]')).toHaveCount(0);
    await expect(page.getByTestId(`group-member-role-trigger-${users.alice.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`group-member-role-display-${users.alice.id}`)).toBeVisible();
    await page.getByTestId(`group-member-role-trigger-${users.bob.id}`).click();
    await expect(page.getByTestId(`promote-group-member-${users.bob.id}`)).toBeVisible();
    await expect(page.getByTestId(`remove-group-member-${users.bob.id}`)).toBeVisible();
    await page.getByTestId(`promote-group-member-${users.bob.id}`).click();
    await expect(page.getByTestId("group-members-modal")).toContainText(users.bob.name);
    await expect(page.getByTestId("group-members-modal")).toContainText("Administrator");

    await page.getByTestId(`group-member-role-trigger-${users.bob.id}`).click();
    await expect(page.getByTestId(`promote-group-member-${users.bob.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`demote-group-member-${users.bob.id}`)).toBeVisible();
    await expect(page.getByTestId(`remove-group-member-${users.bob.id}`)).toBeVisible();
    await page.getByTestId(`group-member-role-trigger-${users.bob.id}`).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("group-members-modal")).toHaveCount(0);

    await openGroupChat(bobPage, groupName);
    await bobPage.getByTestId("chat-actions-trigger").click();
    expect(await readMenuLabels(bobPage)).toEqual([
      "Members",
      "Rename group",
      "Change group avatar",
      "Add members",
      "Leave group",
      "Delete group",
      "Close chat",
    ]);
    await bobPage.keyboard.press("Escape");

    await page.getByTestId("chat-actions-trigger").click();
    await page.getByTestId("open-group-members").click();
    await expect(page.getByTestId("group-members-modal")).toBeVisible();
    await page.getByTestId(`group-member-role-trigger-${users.bob.id}`).click();
    await expect(page.getByTestId(`demote-group-member-${users.bob.id}`)).toBeVisible();
    await expect(page.getByTestId(`remove-group-member-${users.bob.id}`)).toBeVisible();
    await page.getByTestId(`demote-group-member-${users.bob.id}`).click();

    await bobPage.getByTestId("chat-actions-trigger").click();
    await expect.poll(async () => readMenuLabels(bobPage)).toEqual([
      "Members",
      "Leave group",
      "Close chat",
    ]);
    await bobPage.keyboard.press("Escape");

    await page.getByTestId(`group-member-role-trigger-${users.bob.id}`).click();
    await expect(page.getByTestId(`promote-group-member-${users.bob.id}`)).toBeVisible();
    await page.getByTestId(`promote-group-member-${users.bob.id}`).click();

    await bobPage.getByTestId("chat-actions-trigger").click();
    await expect.poll(async () => readMenuLabels(bobPage)).toEqual([
      "Members",
      "Rename group",
      "Change group avatar",
      "Add members",
      "Leave group",
      "Delete group",
      "Close chat",
    ]);
    await bobPage.keyboard.press("Escape");

    await bobPage.getByTestId("chat-actions-trigger").click();
    await bobPage.getByTestId("open-group-members").click();
    await bobPage.getByTestId(`group-member-role-trigger-${users.alice.id}`).click();
    await expect(bobPage.getByTestId(`demote-group-member-${users.alice.id}`)).toBeVisible();
    await bobPage.getByTestId(`remove-group-member-${users.alice.id}`).click();
    await bobPage.getByTestId("confirm-remove-group-member").click();

    await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
    await expect(
      page.locator('[data-testid^="chat-item-"]').filter({ hasText: groupName }),
    ).toHaveCount(0);
    await expect(
      bobPage.getByTestId("group-members-modal"),
    ).not.toContainText(users.alice.name);
  } finally {
    await bobContext.close();
  }
});

test("supports leaving groups and lets non-primary administrators delete groups", async ({
  browser,
  page,
}) => {
  test.slow();
  const leaveGroupName = "Leave Path";
  const deleteGroupName = "Delete Path";

  await createFriendship(users.alice, users.bob);

  await createGroupViaApi(users.alice, {
    name: leaveGroupName,
    memberIds: [users.bob.id],
  });
  const deleteGroup = await createGroupViaApi(users.alice, {
    name: deleteGroupName,
    memberIds: [users.bob.id],
  });
  await promoteGroupMemberViaApi(users.alice, deleteGroup._id, users.bob.id);

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(page, users.alice);
    await login(bobPage, users.bob);

    await openGroupChat(bobPage, leaveGroupName);
    await bobPage.getByTestId("chat-actions-trigger").click();
    await bobPage.getByTestId("leave-group-action").click();
    await bobPage.getByTestId("confirm-leave-group").click();
    await expect(bobPage.getByTestId("no-conversation-placeholder")).toBeVisible();
    await expect(
      bobPage.locator('[data-testid^="chat-item-"]').filter({ hasText: leaveGroupName }),
    ).toHaveCount(0);

    await openGroupChat(page, deleteGroupName);
    await openGroupChat(bobPage, deleteGroupName);
    await bobPage.getByTestId("chat-actions-trigger").click();
    await bobPage.getByTestId("delete-group-action").click();
    await bobPage.getByTestId("confirm-delete-group").click();
    await expect(bobPage.getByTestId("no-conversation-placeholder")).toBeVisible();
    await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
    await expect(
      page.locator('[data-testid^="chat-item-"]').filter({ hasText: deleteGroupName }),
    ).toHaveCount(0);
    await expect(
      bobPage.locator('[data-testid^="chat-item-"]').filter({ hasText: deleteGroupName }),
    ).toHaveCount(0);
  } finally {
    await bobContext.close();
  }
});

test("transfers administration deterministically and auto-deletes when the last administrator leaves", async ({
  page,
}) => {
  test.slow();
  const transferGroupName = "Transfer Path";

  await createFriendship(users.alice, users.bob);
  await createFriendship(users.alice, users.cara);

  const transferGroup = await createGroupViaApi(users.alice, {
    name: transferGroupName,
    memberIds: [users.bob.id, users.cara.id],
  });

  const aliceApi = await createAuthenticatedApi(users.alice);

  try {
    const leaveResponse = await aliceApi.post(`/api/messages/groups/${transferGroup._id}/leave`);
    expect(leaveResponse.ok()).toBeTruthy();
  } finally {
    await aliceApi.dispose();
  }

  await login(page, users.bob);
  await openGroupChat(page, transferGroupName);
  await page.getByTestId("chat-actions-trigger").click();
  expect(await readMenuLabels(page)).toEqual([
    "Members",
    "Rename group",
    "Change group avatar",
    "Add members",
    "Leave group",
    "Delete group",
    "Close chat",
  ]);
  await page.keyboard.press("Escape");

  const caraApi = await createAuthenticatedApi(users.cara);

  try {
    const leaveResponse = await caraApi.post(`/api/messages/groups/${transferGroup._id}/leave`);
    expect(leaveResponse.ok()).toBeTruthy();
  } finally {
    await caraApi.dispose();
  }

  const bobApi = await createAuthenticatedApi(users.bob);

  try {
    const leaveResponse = await bobApi.post(`/api/messages/groups/${transferGroup._id}/leave`);
    expect(leaveResponse.ok()).toBeTruthy();
  } finally {
    await bobApi.dispose();
  }

  await expect(page.getByTestId("no-conversation-placeholder")).toBeVisible();
  await expect(
    page.locator('[data-testid^="chat-item-"]').filter({ hasText: transferGroupName }),
  ).toHaveCount(0);
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

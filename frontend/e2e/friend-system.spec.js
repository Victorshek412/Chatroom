import { expect, test } from "@playwright/test";

const mockServerUrl = "http://localhost:3100";
const frontendUrl = "http://localhost:4173";
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

async function openFriendModal(page) {
  await page.getByTestId("friend-modal-trigger").click();
  await expect(page.getByTestId("friend-modal")).toBeVisible();
}

async function searchFriendById(page, friendId) {
  await page.getByTestId("friend-id-input").fill(friendId);
  await page.getByTestId("friend-id-search").click();
}

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

test("shows Friend ID, supports sending and accepting requests, and keeps friends-only contacts", async ({
  page,
  browser,
}) => {
  await login(page, users.alice);

  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId("empty-friends-state")).toBeVisible();
  await expect(page.getByTestId(`friend-item-${users.bob.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`friend-item-${users.cara.id}`)).toHaveCount(0);

  await openFriendModal(page);
  await expect(page.getByTestId("my-friend-id-value")).toHaveText(
    users.alice.friendId,
  );
  await expect(page.getByTestId("copy-friend-id")).toBeVisible();

  await searchFriendById(page, users.bob.friendId);
  await expect(page.getByTestId("friend-search-result")).toContainText(
    users.bob.name,
  );
  await page.getByTestId("send-friend-request").click();
  await expect(page.getByTestId("outgoing-requests-list")).toContainText(
    users.bob.name,
  );

  const bobContext = await browser.newContext({ baseURL: frontendUrl });
  const bobPage = await bobContext.newPage();

  try {
    await login(bobPage, users.bob);
    await openFriendModal(bobPage);
    await expect(bobPage.getByTestId("incoming-requests-list")).toContainText(
      users.alice.name,
    );

    await bobPage.locator('[data-testid^="accept-friend-request-"]').first().click();
    await expect(bobPage.getByTestId("incoming-requests-list")).not.toContainText(
      users.alice.name,
    );

    await bobPage.getByTestId("close-friend-modal").click();
    await bobPage.getByTestId("tab-friends").click();
    await expect(bobPage.getByTestId(`friend-item-${users.alice.id}`)).toBeVisible();
  } finally {
    await bobContext.close();
  }

  await page.getByTestId("close-friend-modal").click();
  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId(`friend-item-${users.bob.id}`)).toBeVisible();
});

test("supports rejecting friend requests without creating a friendship", async ({
  page,
  browser,
}) => {
  await login(page, users.alice);
  await openFriendModal(page);
  await searchFriendById(page, users.cara.friendId);
  await page.getByTestId("send-friend-request").click();
  await expect(page.getByTestId("outgoing-requests-list")).toContainText(
    users.cara.name,
  );

  const caraContext = await browser.newContext({ baseURL: frontendUrl });
  const caraPage = await caraContext.newPage();

  try {
    await login(caraPage, users.cara);
    await openFriendModal(caraPage);
    await expect(caraPage.getByTestId("incoming-requests-list")).toContainText(
      users.alice.name,
    );

    const rejectButtonTestId = await caraPage
      .locator('[data-testid^="reject-friend-request-"]')
      .first()
      .getAttribute("data-testid");
    const requestId = rejectButtonTestId?.replace("reject-friend-request-", "");

    expect(requestId).toBeTruthy();

    const rejectResult = await caraPage.evaluate(
      async ({ baseUrl, currentRequestId }) => {
        const response = await fetch(
          `${baseUrl}/api/friends/requests/${currentRequestId}/reject`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        return {
          ok: response.ok,
          body: await response.json(),
        };
      },
      {
        baseUrl: mockServerUrl,
        currentRequestId: requestId,
      },
    );

    expect(rejectResult.ok).toBeTruthy();
  } finally {
    await caraContext.close();
  }

  await page.reload();
  await expect(page.getByTestId("profile-avatar-button")).toBeVisible();
  await openFriendModal(page);
  await searchFriendById(page, users.cara.friendId);
  await expect(page.getByTestId("send-friend-request")).toBeEnabled();
  await expect(page.getByTestId("send-friend-request")).toHaveText(
    "Send friend request",
  );
  await page.getByTestId("close-friend-modal").click();
  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId("empty-friends-state")).toBeVisible();
});

test("prevents duplicate requests and self requests", async ({ page }) => {
  await login(page, users.alice);
  await openFriendModal(page);

  await searchFriendById(page, users.bob.friendId);
  await page.getByTestId("send-friend-request").click();

  await page.getByTestId("friend-id-input").fill(users.bob.friendId);
  await page.getByTestId("friend-id-search").click();
  await expect(page.getByTestId("send-friend-request")).toBeDisabled();
  await expect(page.getByTestId("send-friend-request")).toHaveText(
    "Request pending",
  );

  await searchFriendById(page, users.alice.friendId);
  await expect(
    page.getByText("You cannot send a friend request to yourself."),
  ).toBeVisible();
});

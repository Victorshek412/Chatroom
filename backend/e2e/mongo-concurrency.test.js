import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { ENV } from "../src/lib/env.js";
import FriendRequest, { FRIEND_REQUEST_STATUS } from "../src/models/FriendRequest.js";
import User from "../src/models/User.js";

const buildIsolatedMongoUri = (baseUri, databaseName) => {
  const uri = new URL(baseUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
};

const buildRelationshipKey = (firstUserId, secondUserId) =>
  [firstUserId, secondUserId]
    .map((value) => value.toString())
    .sort()
    .join(":");

const createTestUser = async (label) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  return User.create({
    fullName: `${label} ${suffix}`,
    email: `${label.toLowerCase()}-${suffix}@example.test`,
    password: "password123",
  });
};

const TEST_DATABASE_NAME = `ctc_${Date.now().toString(36)}_${process.pid.toString(36)}`;

test.before(async () => {
  assert.ok(ENV.MONGODB_URI, "MONGODB_URI must be configured to run this test.");
  const testMongoUri = buildIsolatedMongoUri(
    ENV.MONGODB_URI,
    TEST_DATABASE_NAME,
  );

  console.log(`[mongo-concurrency] Connecting to isolated test database: ${TEST_DATABASE_NAME}`);
  await mongoose.connect(testMongoUri, {
    serverSelectionTimeoutMS: 30000,
  });
  console.log("[mongo-concurrency] Connected. Preparing indexes.");
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), FriendRequest.init()]);
  console.log("[mongo-concurrency] Database ready.");
});

test.beforeEach(async () => {
  await Promise.all([FriendRequest.deleteMany({}), User.deleteMany({})]);
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    console.log("[mongo-concurrency] Cleaning up isolated test database.");
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("[mongo-concurrency] Cleanup complete.");
  }
});

test("concurrent opposite-direction requests leave only one active relationship", async () => {
  console.log("[mongo-concurrency] Running active-relationship uniqueness test.");
  const [alice, bob] = await Promise.all([
    createTestUser("Alice"),
    createTestUser("Bob"),
  ]);

  const createResults = await Promise.allSettled([
    FriendRequest.create({
      senderId: alice._id,
      receiverId: bob._id,
    }),
    FriendRequest.create({
      senderId: bob._id,
      receiverId: alice._id,
    }),
  ]);

  const successfulCreates = createResults.filter(
    (result) => result.status === "fulfilled",
  );
  const failedCreates = createResults.filter(
    (result) => result.status === "rejected",
  );

  assert.equal(
    successfulCreates.length,
    1,
    "Exactly one active request should be created.",
  );
  assert.equal(
    failedCreates.length,
    1,
    "The duplicate active request should be rejected.",
  );
  assert.equal(
    failedCreates[0].reason?.code,
    11000,
    "The rejected create should fail on the unique relationship index.",
  );

  const activeRelationshipCount = await FriendRequest.countDocuments({
    relationshipKey: buildRelationshipKey(alice._id, bob._id),
    status: {
      $in: [FRIEND_REQUEST_STATUS.PENDING, FRIEND_REQUEST_STATUS.ACCEPTED],
    },
  });

  assert.equal(
    activeRelationshipCount,
    1,
    "Only one pending/accepted relationship should exist for the pair.",
  );
  console.log("[mongo-concurrency] Active-relationship uniqueness test passed.");
});

test("concurrent request transitions allow only one winner", async () => {
  console.log("[mongo-concurrency] Running transition atomicity test.");
  const [alice, bob] = await Promise.all([
    createTestUser("Alice"),
    createTestUser("Bob"),
  ]);

  const pendingRequest = await FriendRequest.create({
    senderId: alice._id,
    receiverId: bob._id,
  });

  const [acceptedRequest, rejectedRequest] = await Promise.all([
    FriendRequest.findOneAndUpdate(
      {
        _id: pendingRequest._id,
        receiverId: bob._id,
        status: FRIEND_REQUEST_STATUS.PENDING,
      },
      {
        $set: { status: FRIEND_REQUEST_STATUS.ACCEPTED },
      },
      { new: true },
    ),
    FriendRequest.findOneAndUpdate(
      {
        _id: pendingRequest._id,
        receiverId: bob._id,
        status: FRIEND_REQUEST_STATUS.PENDING,
      },
      {
        $set: { status: FRIEND_REQUEST_STATUS.REJECTED },
      },
      { new: true },
    ),
  ]);

  const winners = [acceptedRequest, rejectedRequest].filter(Boolean);

  assert.equal(
    winners.length,
    1,
    "Only one transition should match the pending request.",
  );

  const refreshedRequest = await FriendRequest.findById(pendingRequest._id).lean();

  assert.ok(
    refreshedRequest,
    "The pending request should still exist after the concurrent transition attempt.",
  );
  assert.equal(
    refreshedRequest.status,
    winners[0].status,
    "The stored status should match the single successful transition.",
  );
  assert.ok(
    [FRIEND_REQUEST_STATUS.ACCEPTED, FRIEND_REQUEST_STATUS.REJECTED].includes(
      refreshedRequest.status,
    ),
    "The request should end in exactly one terminal state.",
  );
  console.log("[mongo-concurrency] Transition atomicity test passed.");
});

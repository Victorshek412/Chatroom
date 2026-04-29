import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import http from "http";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { Server } from "socket.io";
import {
  buildCloudinaryAttachmentMetadata,
  getAttachmentValidationError,
  isAllowedAttachmentMimeType,
  MAX_MESSAGE_ATTACHMENT_SIZE,
  MESSAGE_ATTACHMENT_FILE_FIELD,
  normalizeAttachmentMetadata,
} from "../src/lib/messageAttachments.js";

const PORT = Number(process.env.E2E_BACKEND_PORT || 3100);
const FRONTEND_ORIGIN =
  process.env.E2E_FRONTEND_ORIGIN || "http://localhost:4173";
const SERVER_ORIGIN = `http://localhost:${PORT}`;
const SESSION_COOKIE = "mock_session";
const FRIEND_REQUEST_EVENT = "friendRequestEvent";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});

const baseUsers = [
  {
    _id: "user-alice",
    fullName: "Alice Tester",
    email: "alice@example.com",
    password: "password123",
    profilePicture: null,
    friendId: "ALC1-1001",
  },
  {
    _id: "user-bob",
    fullName: "Bob Stone",
    email: "bob@example.com",
    password: "password123",
    profilePicture: null,
    friendId: "BOB2-2002",
  },
  {
    _id: "user-cara",
    fullName: "Cara Lane",
    email: "cara@example.com",
    password: "password123",
    profilePicture: null,
    friendId: "CAR3-3003",
  },
];

const defaultMessageDelays = {
  "user-alice:user-bob": 450,
  "user-alice:user-cara": 25,
};

let users = [];
let messages = [];
let groups = [];
let friendRequests = [];
let sessions = new Map();
let userSockets = new Map();
let messageCounter = 0;
let groupCounter = 0;
let friendRequestCounter = 0;
let attachmentCounter = 0;
let messageDelays = { ...defaultMessageDelays };
let uploadedFiles = new Map();
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MESSAGE_ATTACHMENT_SIZE,
  },
});

const serializeUser = ({ password, ...user }) => ({ ...user });

const serializeFriendUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  profilePicture: user.profilePicture,
  friendId: user.friendId,
});

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value ?? {}, key);

const toComparableId = (value) => value?.toString?.() ?? String(value ?? "");

const getGroupOwnerId = (group) =>
  toComparableId(group?.ownerId ?? group?.createdBy);

const getGroupAdminIds = (group) =>
  (Array.isArray(group?.adminIds) ? group.adminIds : [])
    .map((adminId) => toComparableId(adminId))
    .filter(Boolean);

const isGroupAdmin = (group, userId) => {
  const comparableUserId = toComparableId(userId);
  return (
    comparableUserId === getGroupOwnerId(group) ||
    getGroupAdminIds(group).includes(comparableUserId)
  );
};

const normalizeGroupAdminIds = (memberIds, adminIds, ownerId = null) => {
  const comparableOwnerId = toComparableId(ownerId);
  const memberIdSet = new Set(memberIds.map(toComparableId));

  return Array.from(
    new Set(adminIds.map(toComparableId).filter(Boolean)),
  ).filter(
    (adminId) =>
      memberIdSet.has(adminId) && adminId !== comparableOwnerId,
  );
};

const resolveGroupLeadership = ({ memberIds, ownerId, adminIds }) => {
  const nextMemberIds = Array.from(
    new Set(memberIds.map(toComparableId).filter(Boolean)),
  );

  if (nextMemberIds.length === 0) {
    return {
      shouldDelete: true,
      ownerId: null,
      adminIds: [],
    };
  }

  const comparableOwnerId = toComparableId(ownerId);
  const normalizedAdminIds = normalizeGroupAdminIds(
    nextMemberIds,
    adminIds,
    comparableOwnerId,
  );

  if (comparableOwnerId && nextMemberIds.includes(comparableOwnerId)) {
    return {
      shouldDelete: false,
      ownerId: comparableOwnerId,
      adminIds: normalizedAdminIds,
    };
  }

  const nextOwnerId =
    nextMemberIds.find((memberId) => normalizedAdminIds.includes(memberId)) ||
    nextMemberIds[0];

  return {
    shouldDelete: false,
    ownerId: nextOwnerId,
    adminIds: normalizeGroupAdminIds(nextMemberIds, normalizedAdminIds, nextOwnerId),
  };
};

const applyGroupMembershipState = (group, memberIds, adminIds, ownerId) => {
  const resolvedLeadership = resolveGroupLeadership({
    memberIds,
    adminIds,
    ownerId,
  });

  if (resolvedLeadership.shouldDelete) {
    return resolvedLeadership;
  }

  group.memberIds = memberIds;
  group.ownerId = resolvedLeadership.ownerId;
  group.adminIds = resolvedLeadership.adminIds;

  return resolvedLeadership;
};

const getGroupRole = (group, memberId) => {
  const comparableMemberId = toComparableId(memberId);

  if (isGroupAdmin(group, comparableMemberId)) {
    return "admin";
  }

  return "member";
};

const serializeGroupForUser = (group, _currentUserId, latestMessage = null) => ({
  _id: group._id,
  kind: "group",
  name: group.name,
  avatarUrl: group.avatarUrl || "",
  ownerId: getGroupOwnerId(group),
  adminIds: getGroupAdminIds(group),
  members: group.memberIds
    .map(getUserById)
    .filter(Boolean)
    .map((member) => ({
      ...serializeFriendUser(member),
      role: getGroupRole(group, member._id),
    })),
  memberCount: group.memberIds.length,
  createdAt: group.createdAt,
  latestMessage,
});

const parseCookies = (cookieHeader = "") =>
  Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        const key =
          separatorIndex === -1 ? entry : entry.slice(0, separatorIndex);
        const value =
          separatorIndex === -1 ? "" : entry.slice(separatorIndex + 1);
        return [key, decodeURIComponent(value)];
      }),
  );

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getUserById = (userId) => users.find((user) => user._id === userId);

const getUserByFriendId = (friendId) =>
  users.find(
    (user) => user.friendId === String(friendId || "").trim().toUpperCase(),
  );

const getConversationKey = (firstUserId, secondUserId) =>
  `${firstUserId}:${secondUserId}`;

const getTrimmedText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getBase64MimeType = (value = "") => {
  const match = value.match(/^data:(.+?);base64,/);
  return match ? match[1] : "";
};

const normalizeAttachmentsPayload = (attachments) => {
  if (attachments == null) {
    return { attachments: [] };
  }

  if (!Array.isArray(attachments)) {
    return { error: "Attachments must be an array." };
  }

  if (attachments.length > 1) {
    return { error: "Only one attachment is allowed per message." };
  }

  const normalizedAttachments = attachments.map(normalizeAttachmentMetadata);
  const validationError = normalizedAttachments
    .map(getAttachmentValidationError)
    .find(Boolean);

  if (validationError) {
    return { error: validationError };
  }

  return { attachments: normalizedAttachments };
};

const handleSingleAttachmentUpload = (req, res, next) => {
  attachmentUpload.single(MESSAGE_ATTACHMENT_FILE_FIELD)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "Attachment must be 5 MB or smaller." });
    }

    return res
      .status(400)
      .json({ message: error.message || "Attachment upload failed." });
  });
};

const getPartnerIds = (userId) =>
  Array.from(
    new Set(
      messages.flatMap((message) => {
        if (!message.receiverId) {
          return [];
        }
        if (message.senderId === userId) {
          return [message.receiverId];
        }
        if (message.receiverId === userId) {
          return [message.senderId];
        }
        return [];
      }),
    ),
  );

const getLatestMessageForPartner = (userId, partnerId) =>
  [...messages]
    .reverse()
    .find(
      (message) =>
        (message.senderId === userId && message.receiverId === partnerId) ||
        (message.senderId === partnerId && message.receiverId === userId),
      ) || null;

const getGroupById = (groupId) => groups.find((group) => group._id === groupId);

const getLatestMessageForGroup = (groupId) =>
  [...messages].reverse().find((message) => message.groupId === groupId) || null;

const getAcceptedFriends = (userId) => {
  const acceptedFriends = friendRequests
    .filter(
      (friendRequest) =>
        friendRequest.status === "accepted" &&
        (friendRequest.senderId === userId || friendRequest.receiverId === userId),
    )
    .map((friendRequest) =>
      friendRequest.senderId === userId
        ? getUserById(friendRequest.receiverId)
        : getUserById(friendRequest.senderId),
    )
    .filter(Boolean);

  return Array.from(
    new Map(
      acceptedFriends.map((friend) => [friend._id, serializeFriendUser(friend)]),
    ).values(),
  );
};

const getRelevantRelationship = (firstUserId, secondUserId) =>
  [...friendRequests]
    .reverse()
    .find(
      (friendRequest) =>
        ["pending", "accepted"].includes(friendRequest.status) &&
        ((friendRequest.senderId === firstUserId &&
          friendRequest.receiverId === secondUserId) ||
          (friendRequest.senderId === secondUserId &&
            friendRequest.receiverId === firstUserId)),
    );

const createFriendRequest = ({
  senderId,
  receiverId,
  status = "pending",
}) => {
  friendRequestCounter += 1;
  const timestamp = new Date(
    Date.UTC(2026, 2, 23, 10, Math.min(friendRequestCounter, 59), 0),
  ).toISOString();

  return {
    _id: `friend-request-${friendRequestCounter}`,
    senderId,
    receiverId,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const serializeFriendRequest = (friendRequest, counterpartField) => {
  const counterpartId =
    counterpartField === "senderId"
      ? friendRequest.senderId
      : friendRequest.receiverId;
  const counterpartUser = getUserById(counterpartId);

  return {
    _id: friendRequest._id,
    status: friendRequest.status,
    createdAt: friendRequest.createdAt,
    updatedAt: friendRequest.updatedAt,
    user: counterpartUser ? serializeFriendUser(counterpartUser) : null,
  };
};

const emitOnlineUsers = () => {
  const onlineUsers = Array.from(userSockets.entries())
    .filter(([, socketIds]) => socketIds.size > 0)
    .map(([userId]) => userId);

  io.emit("getOnlineUsers", onlineUsers);
};

const createMessage = ({
  senderId,
  receiverId = null,
  groupId = null,
  text = "",
  image = null,
  attachments = [],
}) => {
  messageCounter += 1;
  const nextAttachments = Array.isArray(attachments)
    ? attachments.slice(0, 1)
    : [];

  return {
    _id: `message-${messageCounter}`,
    senderId,
    receiverId,
    groupId,
    text,
    image,
    ...(nextAttachments.length > 0 ? { attachments: nextAttachments } : {}),
    createdAt: new Date(
      Date.UTC(2026, 2, 23, 9, 0, Math.min(messageCounter, 59)),
    ).toISOString(),
  };
};

const createUploadedAttachment = (file) => {
  attachmentCounter += 1;

  const storageKey = `attachment-${attachmentCounter}`;
  uploadedFiles.set(storageKey, {
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  const originalNameParts = file.originalname.split(".");
  const extension =
    originalNameParts.length > 1 ? originalNameParts.pop() : "bin";
  const originalFilename =
    originalNameParts.join(".") || `shared-attachment-${attachmentCounter}`;

  return buildCloudinaryAttachmentMetadata(
    {
      secure_url: `${SERVER_ORIGIN}/test/uploads/${storageKey}/${encodeURIComponent(file.originalname)}`,
      original_filename: originalFilename,
        public_id: `whisper/message-attachments/${storageKey}`,
      bytes: file.size,
      format: extension,
      resource_type: file.mimetype.startsWith("image/") ? "image" : "raw",
    },
    file,
  );
};

const createGroup = ({ name, createdBy, memberIds }) => {
  groupCounter += 1;
  const timestamp = new Date(
    Date.UTC(2026, 2, 23, 11, Math.min(groupCounter, 59), 0),
  ).toISOString();

  return {
    _id: `group-${groupCounter}`,
    name,
    avatarUrl: "",
    createdBy,
    ownerId: createdBy,
    adminIds: [],
    memberIds: Array.from(new Set(memberIds)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const buildMessageContent = ({ text = "", image = null, attachments }) => {
  const trimmedText = getTrimmedText(text);
  const legacyImagePayload = typeof image === "string" ? image.trim() : "";
  const {
    attachments: normalizedAttachments,
    error: attachmentsError,
  } = normalizeAttachmentsPayload(attachments);

  if (attachmentsError) {
    return { error: attachmentsError };
  }

  if (legacyImagePayload && normalizedAttachments.length > 0) {
    return { error: "Only one attachment is allowed per message." };
  }

  if (!trimmedText && !legacyImagePayload && normalizedAttachments.length === 0) {
    return { error: "Text, image, or attachment is required." };
  }

  let imageUrl = null;
  let attachmentsToSave = normalizedAttachments;

  if (legacyImagePayload) {
    const legacyMimeType = getBase64MimeType(legacyImagePayload) || "image/png";
    imageUrl = legacyImagePayload;
    attachmentsToSave = [
      normalizeAttachmentMetadata({
        url: legacyImagePayload,
        originalName: "shared-image.png",
        mimeType: legacyMimeType,
        size: legacyImagePayload.length,
        kind: "image",
        provider: "cloudinary",
        storageKey: "legacy-image",
      }),
    ];
  } else if (attachmentsToSave[0]?.kind === "image") {
    imageUrl = attachmentsToSave[0].url;
  }

  return {
    text: trimmedText,
    image: imageUrl,
    attachments: attachmentsToSave,
  };
};

const emitToUserSockets = (userId, eventName, payload, skipSocketId = null) => {
  userSockets.get(userId)?.forEach((socketId) => {
    if (socketId !== skipSocketId) {
      io.to(socketId).emit(eventName, payload);
    }
  });
};

const emitFriendRequestEvent = (userId, payload, skipSocketId = null) => {
  emitToUserSockets(userId, FRIEND_REQUEST_EVENT, payload, skipSocketId);
};

const emitGroupCreated = (group, skipSocketId = null) => {
  group.memberIds.forEach((memberId) => {
    emitToUserSockets(
      memberId,
      "groupCreated",
      serializeGroupForUser(group, memberId, getLatestMessageForGroup(group._id)),
      skipSocketId,
    );
  });
};

const emitGroupUpdated = (group, latestMessage = null, skipSocketId = null) => {
  group.memberIds.forEach((memberId) => {
    emitToUserSockets(
      memberId,
      "groupUpdated",
      serializeGroupForUser(group, memberId, latestMessage),
      skipSocketId,
    );
  });
};

const emitGroupRemoved = (memberIds, groupId, skipSocketId = null) => {
  memberIds.forEach((memberId) => {
    emitToUserSockets(
      memberId,
      "groupRemoved",
      { groupId: toComparableId(groupId) },
      skipSocketId,
    );
  });
};

const emitGroupMessage = (group, message, skipSocketId = null) => {
  group.memberIds.forEach((memberId) => {
    emitToUserSockets(
      memberId,
      "groupMessage",
      {
        group: serializeGroupForUser(group, memberId, message),
        message,
      },
      skipSocketId,
    );
  });
};

const persistAndBroadcastMessage = (
  payload,
  { skipSocketId = null } = {},
) => {
  const nextMessage = createMessage(payload);
  messages.push(nextMessage);

  const targetUserIds = [payload.receiverId, payload.senderId];
  targetUserIds.forEach((userId) => {
    userSockets.get(userId)?.forEach((socketId) => {
      if (socketId !== skipSocketId) {
        io.to(socketId).emit("newMessage", nextMessage);
      }
    });
  });

  return nextMessage;
};

const persistAndBroadcastGroupMessage = (
  group,
  payload,
  { skipSocketId = null } = {},
) => {
  const nextMessage = createMessage({
    ...payload,
    groupId: group._id,
  });
  messages.push(nextMessage);
  group.updatedAt = nextMessage.createdAt;
  emitGroupMessage(group, nextMessage, skipSocketId);
  return nextMessage;
};

const removeGroupById = (groupId) => {
  groups = groups.filter((group) => group._id !== groupId);
  messages = messages.filter((message) => message.groupId !== groupId);
};

const resetState = () => {
  users = baseUsers.map((user) => ({ ...user }));
  friendRequests = [];
  groups = [];
  sessions = new Map();
  messageCounter = 0;
  groupCounter = 0;
  friendRequestCounter = 0;
  attachmentCounter = 0;
  messageDelays = { ...defaultMessageDelays };
  uploadedFiles = new Map();
  messages = [
    createMessage({
      senderId: "user-bob",
      receiverId: "user-alice",
      text: "Bob says hello from the slow thread",
    }),
    createMessage({
      senderId: "user-cara",
      receiverId: "user-alice",
      text: "Cara has the latest fast thread",
    }),
  ];
};

const requireAuth = (req, res, next) => {
  const sessionId = req.cookies[SESSION_COOKIE];
  const userId = sessions.get(sessionId);
  const user = userId ? getUserById(userId) : null;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = user;
  next();
};

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_, res) => {
  res.status(200).json({ ok: true });
});

app.get("/test/uploads/:storageKey/:fileName", (req, res) => {
  const uploadedFile = uploadedFiles.get(req.params.storageKey);

  if (!uploadedFile) {
    return res.status(404).json({ message: "Upload not found." });
  }

  res.setHeader("Content-Type", uploadedFile.mimeType);
  res.send(uploadedFile.buffer);
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(
    (candidate) =>
      candidate.email === email && candidate.password === password,
  );

  if (!user) {
    return res.status(400).json({ message: "Invalid email or password." });
  }

  const sessionId = randomUUID();
  sessions.set(sessionId, user._id);
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  res.status(200).json(serializeUser(user));
});

app.post("/api/auth/logout", (req, res) => {
  sessions.delete(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(200).json({ message: "Logged out successfully." });
});

app.get("/api/auth/check", requireAuth, (req, res) => {
  res.status(200).json({
    message: "You are logged in.",
    user: serializeUser(req.user),
  });
});

app.put("/api/auth/update-profile", requireAuth, (req, res) => {
  const { profilePic } = req.body;

  if (!profilePic) {
    return res
      .status(400)
      .json({ message: "No profile picture provided." });
  }

  req.user.profilePicture = profilePic;
  res.status(200).json(serializeUser(req.user));
});

app.get("/api/friends/me", requireAuth, (req, res) => {
  res.status(200).json(serializeFriendUser(req.user));
});

app.get("/api/friends/search", requireAuth, (req, res) => {
  const friendId = String(req.query.friendId || "").trim().toUpperCase();

  if (!friendId) {
    return res.status(400).json({ message: "Enter a valid Friend ID." });
  }

  if (friendId === req.user.friendId) {
    return res
      .status(400)
      .json({ message: "You cannot send a friend request to yourself." });
  }

  const foundUser = getUserByFriendId(friendId);

  if (!foundUser) {
    return res.status(404).json({ message: "No user found for that Friend ID." });
  }

  return res.status(200).json({ user: serializeFriendUser(foundUser) });
});

app.get("/api/friends", requireAuth, (req, res) => {
  res.status(200).json({ friends: getAcceptedFriends(req.user._id) });
});

app.post("/api/friends/requests", requireAuth, (req, res) => {
  const senderSocketIdToSkip = req.get("x-socket-id") || null;
  const friendId = String(req.body?.friendId || "").trim().toUpperCase();

  if (!friendId) {
    return res.status(400).json({ message: "Enter a valid Friend ID." });
  }

  const receiver = getUserByFriendId(friendId);

  if (!receiver) {
    return res.status(404).json({ message: "No user found for that Friend ID." });
  }

  if (receiver._id === req.user._id) {
    return res
      .status(400)
      .json({ message: "You cannot send a friend request to yourself." });
  }

  const existingRelationship = getRelevantRelationship(req.user._id, receiver._id);

  if (existingRelationship?.status === "accepted") {
    return res.status(400).json({ message: "You are already friends." });
  }

  if (existingRelationship?.status === "pending") {
    const isOutgoingDuplicate = existingRelationship.senderId === req.user._id;
    return res.status(409).json({
      message: isOutgoingDuplicate
        ? "You already sent a friend request to this user."
        : "This user has already sent you a friend request.",
    });
  }

  const friendRequest = createFriendRequest({
    senderId: req.user._id,
    receiverId: receiver._id,
  });
  friendRequests.push(friendRequest);

  emitFriendRequestEvent(receiver._id, {
    scope: "incoming",
    action: "created",
    request: serializeFriendRequest(friendRequest, "senderId"),
  });
  emitFriendRequestEvent(
    req.user._id,
    {
      scope: "outgoing",
      action: "created",
      request: serializeFriendRequest(friendRequest, "receiverId"),
    },
    senderSocketIdToSkip,
  );

  return res.status(201).json({
    request: serializeFriendRequest(friendRequest, "receiverId"),
  });
});

app.get("/api/friends/requests/incoming", requireAuth, (req, res) => {
  const incomingRequests = friendRequests
    .filter(
      (friendRequest) =>
        friendRequest.receiverId === req.user._id &&
        friendRequest.status === "pending",
    )
    .slice()
    .reverse()
    .map((friendRequest) => serializeFriendRequest(friendRequest, "senderId"));

  res.status(200).json({ requests: incomingRequests });
});

app.get("/api/friends/requests/outgoing", requireAuth, (req, res) => {
  const outgoingRequests = friendRequests
    .filter(
      (friendRequest) =>
        friendRequest.senderId === req.user._id &&
        friendRequest.status === "pending",
    )
    .slice()
    .reverse()
    .map((friendRequest) => serializeFriendRequest(friendRequest, "receiverId"));

  res.status(200).json({ requests: outgoingRequests });
});

app.post("/api/friends/requests/:requestId/cancel", requireAuth, (req, res) => {
  const senderSocketIdToSkip = req.get("x-socket-id") || null;
  const friendRequest = friendRequests.find(
    (candidate) => candidate._id === req.params.requestId,
  );

  if (!friendRequest) {
    return res.status(404).json({ message: "Friend request not found." });
  }

  if (friendRequest.senderId !== req.user._id) {
    return res
      .status(403)
      .json({ message: "You can only cancel outgoing requests." });
  }

  if (friendRequest.status !== "pending") {
    return res
      .status(400)
      .json({ message: "This friend request is no longer pending." });
  }

  friendRequest.status = "rejected";
  friendRequest.updatedAt = new Date().toISOString();

  emitFriendRequestEvent(
    friendRequest.senderId,
    {
      scope: "outgoing",
      action: "cancelled",
      requestId: friendRequest._id,
    },
    senderSocketIdToSkip,
  );
  emitFriendRequestEvent(friendRequest.receiverId, {
    scope: "incoming",
    action: "cancelled",
    requestId: friendRequest._id,
  });

  return res.status(200).json({
    request: serializeFriendRequest(friendRequest, "receiverId"),
  });
});

app.post("/api/friends/requests/:requestId/accept", requireAuth, (req, res) => {
  const receiverSocketIdToSkip = req.get("x-socket-id") || null;
  const friendRequest = friendRequests.find(
    (candidate) => candidate._id === req.params.requestId,
  );

  if (!friendRequest) {
    return res.status(404).json({ message: "Friend request not found." });
  }

  if (friendRequest.receiverId !== req.user._id) {
    return res
      .status(403)
      .json({ message: "You can only respond to incoming requests." });
  }

  if (friendRequest.status !== "pending") {
    return res
      .status(400)
      .json({ message: "This friend request is no longer pending." });
  }

  friendRequest.status = "accepted";
  friendRequest.updatedAt = new Date().toISOString();

  emitFriendRequestEvent(
    friendRequest.receiverId,
    {
      scope: "incoming",
      action: "accepted",
      requestId: friendRequest._id,
      friend: serializeFriendUser(getUserById(friendRequest.senderId)),
    },
    receiverSocketIdToSkip,
  );
  emitFriendRequestEvent(friendRequest.senderId, {
    scope: "outgoing",
    action: "accepted",
    requestId: friendRequest._id,
    friend: serializeFriendUser(getUserById(friendRequest.receiverId)),
  });

  return res.status(200).json({
    request: serializeFriendRequest(friendRequest, "senderId"),
    friend: serializeFriendUser(getUserById(friendRequest.senderId)),
  });
});

app.post("/api/friends/requests/:requestId/reject", requireAuth, (req, res) => {
  const receiverSocketIdToSkip = req.get("x-socket-id") || null;
  const friendRequest = friendRequests.find(
    (candidate) => candidate._id === req.params.requestId,
  );

  if (!friendRequest) {
    return res.status(404).json({ message: "Friend request not found." });
  }

  if (friendRequest.receiverId !== req.user._id) {
    return res
      .status(403)
      .json({ message: "You can only respond to incoming requests." });
  }

  if (friendRequest.status !== "pending") {
    return res
      .status(400)
      .json({ message: "This friend request is no longer pending." });
  }

  friendRequest.status = "rejected";
  friendRequest.updatedAt = new Date().toISOString();

  emitFriendRequestEvent(
    friendRequest.receiverId,
    {
      scope: "incoming",
      action: "rejected",
      requestId: friendRequest._id,
    },
    receiverSocketIdToSkip,
  );
  emitFriendRequestEvent(friendRequest.senderId, {
    scope: "outgoing",
    action: "rejected",
    requestId: friendRequest._id,
  });

  return res.status(200).json({
    request: serializeFriendRequest(friendRequest, "senderId"),
  });
});

app.get("/api/messages/contacts", requireAuth, (req, res) => {
  res.status(200).json(getAcceptedFriends(req.user._id));
});

app.get("/api/messages/chats", requireAuth, (req, res) => {
  const partners = getPartnerIds(req.user._id)
    .map((partnerId) => {
      const partner = getUserById(partnerId);
      if (!partner) {
        return null;
      }

      return {
        ...serializeUser(partner),
        latestMessage: getLatestMessageForPartner(req.user._id, partnerId),
      };
    })
    .filter(Boolean);

  res.status(200).json(partners);
});

app.get("/api/messages/groups", requireAuth, (req, res) => {
  const userGroups = groups
    .filter((group) => group.memberIds.includes(req.user._id))
    .map((group) =>
      serializeGroupForUser(
        group,
        req.user._id,
        getLatestMessageForGroup(group._id),
      ),
    )
    .sort((firstGroup, secondGroup) => {
      const firstTimestamp = new Date(
        firstGroup.latestMessage?.createdAt || firstGroup.createdAt,
      ).getTime();
      const secondTimestamp = new Date(
        secondGroup.latestMessage?.createdAt || secondGroup.createdAt,
      ).getTime();
      return secondTimestamp - firstTimestamp;
    });

  res.status(200).json(userGroups);
});

app.post("/api/messages/groups", requireAuth, (req, res) => {
  const trimmedName = getTrimmedText(req.body?.name);
  const creatorId = req.user._id;
  const invitedMemberIds = Array.from(
    new Set(
      (Array.isArray(req.body?.memberIds) ? req.body.memberIds : [])
        .map((memberId) => String(memberId || "").trim())
        .filter((memberId) => memberId && memberId !== creatorId),
    ),
  );

  if (!trimmedName) {
    return res.status(400).json({ message: "Group name is required." });
  }

  if (invitedMemberIds.length === 0) {
    return res.status(400).json({ message: "Select at least one member." });
  }

  const acceptedFriendIds = new Set(
    getAcceptedFriends(creatorId).map((friend) => friend._id),
  );

  if (invitedMemberIds.some((memberId) => !acceptedFriendIds.has(memberId))) {
    return res.status(400).json({
      message: "You can only create groups with accepted friends.",
    });
  }

  if (invitedMemberIds.some((memberId) => !getUserById(memberId))) {
    return res.status(404).json({ message: "One or more group members were not found." });
  }

  const nextGroup = createGroup({
    name: trimmedName,
    createdBy: creatorId,
    memberIds: [creatorId, ...invitedMemberIds],
  });
  groups.push(nextGroup);
  emitGroupCreated(nextGroup, req.get("x-socket-id") || null);

  return res.status(201).json(serializeGroupForUser(nextGroup, creatorId));
});

app.patch("/api/messages/groups/:id", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  if (!isGroupAdmin(group, req.user._id)) {
    return res.status(403).json({ message: "Only administrators can edit this group." });
  }

  const hasName = hasOwn(req.body, "name");
  const hasAvatar = hasOwn(req.body, "avatar");

  if (!hasName && !hasAvatar) {
    return res.status(400).json({ message: "No group changes were provided." });
  }

  if (hasName) {
    const trimmedName = getTrimmedText(req.body?.name);
    if (!trimmedName) {
      return res.status(400).json({ message: "Group name is required." });
    }

    group.name = trimmedName;
  }

  if (hasAvatar) {
    const nextAvatar =
      typeof req.body?.avatar === "string" ? req.body.avatar.trim() : req.body?.avatar;

    if (nextAvatar == null || nextAvatar === "") {
      group.avatarUrl = "";
    } else if (typeof nextAvatar === "string" && nextAvatar.startsWith("data:")) {
      group.avatarUrl = nextAvatar;
    } else {
      return res.status(400).json({ message: "Invalid group avatar." });
    }
  }

  group.updatedAt = new Date().toISOString();
  const latestMessage = getLatestMessageForGroup(group._id);
  emitGroupUpdated(group, latestMessage, req.get("x-socket-id") || null);

  return res.status(200).json(
    serializeGroupForUser(group, req.user._id, latestMessage),
  );
});

app.post("/api/messages/groups/:id/members", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  if (!isGroupAdmin(group, req.user._id)) {
    return res.status(403).json({ message: "Only administrators can manage this group." });
  }

  const requestedMemberIds = Array.from(
    new Set(
      (Array.isArray(req.body?.memberIds) ? req.body.memberIds : [])
        .map((memberId) => String(memberId || "").trim())
        .filter(Boolean),
    ),
  );
  const nextMemberIdsToAdd = requestedMemberIds.filter(
    (memberId) => !group.memberIds.includes(memberId),
  );

  if (nextMemberIdsToAdd.length === 0) {
    return res.status(400).json({ message: "Select at least one new member." });
  }

  const acceptedFriendIds = new Set(
    getAcceptedFriends(req.user._id).map((friend) => friend._id),
  );

  if (nextMemberIdsToAdd.some((memberId) => !acceptedFriendIds.has(memberId))) {
    return res.status(400).json({
      message: "You can only add accepted friends to this group.",
    });
  }

  if (nextMemberIdsToAdd.some((memberId) => !getUserById(memberId))) {
    return res.status(404).json({ message: "One or more group members were not found." });
  }

  group.memberIds = [...group.memberIds, ...nextMemberIdsToAdd];
  group.updatedAt = new Date().toISOString();

  const latestMessage = getLatestMessageForGroup(group._id);
  emitGroupUpdated(group, latestMessage, req.get("x-socket-id") || null);

  return res.status(200).json(
    serializeGroupForUser(group, req.user._id, latestMessage),
  );
});

app.post("/api/messages/groups/:id/members/:memberId/promote", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);
  const targetMemberId = String(req.params.memberId || "").trim();

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  if (!isGroupAdmin(group, req.user._id)) {
    return res.status(403).json({ message: "Only administrators can manage this group." });
  }

  if (!group.memberIds.includes(targetMemberId)) {
    return res.status(404).json({ message: "Member not found." });
  }

  if (!isGroupAdmin(group, targetMemberId)) {
    group.adminIds = normalizeGroupAdminIds(
      group.memberIds,
      [...getGroupAdminIds(group), targetMemberId],
      getGroupOwnerId(group),
    );
    group.updatedAt = new Date().toISOString();
  }

  const latestMessage = getLatestMessageForGroup(group._id);
  emitGroupUpdated(group, latestMessage, req.get("x-socket-id") || null);

  return res.status(200).json(
    serializeGroupForUser(group, req.user._id, latestMessage),
  );
});

app.post("/api/messages/groups/:id/members/:memberId/demote", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);
  const targetMemberId = String(req.params.memberId || "").trim();

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  if (!isGroupAdmin(group, req.user._id)) {
    return res.status(403).json({ message: "Only administrators can manage this group." });
  }

  if (!group.memberIds.includes(targetMemberId)) {
    return res.status(404).json({ message: "Member not found." });
  }

  if (targetMemberId === req.user._id) {
    return res.status(400).json({ message: "You cannot change your own administrator role here." });
  }

  if (isGroupAdmin(group, targetMemberId)) {
    applyGroupMembershipState(
      group,
      group.memberIds,
      getGroupAdminIds(group).filter((adminId) => adminId !== targetMemberId),
      getGroupOwnerId(group) === targetMemberId ? null : getGroupOwnerId(group),
    );
    group.updatedAt = new Date().toISOString();
  }

  const latestMessage = getLatestMessageForGroup(group._id);
  emitGroupUpdated(group, latestMessage, req.get("x-socket-id") || null);

  return res.status(200).json(
    serializeGroupForUser(group, req.user._id, latestMessage),
  );
});

app.delete("/api/messages/groups/:id/members/:memberId", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);
  const targetMemberId = String(req.params.memberId || "").trim();

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  if (!isGroupAdmin(group, req.user._id)) {
    return res.status(403).json({ message: "Only administrators can manage this group." });
  }

  if (targetMemberId === req.user._id) {
    return res.status(400).json({ message: "Use leave group to remove yourself." });
  }

  if (!group.memberIds.includes(targetMemberId)) {
    return res.status(404).json({ message: "Member not found." });
  }

  const remainingMemberIds = group.memberIds.filter((memberId) => memberId !== targetMemberId);
  const leadership = applyGroupMembershipState(
    group,
    remainingMemberIds,
    getGroupAdminIds(group).filter((adminId) => adminId !== targetMemberId),
    getGroupOwnerId(group),
  );

  if (leadership.shouldDelete) {
    const memberIds = [...group.memberIds];
    removeGroupById(group._id);
    emitGroupRemoved(memberIds, group._id, req.get("x-socket-id") || null);

    return res.status(200).json({
      groupId: group._id,
      deleted: true,
    });
  }

  group.updatedAt = new Date().toISOString();

  const latestMessage = getLatestMessageForGroup(group._id);
  emitGroupUpdated(group, latestMessage, req.get("x-socket-id") || null);
  emitGroupRemoved([targetMemberId], group._id, req.get("x-socket-id") || null);

  return res.status(200).json(
    serializeGroupForUser(group, req.user._id, latestMessage),
  );
});

app.post("/api/messages/groups/:id/leave", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  const leavingUserId = req.user._id;
  const remainingMemberIds = group.memberIds.filter((memberId) => memberId !== leavingUserId);

  if (remainingMemberIds.length === 0) {
    removeGroupById(group._id);
    emitGroupRemoved([leavingUserId], group._id, req.get("x-socket-id") || null);

    return res.status(200).json({
      groupId: group._id,
      deleted: true,
    });
  }

  applyGroupMembershipState(
    group,
    remainingMemberIds,
    getGroupAdminIds(group).filter((adminId) => adminId !== leavingUserId),
    getGroupOwnerId(group),
  );
  group.updatedAt = new Date().toISOString();

  const latestMessage = getLatestMessageForGroup(group._id);
  emitGroupUpdated(group, latestMessage, req.get("x-socket-id") || null);
  emitGroupRemoved([leavingUserId], group._id, req.get("x-socket-id") || null);

  return res.status(200).json({
    groupId: group._id,
    deleted: false,
  });
});

app.delete("/api/messages/groups/:id", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  if (!isGroupAdmin(group, req.user._id)) {
    return res.status(403).json({ message: "Only administrators can delete this group." });
  }

  const memberIds = [...group.memberIds];
  removeGroupById(group._id);
  emitGroupRemoved(memberIds, group._id, req.get("x-socket-id") || null);

  return res.status(200).json({ groupId: group._id });
});

app.get("/api/messages/groups/:id/messages", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  const groupMessages = messages.filter((message) => message.groupId === group._id);
  return res.status(200).json(groupMessages);
});

app.post("/api/messages/groups/:id/messages", requireAuth, (req, res) => {
  const group = getGroupById(req.params.id);

  if (!group || !group.memberIds.includes(req.user._id)) {
    return res.status(404).json({ message: "Group not found." });
  }

  const messageContent = buildMessageContent(req.body);
  if (messageContent.error) {
    return res.status(400).json({ message: messageContent.error });
  }

  const nextMessage = persistAndBroadcastGroupMessage(
    group,
    {
      senderId: req.user._id,
      text: messageContent.text,
      image: messageContent.image,
      attachments: messageContent.attachments,
    },
    { skipSocketId: req.get("x-socket-id") || null },
  );

  return res.status(201).json({
    group: serializeGroupForUser(group, req.user._id, nextMessage),
    message: nextMessage,
  });
});

app.get("/api/messages/:id", requireAuth, async (req, res) => {
  const partnerId = req.params.id;
  const conversationKey = getConversationKey(req.user._id, partnerId);
  const waitMs = messageDelays[conversationKey] || 0;

  await delay(waitMs);

  const conversation = messages.filter(
    (message) =>
      (message.senderId === req.user._id &&
        message.receiverId === partnerId) ||
      (message.senderId === partnerId && message.receiverId === req.user._id),
  );

  res.status(200).json(conversation);
});

app.post(
  "/api/messages/attachments/upload",
  requireAuth,
  handleSingleAttachmentUpload,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Attachment file is required." });
    }

    if (!isAllowedAttachmentMimeType(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Only images and PDF files are allowed." });
    }

    const attachment = createUploadedAttachment(req.file);
    return res.status(201).json({ attachment });
  },
);

app.post("/api/messages/send/:id", requireAuth, (req, res) => {
  const receiverId = req.params.id;
  if (!getUserById(receiverId)) {
    return res.status(404).json({ message: "Receiver not found." });
  }

  const messageContent = buildMessageContent(req.body);
  if (messageContent.error) {
    return res.status(400).json({ message: messageContent.error });
  }

  const nextMessage = persistAndBroadcastMessage(
    {
      senderId: req.user._id,
      receiverId,
      text: messageContent.text,
      image: messageContent.image,
      attachments: messageContent.attachments,
    },
    { skipSocketId: req.get("x-socket-id") || null },
  );

  res.status(201).json(nextMessage);
});

app.post("/test/reset", (_, res) => {
  resetState();
  emitOnlineUsers();
  res.status(200).json({ ok: true });
});

app.post("/test/config", (req, res) => {
  messageDelays = {
    ...defaultMessageDelays,
    ...(req.body?.messageDelays || {}),
  };
  res.status(200).json({ ok: true, messageDelays });
});

app.post("/test/push-message", (req, res) => {
  const { senderId, receiverId, text = "", image = null, attachments = [] } =
    req.body;

  if (!getUserById(senderId) || !getUserById(receiverId)) {
    return res.status(400).json({ message: "Unknown sender or receiver." });
  }

  const nextMessage = persistAndBroadcastMessage({
    senderId,
    receiverId,
    text,
    image,
    attachments,
  });
  res.status(201).json(nextMessage);
});

io.use((socket, next) => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  const userId = sessions.get(sessionId);
  const user = userId ? getUserById(userId) : null;

  if (!user) {
    return next(new Error("Unauthorized"));
  }

  socket.userId = user._id;
  socket.user = user;
  next();
});

io.on("connection", (socket) => {
  const existingSockets = userSockets.get(socket.userId) || new Set();
  existingSockets.add(socket.id);
  userSockets.set(socket.userId, existingSockets);

  emitOnlineUsers();

  socket.on("disconnect", () => {
    const socketsForUser = userSockets.get(socket.userId);
    socketsForUser?.delete(socket.id);

    if (socketsForUser && socketsForUser.size === 0) {
      userSockets.delete(socket.userId);
    }

    emitOnlineUsers();
  });
});

resetState();

server.listen(PORT, () => {
  console.log(`Mock E2E server listening on ${PORT}`);
});

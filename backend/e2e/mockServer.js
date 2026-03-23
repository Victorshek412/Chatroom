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
let friendRequests = [];
let sessions = new Map();
let userSockets = new Map();
let messageCounter = 0;
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
  receiverId,
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
      public_id: `chatroom/message-attachments/${storageKey}`,
      bytes: file.size,
      format: extension,
      resource_type: file.mimetype.startsWith("image/") ? "image" : "raw",
    },
    file,
  );
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

const resetState = () => {
  users = baseUsers.map((user) => ({ ...user }));
  friendRequests = [];
  sessions = new Map();
  messageCounter = 0;
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

app.post("/api/friends/requests/:requestId/accept", requireAuth, (req, res) => {
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

  return res.status(200).json({
    request: serializeFriendRequest(friendRequest, "senderId"),
    friend: serializeFriendUser(getUserById(friendRequest.senderId)),
  });
});

app.post("/api/friends/requests/:requestId/reject", requireAuth, (req, res) => {
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

  return res.status(200).json({
    request: serializeFriendRequest(friendRequest, "senderId"),
  });
});

app.get("/api/messages/contacts", requireAuth, (req, res) => {
  res.status(200).json(getAcceptedFriends(req.user._id));
});

app.get("/api/messages/chats", requireAuth, (req, res) => {
  const partners = getPartnerIds(req.user._id)
    .map(getUserById)
    .filter(Boolean)
    .map(serializeUser);

  res.status(200).json(partners);
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
  const { text = "", image = null, attachments } = req.body;
  const trimmedText = getTrimmedText(text);
  const legacyImagePayload = typeof image === "string" ? image.trim() : "";
  const {
    attachments: normalizedAttachments,
    error: attachmentsError,
  } = normalizeAttachmentsPayload(attachments);

  if (attachmentsError) {
    return res.status(400).json({ message: attachmentsError });
  }

  if (legacyImagePayload && normalizedAttachments.length > 0) {
    return res
      .status(400)
      .json({ message: "Only one attachment is allowed per message." });
  }

  if (!trimmedText && !legacyImagePayload && normalizedAttachments.length === 0) {
    return res.status(400).json({
      message: "Text, image, or attachment is required.",
    });
  }

  if (!getUserById(receiverId)) {
    return res.status(404).json({ message: "Receiver not found." });
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

  const nextMessage = persistAndBroadcastMessage(
    {
      senderId: req.user._id,
      receiverId,
      text: trimmedText,
      image: imageUrl,
      attachments: attachmentsToSave,
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

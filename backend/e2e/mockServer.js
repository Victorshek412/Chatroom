import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import http from "http";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  buildCloudinaryAttachmentMetadata,
  getAttachmentValidationError,
  getAttachmentsCountValidationError,
  getAttachmentsTotalSizeValidationError,
  getCloudinaryResourceTypeForMimeType,
  getRawAttachmentValidationError,
  isCloudinaryAttachmentStorageKey,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MESSAGE_ATTACHMENT_UPLOAD_SIZE,
  MESSAGE_ATTACHMENT_FILES_FIELD,
  MESSAGE_ATTACHMENT_FOLDER,
  MESSAGE_ATTACHMENT_LEGACY_FILE_FIELD,
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

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MESSAGE_ATTACHMENT_UPLOAD_SIZE,
    files: MAX_ATTACHMENTS_PER_MESSAGE,
  },
});

const baseUsers = [
  {
    _id: "user-alice",
    fullName: "Alice Tester",
    email: "alice@example.com",
    password: "password123",
    profilePicture: null,
  },
  {
    _id: "user-bob",
    fullName: "Bob Stone",
    email: "bob@example.com",
    password: "password123",
    profilePicture: null,
  },
  {
    _id: "user-cara",
    fullName: "Cara Lane",
    email: "cara@example.com",
    password: "password123",
    profilePicture: null,
  },
];

const defaultMessageDelays = {
  "user-alice:user-bob": 450,
  "user-alice:user-cara": 25,
};

let users = [];
let messages = [];
let sessions = new Map();
let userSockets = new Map();
let messageCounter = 0;
let attachmentCounter = 0;
let messageDelays = { ...defaultMessageDelays };
let uploadedFiles = new Map();

const serializeUser = ({ password, ...user }) => ({ ...user });

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

const getConversationKey = (firstUserId, secondUserId) =>
  `${firstUserId}:${secondUserId}`;

const getTrimmedText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getBase64MimeType = (value = "") => {
  const match = value.match(/^data:(.+?);base64,/);
  return match ? match[1] : "";
};

const getUploadedFiles = (req) => {
  if (Array.isArray(req.files)) {
    return req.files;
  }

  if (req.files && typeof req.files === "object") {
    return Object.values(req.files).flat();
  }

  if (req.file) {
    return [req.file];
  }

  return [];
};

const normalizeAttachmentsPayload = (attachments) => {
  if (attachments == null) {
    return { attachments: [] };
  }

  if (!Array.isArray(attachments)) {
    return { error: "Attachments must be an array." };
  }

  const countValidationError = getAttachmentsCountValidationError(
    attachments.length,
  );

  if (countValidationError) {
    return { error: countValidationError };
  }

  const normalizedAttachments = attachments.map(normalizeAttachmentMetadata);
  const attachmentValidationError = normalizedAttachments
    .map(getAttachmentValidationError)
    .find(Boolean);

  if (attachmentValidationError) {
    return { error: attachmentValidationError };
  }

  const totalSizeValidationError =
    getAttachmentsTotalSizeValidationError(normalizedAttachments);

  if (totalSizeValidationError) {
    return { error: totalSizeValidationError };
  }

  return { attachments: normalizedAttachments };
};

const handleAttachmentUpload = (req, res, next) => {
  attachmentUpload.fields([
    {
      name: MESSAGE_ATTACHMENT_FILES_FIELD,
      maxCount: MAX_ATTACHMENTS_PER_MESSAGE,
    },
    {
      name: MESSAGE_ATTACHMENT_LEGACY_FILE_FIELD,
      maxCount: 1,
    },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "Files must be 15 MB or smaller." });
      }

      if (
        error.code === "LIMIT_FILE_COUNT" ||
        error.code === "LIMIT_UNEXPECTED_FILE"
      ) {
        return res
          .status(400)
          .json({ message: "You can attach up to 5 files per message." });
      }
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
    ? attachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
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

  const assetId = `attachment-${attachmentCounter}`;
  const storageKey = `${MESSAGE_ATTACHMENT_FOLDER}/${assetId}`;
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
      secure_url: `${SERVER_ORIGIN}/test/uploads/${encodeURIComponent(storageKey)}/${encodeURIComponent(file.originalname)}`,
      original_filename: originalFilename,
      public_id: storageKey,
      bytes: file.size,
      format: extension,
      resource_type: getCloudinaryResourceTypeForMimeType(file.mimetype),
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
  sessions = new Map();
  messageCounter = 0;
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

app.get("/api/messages/contacts", requireAuth, (req, res) => {
  const contacts = users
    .filter((user) => user._id !== req.user._id)
    .map(serializeUser);
  res.status(200).json(contacts);
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
  handleAttachmentUpload,
  (req, res) => {
    const uploaded = getUploadedFiles(req);

    if (uploaded.length === 0) {
      return res.status(400).json({ message: "Attachment file is required." });
    }

    const countValidationError = getAttachmentsCountValidationError(
      uploaded.length,
    );

    if (countValidationError) {
      return res.status(400).json({ message: countValidationError });
    }

    const fileValidationError = uploaded
      .map((file) =>
        getRawAttachmentValidationError({
          mimeType: file.mimetype,
          size: file.size,
        }),
      )
      .find(Boolean);

    if (fileValidationError) {
      return res.status(400).json({ message: fileValidationError });
    }

    const totalSizeValidationError = getAttachmentsTotalSizeValidationError(
      uploaded,
    );

    if (totalSizeValidationError) {
      return res.status(400).json({ message: totalSizeValidationError });
    }

    const attachments = uploaded.map(createUploadedAttachment);

    return res.status(201).json({
      attachments,
      attachment: attachments[0] || null,
    });
  },
);

app.post("/api/messages/attachments/remove", requireAuth, (req, res) => {
  const { storageKey } = req.body ?? {};

  if (!isCloudinaryAttachmentStorageKey(storageKey)) {
    return res.status(400).json({ message: "Invalid attachment storage key." });
  }

  uploadedFiles.delete(storageKey);
  return res.status(200).json({ result: "ok" });
});

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
    return res.status(400).json({
      message: "Use attachments or the legacy image field, not both.",
    });
  }

  if (!trimmedText && !legacyImagePayload && normalizedAttachments.length === 0) {
    return res.status(400).json({
      message: "Text, image, or attachment is required.",
    });
  }

  if (!getUserById(receiverId)) {
    return res.status(404).json({ message: "Receiver not found." });
  }

  let attachmentsToSave = normalizedAttachments;
  let imageUrl =
    attachmentsToSave.find((attachment) => attachment.kind === "image")?.url ||
    null;

  if (legacyImagePayload) {
    const legacyMimeType = getBase64MimeType(legacyImagePayload) || "image/png";
    const legacyStorageKey = `${MESSAGE_ATTACHMENT_FOLDER}/legacy-image-${messageCounter + 1}`;

    attachmentsToSave = [
      normalizeAttachmentMetadata({
        url: legacyImagePayload,
        originalName: "shared-image.png",
        mimeType: legacyMimeType,
        size: legacyImagePayload.length,
        kind: "image",
        provider: "cloudinary",
        storageKey: legacyStorageKey,
        resourceType: getCloudinaryResourceTypeForMimeType(legacyMimeType),
      }),
    ];
    imageUrl = legacyImagePayload;
  }

  const totalSizeValidationError =
    getAttachmentsTotalSizeValidationError(attachmentsToSave);

  if (totalSizeValidationError) {
    return res.status(400).json({ message: totalSizeValidationError });
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

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import http from "http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";

const PORT = Number(process.env.E2E_BACKEND_PORT || 3100);
const FRONTEND_ORIGIN =
  process.env.E2E_FRONTEND_ORIGIN || "http://localhost:4173";
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
let messageDelays = { ...defaultMessageDelays };

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

const createMessage = ({ senderId, receiverId, text = "", image = null }) => {
  messageCounter += 1;

  return {
    _id: `message-${messageCounter}`,
    senderId,
    receiverId,
    text,
    image,
    createdAt: new Date(
      Date.UTC(2026, 2, 23, 9, 0, Math.min(messageCounter, 59)),
    ).toISOString(),
  };
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
  messageDelays = { ...defaultMessageDelays };
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

app.post("/api/messages/send/:id", requireAuth, (req, res) => {
  const receiverId = req.params.id;
  const { text = "", image = null } = req.body;

  if (!text && !image) {
    return res.status(400).json({ message: "Text or image is required." });
  }

  if (!getUserById(receiverId)) {
    return res.status(404).json({ message: "Receiver not found." });
  }

  const nextMessage = persistAndBroadcastMessage(
    {
      senderId: req.user._id,
      receiverId,
      text,
      image,
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
  const { senderId, receiverId, text = "", image = null } = req.body;

  if (!getUserById(senderId) || !getUserById(receiverId)) {
    return res.status(400).json({ message: "Unknown sender or receiver." });
  }

  const nextMessage = persistAndBroadcastMessage({
    senderId,
    receiverId,
    text,
    image,
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

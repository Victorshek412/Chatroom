import express from "express";
import {
  acceptFriendRequest,
  findUserByFriendId,
  getMyFriendProfile,
  listAcceptedFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
} from "../controllers/friend.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/me", getMyFriendProfile);
router.get("/search", findUserByFriendId);
router.get("/", listAcceptedFriends);
router.post("/requests", sendFriendRequest);
router.get("/requests/incoming", listIncomingFriendRequests);
router.get("/requests/outgoing", listOutgoingFriendRequests);
router.post("/requests/:requestId/accept", acceptFriendRequest);
router.post("/requests/:requestId/reject", rejectFriendRequest);

export default router;

import express from "express";
import multer from "multer";
import {
  getAllContacts,
  getChatPartners,
  getMessageByUserId,
  sendMessage,
  uploadMessageAttachment,
} from "../controllers/message.controller.js";
import {
  MAX_MESSAGE_ATTACHMENT_SIZE,
  MESSAGE_ATTACHMENT_FILE_FIELD,
} from "../lib/messageAttachments.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MESSAGE_ATTACHMENT_SIZE,
  },
});

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

// the middlewares execute in order - so requests fet rate-litmited first, then authenticated.
// this is actually more efficient since unauthenticated requests get blocked by rate limiting before hitting the auth middleware.
router.use(arcjetProtection, protectRoute); // Apply ARCJET protection and authentication middleware to all routes in this router
router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);
router.post(
  "/attachments/upload",
  handleSingleAttachmentUpload,
  uploadMessageAttachment,
);
router.get("/:id", getMessageByUserId);
//explain how the above line works: This line defines a GET route for the endpoint "/:id". When a request is made to this endpoint with a user ID parameter, the protectRoute middleware is executed first to ensure that the user is authenticated. If the user is authenticated, the getMessageByUserId controller function is called to handle the request and retrieve messages based on the user ID provided in the request parameters.
router.post("/send/:id", sendMessage);
//explain why the order line 11-14 works: The order of the routes is important because Express matches routes in the order they are defined. The route for "/contacts" and "/chats" must be defined before the route for "/:id" because if "/:id" is defined first, it would match any request that comes in, including requests for "/contacts" and "/chats". By defining the more specific routes first, we ensure that they are matched correctly before the more general route for "/:id" is evaluated.
export default router; // Export the router to be used in other parts of the application

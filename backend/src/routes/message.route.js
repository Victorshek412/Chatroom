import express from "express";
import multer from "multer";
import {
  getAllContacts,
  getChatPartners,
  getMessageByUserId,
  removePendingMessageAttachment,
  sendMessage,
  uploadMessageAttachments,
} from "../controllers/message.controller.js";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MESSAGE_ATTACHMENT_UPLOAD_SIZE,
  MESSAGE_ATTACHMENT_FILES_FIELD,
  MESSAGE_ATTACHMENT_LEGACY_FILE_FIELD,
} from "../lib/messageAttachments.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MESSAGE_ATTACHMENT_UPLOAD_SIZE,
    files: MAX_ATTACHMENTS_PER_MESSAGE,
  },
});

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

router.use(arcjetProtection, protectRoute);
router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);
router.post("/attachments/upload", handleAttachmentUpload, uploadMessageAttachments);
router.post("/attachments/remove", removePendingMessageAttachment);
router.get("/:id", getMessageByUserId);
router.post("/send/:id", sendMessage);

export default router;

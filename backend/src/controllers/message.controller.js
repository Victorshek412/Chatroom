import cloudinary, {
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from "../lib/cloudinary.js";
import {
  buildCloudinaryAttachmentMetadata,
  getAttachmentValidationError,
  getAttachmentsCountValidationError,
  getAttachmentsTotalSizeValidationError,
  getCloudinaryResourceTypeForMimeType,
  getRawAttachmentValidationError,
  isCloudinaryAttachmentStorageKey,
  MESSAGE_ATTACHMENT_FOLDER,
  normalizeAttachmentMetadata,
  normalizeCloudinaryResourceType,
} from "../lib/messageAttachments.js";
import { getReceiverSocketIds, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const LEGACY_IMAGE_NAME = "shared-image";

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

const getFirstImageAttachmentUrl = (attachments = []) =>
  attachments.find((attachment) => attachment.kind === "image")?.url;

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

const cleanupUploadedAttachments = async (attachments = []) => {
  const attachmentsToCleanup = attachments.filter(
    (attachment) => attachment?.storageKey,
  );

  await Promise.allSettled(
    attachmentsToCleanup.map((attachment) =>
      destroyCloudinaryAsset(attachment.storageKey, {
        resource_type: normalizeCloudinaryResourceType(
          attachment.resourceType,
          attachment.mimeType,
        ),
      }),
    ),
  );
};

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessageByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatID } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatID },
        { senderId: userToChatID, receiverId: myId },
      ],
    }).sort({ createdAt: 1, _id: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessageByUserId", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const uploadMessageAttachments = async (req, res) => {
  const uploadedFiles = getUploadedFiles(req);

  if (uploadedFiles.length === 0) {
    return res.status(400).json({ message: "Attachment file is required." });
  }

  const countValidationError = getAttachmentsCountValidationError(
    uploadedFiles.length,
  );

  if (countValidationError) {
    return res.status(400).json({ message: countValidationError });
  }

  const fileValidationError = uploadedFiles
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
    uploadedFiles,
  );

  if (totalSizeValidationError) {
    return res.status(400).json({ message: totalSizeValidationError });
  }

  const attachments = [];

  try {
    for (const file of uploadedFiles) {
      const uploadResponse = await uploadBufferToCloudinary(file.buffer, {
        folder: MESSAGE_ATTACHMENT_FOLDER,
        resource_type: "auto",
      });

      attachments.push(buildCloudinaryAttachmentMetadata(uploadResponse, file));
    }

    return res.status(201).json({
      attachments,
      attachment: attachments[0] || null,
    });
  } catch (error) {
    await cleanupUploadedAttachments(attachments);
    console.log("Error in uploadMessageAttachments controller:", error.message);
    return res.status(500).json({ message: "Failed to upload attachments." });
  }
};

export const removePendingMessageAttachment = async (req, res) => {
  try {
    const { storageKey, resourceType, mimeType } = req.body ?? {};
    const normalizedStorageKey =
      typeof storageKey === "string" ? storageKey.trim() : "";

    if (!isCloudinaryAttachmentStorageKey(normalizedStorageKey)) {
      return res.status(400).json({ message: "Invalid attachment storage key." });
    }

    const destroyResult = await destroyCloudinaryAsset(normalizedStorageKey, {
      resource_type: normalizeCloudinaryResourceType(resourceType, mimeType),
    });

    return res.status(200).json({
      result: destroyResult?.result || "ok",
    });
  } catch (error) {
    console.log(
      "Error in removePendingMessageAttachment controller:",
      error.message,
    );
    return res
      .status(500)
      .json({ message: "Failed to remove uploaded attachment." });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, attachments } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const senderSocketIdToSkip = req.headers["x-socket-id"];
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

    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }

    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let attachmentsToSave = normalizedAttachments;
    let imageUrl = getFirstImageAttachmentUrl(attachmentsToSave);

    if (legacyImagePayload) {
      const uploadResponse = await cloudinary.uploader.upload(legacyImagePayload);
      const legacyMimeType =
        getBase64MimeType(legacyImagePayload) ||
        `image/${uploadResponse.format || "jpeg"}`;

      attachmentsToSave = [
        buildCloudinaryAttachmentMetadata(uploadResponse, {
          originalname: `${LEGACY_IMAGE_NAME}.${uploadResponse.format || "jpg"}`,
          mimetype: legacyMimeType,
          size: uploadResponse.bytes,
          resourceType: getCloudinaryResourceTypeForMimeType(legacyMimeType),
        }),
      ];
      imageUrl = attachmentsToSave[0].url;
    }

    const totalSizeValidationError =
      getAttachmentsTotalSizeValidationError(attachmentsToSave);

    if (totalSizeValidationError) {
      return res.status(400).json({ message: totalSizeValidationError });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: trimmedText || undefined,
      image: imageUrl,
      attachments: attachmentsToSave.length > 0 ? attachmentsToSave : undefined,
    });

    await newMessage.save();

    const receiverSocketIds = getReceiverSocketIds(receiverId);
    receiverSocketIds.forEach((socketId) => {
      io.to(socketId).emit("newMessage", newMessage);
    });

    const senderSocketIds = getReceiverSocketIds(senderId.toString()).filter(
      (socketId) => socketId !== senderSocketIdToSkip,
    );
    senderSocketIds.forEach((socketId) => {
      io.to(socketId).emit("newMessage", newMessage);
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });
    const partnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString(),
        ),
      ),
    ];
    const partners = await User.find({ _id: { $in: partnerIds } }).select(
      "-password",
    );
    res.status(200).json(partners);
  } catch (error) {
    console.log("Error in getChatPartners", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

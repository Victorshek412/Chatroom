import cloudinary, { uploadBufferToCloudinary } from "../lib/cloudinary.js";
import {
  buildCloudinaryAttachmentMetadata,
  getAttachmentValidationError,
  isAllowedAttachmentMimeType,
  MESSAGE_ATTACHMENT_FOLDER,
  normalizeAttachmentMetadata,
} from "../lib/messageAttachments.js";
import { getReceiverSocketIds, io } from "../lib/socket.js";
import { listAcceptedFriendsForUser } from "../lib/friendships.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const LEGACY_IMAGE_NAME = "shared-image";

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

export const getAllContacts = async (req, res) => {
  try {
    const acceptedFriends = await listAcceptedFriendsForUser(req.user._id);
    res.status(200).json(acceptedFriends);
  } catch (error) {
    console.log("Error in getAllContacts", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const getMessageByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatID } = req.params; // get the user id of the person I want to chat with
    //{id:userToChatID} is destructuring the id parameter from the request parameters and renaming it to userToChatID for clarity in the code.
    //req.params is an object containing properties mapped to the named route parameters. In this case, it extracts the id parameter from the URL and assigns it to userToChatID.

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
export const uploadMessageAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Attachment file is required." });
    }

    if (!isAllowedAttachmentMimeType(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Only images and PDF files are allowed." });
    }

    const uploadResponse = await uploadBufferToCloudinary(req.file.buffer, {
      folder: MESSAGE_ATTACHMENT_FOLDER,
      resource_type: "auto",
    });

    const attachment = buildCloudinaryAttachmentMetadata(uploadResponse, req.file);

    return res.status(201).json({ attachment });
  } catch (error) {
    console.log("Error in uploadMessageAttachment controller:", error.message);
    return res.status(500).json({ message: "Failed to upload attachment." });
  }
};
export const sendMessage = async (req, res) => {
  try {
    //1. get the message text and image from the request body
    //2. get the receiver id from the request parameters
    //3. get the sender id from the logged in user (req.user)
    const { text, image, attachments } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const senderSocketIdToSkip = req.headers["x-socket-id"];
    const trimmedText = getTrimmedText(text);
    const legacyImagePayload =
      typeof image === "string" ? image.trim() : "";
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
    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    let attachmentsToSave = normalizedAttachments;
    //4. if there is an image, upload it to cloudinary and get the secure URL
    if (legacyImagePayload) {
      //upload base64 image to cloudinary and get the URL
      const uploadResponse = await cloudinary.uploader.upload(legacyImagePayload);
      imageUrl = uploadResponse.secure_url;

      const legacyMimeType =
        getBase64MimeType(legacyImagePayload) ||
        `image/${uploadResponse.format || "jpeg"}`;

      attachmentsToSave = [
        buildCloudinaryAttachmentMetadata(uploadResponse, {
          originalname: `${LEGACY_IMAGE_NAME}.${uploadResponse.format || "jpg"}`,
          mimetype: legacyMimeType,
          size: uploadResponse.bytes,
        }),
      ];
    } else if (attachmentsToSave[0]?.kind === "image") {
      imageUrl = attachmentsToSave[0].url;
    }
    //5. create a new message document in the database with the sender id, receiver id, text, and image URL (if any)
    const newMessage = new Message({
      senderId,
      receiverId,
      text: trimmedText || undefined,
      image: imageUrl,
      attachments: attachmentsToSave.length > 0 ? attachmentsToSave : undefined,
    });
    await newMessage.save(); // Save the new message document to the database
    // what is await ? The await keyword is used to wait for a Promise to resolve. In this case, it waits for the save() method to complete before proceeding to the next line of code. This ensures that the message is saved to the database before sending the response back to the client.
    // what if we don't use await ? If we don't use await, the code will continue executing without waiting for the save() method to complete. This means that the response could be sent back to the client before the message is actually saved in the database, which could lead to inconsistencies and errors in the application.
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
    //6. return the created message in the response with a 201 status code
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

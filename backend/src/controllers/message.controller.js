import {
  uploadAssetToCloudinary,
  uploadBufferToCloudinary,
} from "../lib/cloudinary.js";
import {
  buildCloudinaryAttachmentMetadata,
  getAttachmentValidationError,
  isAllowedAttachmentMimeType,
  MESSAGE_ATTACHMENT_FOLDER,
  normalizeAttachmentMetadata,
} from "../lib/messageAttachments.js";
import { listAcceptedFriendsForUser } from "../lib/friendships.js";
import { getReceiverSocketIds, io } from "../lib/socket.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const LEGACY_IMAGE_NAME = "shared-image";
const GROUP_MEMBER_SELECT = "fullName profilePicture friendId";
const MESSAGE_REPLY_SELECT = "senderId text image attachments createdAt";

const getTrimmedText = (value) =>
  typeof value === "string" ? value.trim() : "";

const toComparableId = (value) => value?.toString?.() ?? String(value ?? "");

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

const buildLatestMessageByPartnerId = (loggedInUserId, messages) =>
  messages.reduce((latestMessageByPartnerId, message) => {
    const partnerId =
      message.senderId.toString() === loggedInUserId.toString()
        ? message.receiverId.toString()
        : message.senderId.toString();

    latestMessageByPartnerId.set(partnerId, message);
    return latestMessageByPartnerId;
  }, new Map());

const buildLatestMessageByGroupId = (messages) =>
  messages.reduce((latestMessageByGroupId, message) => {
    if (!message.groupId) {
      return latestMessageByGroupId;
    }

    latestMessageByGroupId.set(message.groupId.toString(), message);
    return latestMessageByGroupId;
  }, new Map());

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value ?? {}, key);

const getGroupMemberIds = (group) =>
  (Array.isArray(group?.memberIds) ? group.memberIds : [])
    .map((member) => toComparableId(member?._id ?? member))
    .filter(Boolean);

const getGroupAdminIds = (group) =>
  (Array.isArray(group?.adminIds) ? group.adminIds : [])
    .map((adminId) => toComparableId(adminId))
    .filter(Boolean);

const getGroupOwnerId = (group) =>
  toComparableId(group?.ownerId ?? group?.createdBy);

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

const serializeGroupMember = (group, user) =>
  user
    ? {
        _id: user._id,
        fullName: user.fullName,
        profilePicture: user.profilePicture || "",
        friendId: user.friendId,
        role: getGroupRole(group, user._id),
      }
    : null;

const serializeGroupForUser = (group, _currentUserId, latestMessage = null) => {
  const members = Array.isArray(group?.memberIds) ? group.memberIds : [];

  return {
    _id: group._id,
    kind: "group",
    name: group.name,
    avatarUrl: group.avatarUrl || "",
    ownerId: getGroupOwnerId(group),
    adminIds: getGroupAdminIds(group),
    members: members.map((member) => serializeGroupMember(group, member)).filter(Boolean),
    memberCount: members.length,
    createdAt: group.createdAt,
    latestMessage,
  };
};

const serializeReplyTarget = (message) => {
  if (!message) {
    return null;
  }

  return {
    _id: message._id,
    senderId: message.senderId,
    text: message.text || "",
    image: message.image || "",
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    createdAt: message.createdAt,
  };
};

const serializeMessage = (message) => {
  if (!message) {
    return null;
  }

  const messageObject = typeof message.toObject === "function"
    ? message.toObject()
    : message;

  return {
    ...messageObject,
    replyTo: serializeReplyTarget(messageObject.replyTo),
    isPinned: Boolean(messageObject.pinnedAt),
  };
};

const populateMessageReply = (query) =>
  query.populate({
    path: "replyTo",
    select: MESSAGE_REPLY_SELECT,
  });

const emitToUserSockets = (userId, eventName, payload, skipSocketId = null) => {
  getReceiverSocketIds(userId)
    .filter((socketId) => socketId !== skipSocketId)
    .forEach((socketId) => {
      io.to(socketId).emit(eventName, payload);
    });
};

const emitGroupCreated = (group, skipSocketId = null) => {
  group.memberIds.forEach((member) => {
    const memberId = toComparableId(member?._id ?? member);
    emitToUserSockets(
      memberId,
      "groupCreated",
      serializeGroupForUser(group, memberId, null),
      skipSocketId,
    );
  });
};

const emitGroupUpdated = (group, latestMessage = null, skipSocketId = null) => {
  group.memberIds.forEach((member) => {
    const memberId = toComparableId(member?._id ?? member);
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
  group.memberIds.forEach((member) => {
    const memberId = toComparableId(member?._id ?? member);
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

const emitDirectMessageUpdate = (message, skipSocketId = null) => {
  const participantIds = [
    toComparableId(message?.senderId),
    toComparableId(message?.receiverId),
  ].filter(Boolean);

  Array.from(new Set(participantIds)).forEach((participantId) => {
    emitToUserSockets(participantId, "messageUpdated", message, skipSocketId);
  });
};

const emitGroupMessageUpdate = (group, message, skipSocketId = null) => {
  group.memberIds.forEach((member) => {
    const memberId = toComparableId(member?._id ?? member);
    emitToUserSockets(
      memberId,
      "groupMessageUpdated",
      {
        groupId: toComparableId(group._id),
        message,
      },
      skipSocketId,
    );
  });
};

const buildMessageContent = async ({ text, image, attachments }) => {
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

  let imageUrl;
  let attachmentsToSave = normalizedAttachments;

  if (legacyImagePayload) {
    const uploadResponse = await uploadAssetToCloudinary(legacyImagePayload);
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

  return {
    text: trimmedText || undefined,
    image: imageUrl,
    attachments: attachmentsToSave.length > 0 ? attachmentsToSave : undefined,
  };
};

const loadLatestMessageForGroup = (groupId) =>
  Message.findOne({ groupId }).sort({ createdAt: -1, _id: -1 });

const loadGroupForMember = async (groupId, userId) =>
  Group.findOne({ _id: groupId, memberIds: userId }).populate(
    "memberIds",
    GROUP_MEMBER_SELECT,
  );

const loadPopulatedGroup = (groupId) =>
  Group.findById(groupId).populate("memberIds", GROUP_MEMBER_SELECT);

const loadAndEmitGroupUpdate = async (groupId, userId, skipSocketId = null) => {
  const [populatedGroup, latestMessage] = await Promise.all([
    loadPopulatedGroup(groupId),
    loadLatestMessageForGroup(groupId),
  ]);

  emitGroupUpdated(populatedGroup, latestMessage, skipSocketId);

  return {
    populatedGroup,
    latestMessage,
    serializedGroup: serializeGroupForUser(populatedGroup, userId, latestMessage),
  };
};

const loadSerializedMessageById = async (messageId) => {
  const message = await populateMessageReply(Message.findById(messageId));
  return serializeMessage(message);
};

const resolveDirectReplyTarget = (replyMessageId, senderId, receiverId) =>
  Message.findOne({
    _id: replyMessageId,
    groupId: null,
    $or: [
      { senderId, receiverId },
      { senderId: receiverId, receiverId: senderId },
    ],
  });

const resolveGroupReplyTarget = (replyMessageId, groupId) =>
  Message.findOne({
    _id: replyMessageId,
    groupId,
  });

const resolveReplyTarget = async ({
  replyToMessageId,
  senderId,
  receiverId = null,
  groupId = null,
}) => {
  const comparableReplyId = toComparableId(replyToMessageId);
  if (!comparableReplyId) {
    return { replyTo: null };
  }

  const replyTarget = groupId
    ? await resolveGroupReplyTarget(comparableReplyId, groupId)
    : await resolveDirectReplyTarget(comparableReplyId, senderId, receiverId);

  if (!replyTarget) {
    return { error: "Reply target was not found in this conversation." };
  }

  return { replyTo: replyTarget._id };
};

const loadAccessibleMessageForUser = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    return { error: "Message not found." };
  }

  if (message.groupId) {
    const group = await loadGroupForMember(message.groupId, userId);
    if (!group) {
      return { error: "Message not found." };
    }

    return { message, group };
  }

  const comparableUserId = toComparableId(userId);
  const isConversationParticipant =
    comparableUserId === toComparableId(message.senderId) ||
    comparableUserId === toComparableId(message.receiverId);

  if (!isConversationParticipant) {
    return { error: "Message not found." };
  }

  return { message, group: null };
};

const resolveGroupAvatarUrl = async (avatar) => {
  if (avatar == null) {
    return "";
  }

  if (typeof avatar !== "string") {
    throw new Error("Invalid group avatar.");
  }

  const trimmedAvatar = avatar.trim();
  if (!trimmedAvatar) {
    return "";
  }

  if (!trimmedAvatar.startsWith("data:")) {
    throw new Error("Invalid group avatar.");
  }

  const uploadResponse = await uploadAssetToCloudinary(trimmedAvatar);
  return uploadResponse.secure_url;
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
    const { id: userToChatId } = req.params;

    const messages = await populateMessageReply(Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1, _id: 1 }));

    res.status(200).json(messages.map(serializeMessage));
  } catch (error) {
    console.log("Error in getMessageByUserId", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessagesByGroupId = async (req, res) => {
  try {
    const group = await loadGroupForMember(req.params.id, req.user._id);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const messages = await populateMessageReply(Message.find({ groupId: group._id }).sort({
      createdAt: 1,
      _id: 1,
    }));

    return res.status(200).json(messages.map(serializeMessage));
  } catch (error) {
    console.log("Error in getMessagesByGroupId", error);
    return res.status(500).json({ message: "Internal Server Error" });
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
    console.error("Error in uploadMessageAttachment controller:", error);

    if (error.message?.startsWith("Cloudinary is not configured.")) {
      return res.status(503).json({
        message: "Attachment uploads are temporarily unavailable.",
      });
    }

    return res.status(500).json({ message: "Failed to upload attachment." });
  }
};

export const createGroup = async (req, res) => {
  try {
    const trimmedName = getTrimmedText(req.body?.name);
    const creatorId = req.user._id;
    const creatorIdString = toComparableId(creatorId);
    const invitedMemberIds = Array.from(
      new Set(
        (Array.isArray(req.body?.memberIds) ? req.body.memberIds : [])
          .map(toComparableId)
          .filter((memberId) => memberId && memberId !== creatorIdString),
      ),
    );

    if (!trimmedName) {
      return res.status(400).json({ message: "Group name is required." });
    }

    if (invitedMemberIds.length === 0) {
      return res.status(400).json({ message: "Select at least one member." });
    }

    const acceptedFriends = await listAcceptedFriendsForUser(creatorId);
    const acceptedFriendIds = new Set(
      acceptedFriends.map((friend) => toComparableId(friend._id)),
    );

    if (invitedMemberIds.some((memberId) => !acceptedFriendIds.has(memberId))) {
      return res.status(400).json({
        message: "You can only create groups with accepted friends.",
      });
    }

    const invitedUsers = await User.find({
      _id: { $in: invitedMemberIds },
    }).select(GROUP_MEMBER_SELECT);

    if (invitedUsers.length !== invitedMemberIds.length) {
      return res.status(404).json({ message: "One or more group members were not found." });
    }

    const group = await Group.create({
      name: trimmedName,
      avatarUrl: "",
      createdBy: creatorId,
      ownerId: creatorId,
      adminIds: [],
      memberIds: [creatorId, ...invitedUsers.map((user) => user._id)],
    });

    const populatedGroup = await Group.findById(group._id).populate(
      "memberIds",
      GROUP_MEMBER_SELECT,
    );

    emitGroupCreated(populatedGroup, req.headers["x-socket-id"]);

    return res.status(201).json(
      serializeGroupForUser(populatedGroup, creatorId, null),
    );
  } catch (error) {
    console.log("Error in createGroup", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const group = await loadGroupForMember(req.params.id, userId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!isGroupAdmin(group, userId)) {
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
      try {
        group.avatarUrl = await resolveGroupAvatarUrl(req.body?.avatar);
      } catch (error) {
        return res.status(400).json({ message: error.message || "Invalid group avatar." });
      }
    }

    await group.save();

    const { serializedGroup } = await loadAndEmitGroupUpdate(
      group._id,
      userId,
      req.headers["x-socket-id"],
    );

    return res.status(200).json(serializedGroup);
  } catch (error) {
    console.log("Error in updateGroup", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = toComparableId(userId);
    const group = await loadGroupForMember(req.params.id, userId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!isGroupAdmin(group, userId)) {
      return res.status(403).json({ message: "Only administrators can manage this group." });
    }

    const existingMemberIds = getGroupMemberIds(group);
    const requestedMemberIds = Array.from(
      new Set(
        (Array.isArray(req.body?.memberIds) ? req.body.memberIds : [])
          .map(toComparableId)
          .filter(Boolean),
      ),
    );
    const nextMemberIdsToAdd = requestedMemberIds.filter(
      (memberId) => !existingMemberIds.includes(memberId),
    );

    if (nextMemberIdsToAdd.length === 0) {
      return res.status(400).json({ message: "Select at least one new member." });
    }

    const acceptedFriends = await listAcceptedFriendsForUser(userId);
    const acceptedFriendIds = new Set(
      acceptedFriends.map((friend) => toComparableId(friend._id)),
    );

    if (nextMemberIdsToAdd.some((memberId) => !acceptedFriendIds.has(memberId))) {
      return res.status(400).json({
        message: "You can only add accepted friends to this group.",
      });
    }

    if (nextMemberIdsToAdd.includes(userIdString)) {
      return res.status(400).json({ message: "You are already in this group." });
    }

    const nextUsers = await User.find({
      _id: { $in: nextMemberIdsToAdd },
    }).select(GROUP_MEMBER_SELECT);

    if (nextUsers.length !== nextMemberIdsToAdd.length) {
      return res.status(404).json({ message: "One or more group members were not found." });
    }

    group.memberIds = [...existingMemberIds, ...nextMemberIdsToAdd];
    await group.save();

    const { serializedGroup } = await loadAndEmitGroupUpdate(
      group._id,
      userId,
      req.headers["x-socket-id"],
    );

    return res.status(200).json(serializedGroup);
  } catch (error) {
    console.log("Error in addGroupMembers", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const promoteGroupMember = async (req, res) => {
  try {
    const userId = req.user._id;
    const group = await loadGroupForMember(req.params.id, userId);
    const targetMemberId = toComparableId(req.params.memberId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!isGroupAdmin(group, userId)) {
      return res.status(403).json({ message: "Only administrators can manage this group." });
    }

    if (!getGroupMemberIds(group).includes(targetMemberId)) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (isGroupAdmin(group, targetMemberId)) {
      const { serializedGroup } = await loadAndEmitGroupUpdate(
        group._id,
        userId,
        req.headers["x-socket-id"],
      );
      return res.status(200).json(serializedGroup);
    }

    group.adminIds = normalizeGroupAdminIds(
      getGroupMemberIds(group),
      [...getGroupAdminIds(group), targetMemberId],
      getGroupOwnerId(group),
    );
    await group.save();

    const { serializedGroup } = await loadAndEmitGroupUpdate(
      group._id,
      userId,
      req.headers["x-socket-id"],
    );

    return res.status(200).json(serializedGroup);
  } catch (error) {
    console.log("Error in promoteGroupMember", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const demoteGroupMember = async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = toComparableId(userId);
    const group = await loadGroupForMember(req.params.id, userId);
    const targetMemberId = toComparableId(req.params.memberId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!isGroupAdmin(group, userId)) {
      return res.status(403).json({ message: "Only administrators can manage this group." });
    }

    if (!getGroupMemberIds(group).includes(targetMemberId)) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (targetMemberId === userIdString) {
      return res.status(400).json({ message: "You cannot change your own administrator role here." });
    }

    if (!isGroupAdmin(group, targetMemberId)) {
      const { serializedGroup } = await loadAndEmitGroupUpdate(
        group._id,
        userId,
        req.headers["x-socket-id"],
      );
      return res.status(200).json(serializedGroup);
    }

    const nextOwnerId =
      getGroupOwnerId(group) === targetMemberId
        ? null
        : getGroupOwnerId(group);

    applyGroupMembershipState(
      group,
      getGroupMemberIds(group),
      getGroupAdminIds(group).filter((adminId) => adminId !== targetMemberId),
      nextOwnerId,
    );
    await group.save();

    const { serializedGroup } = await loadAndEmitGroupUpdate(
      group._id,
      userId,
      req.headers["x-socket-id"],
    );

    return res.status(200).json(serializedGroup);
  } catch (error) {
    console.log("Error in demoteGroupMember", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = toComparableId(userId);
    const group = await loadGroupForMember(req.params.id, userId);
    const targetMemberId = toComparableId(req.params.memberId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!isGroupAdmin(group, userId)) {
      return res.status(403).json({ message: "Only administrators can manage this group." });
    }

    if (targetMemberId === userIdString) {
      return res.status(400).json({ message: "Use leave group to remove yourself." });
    }

    const memberIds = getGroupMemberIds(group);
    if (!memberIds.includes(targetMemberId)) {
      return res.status(404).json({ message: "Member not found." });
    }

    const remainingMemberIds = memberIds.filter((memberId) => memberId !== targetMemberId);
    const leadership = applyGroupMembershipState(
      group,
      remainingMemberIds,
      getGroupAdminIds(group).filter((adminId) => adminId !== targetMemberId),
      getGroupOwnerId(group),
    );

    if (leadership.shouldDelete) {
      await Promise.all([
        Message.deleteMany({ groupId: group._id }),
        Group.deleteOne({ _id: group._id }),
      ]);

      emitGroupRemoved(memberIds, group._id, req.headers["x-socket-id"]);

      return res.status(200).json({
        groupId: toComparableId(group._id),
        deleted: true,
      });
    }

    await group.save();

    const { serializedGroup } = await loadAndEmitGroupUpdate(
      group._id,
      userId,
      req.headers["x-socket-id"],
    );

    emitGroupRemoved([targetMemberId], group._id, req.headers["x-socket-id"]);

    return res.status(200).json(serializedGroup);
  } catch (error) {
    console.log("Error in removeGroupMember", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = toComparableId(userId);
    const group = await loadGroupForMember(req.params.id, userId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const memberIds = getGroupMemberIds(group);
    const remainingMemberIds = memberIds.filter((memberId) => memberId !== userIdString);

    if (remainingMemberIds.length === 0) {
      await Promise.all([
        Message.deleteMany({ groupId: group._id }),
        Group.deleteOne({ _id: group._id }),
      ]);

      emitGroupRemoved(memberIds, group._id, req.headers["x-socket-id"]);

      return res.status(200).json({
        groupId: toComparableId(group._id),
        deleted: true,
      });
    }

    applyGroupMembershipState(
      group,
      remainingMemberIds,
      getGroupAdminIds(group).filter((adminId) => adminId !== userIdString),
      getGroupOwnerId(group),
    );
    await group.save();

    await loadAndEmitGroupUpdate(
      group._id,
      userId,
      req.headers["x-socket-id"],
    );
    emitGroupRemoved([userIdString], group._id, req.headers["x-socket-id"]);

    return res.status(200).json({
      groupId: toComparableId(group._id),
      deleted: false,
    });
  } catch (error) {
    console.log("Error in leaveGroup", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const group = await loadGroupForMember(req.params.id, userId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (!isGroupAdmin(group, userId)) {
      return res.status(403).json({ message: "Only administrators can delete this group." });
    }

    const memberIds = getGroupMemberIds(group);

    await Promise.all([
      Message.deleteMany({ groupId: group._id }),
      Group.deleteOne({ _id: group._id }),
    ]);

    emitGroupRemoved(memberIds, group._id, req.headers["x-socket-id"]);

    return res.status(200).json({ groupId: toComparableId(group._id) });
  } catch (error) {
    console.log("Error in deleteGroup", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const senderSocketIdToSkip = req.headers["x-socket-id"];

    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }

    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    const messageContent = await buildMessageContent(req.body);
    if (messageContent.error) {
      return res.status(400).json({ message: messageContent.error });
    }

    const { replyTo, error: replyError } = await resolveReplyTarget({
      replyToMessageId: req.body?.replyToMessageId,
      senderId,
      receiverId,
    });
    if (replyError) {
      return res.status(400).json({ message: replyError });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      replyTo,
      ...messageContent,
    });

    await newMessage.save();
    const serializedMessage = await loadSerializedMessageById(newMessage._id);

    emitToUserSockets(receiverId, "newMessage", serializedMessage);
    emitToUserSockets(
      senderId.toString(),
      "newMessage",
      serializedMessage,
      senderSocketIdToSkip,
    );

    return res.status(201).json(serializedMessage);
  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const senderSocketIdToSkip = req.headers["x-socket-id"];
    const group = await loadGroupForMember(req.params.id, senderId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const messageContent = await buildMessageContent(req.body);
    if (messageContent.error) {
      return res.status(400).json({ message: messageContent.error });
    }

    const { replyTo, error: replyError } = await resolveReplyTarget({
      replyToMessageId: req.body?.replyToMessageId,
      senderId,
      groupId: group._id,
    });
    if (replyError) {
      return res.status(400).json({ message: replyError });
    }

    const newMessage = new Message({
      senderId,
      groupId: group._id,
      replyTo,
      ...messageContent,
    });

    await newMessage.save();
    group.updatedAt = new Date();
    await group.save();
    const serializedMessage = await loadSerializedMessageById(newMessage._id);

    emitGroupMessage(group, serializedMessage, senderSocketIdToSkip);

    return res.status(201).json({
      group: serializeGroupForUser(group, senderId, serializedMessage),
      message: serializedMessage,
    });
  } catch (error) {
    console.log("Error in sendGroupMessage", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const toggleMessagePin = async (req, res) => {
  try {
    const userId = req.user._id;
    const senderSocketIdToSkip = req.headers["x-socket-id"];
    const { messageId } = req.params;
    const { message, group, error } = await loadAccessibleMessageForUser(messageId, userId);

    if (error) {
      return res.status(404).json({ message: error });
    }

    const isPinned = Boolean(message.pinnedAt);
    message.pinnedAt = isPinned ? null : new Date();
    message.pinnedById = isPinned ? null : userId;
    await message.save();

    const serializedMessage = await loadSerializedMessageById(message._id);

    if (group) {
      emitGroupMessageUpdate(group, serializedMessage, senderSocketIdToSkip);
    } else {
      emitDirectMessageUpdate(serializedMessage, senderSocketIdToSkip);
    }

    return res.status(200).json(serializedMessage);
  } catch (error) {
    console.log("Error in toggleMessagePin", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const messages = await Message.find({
      $or: [
        {
          senderId: loggedInUserId,
          receiverId: { $exists: true, $ne: null },
        },
        { receiverId: loggedInUserId },
      ],
    }).sort({ createdAt: 1, _id: 1 });

    const latestMessageByPartnerId = buildLatestMessageByPartnerId(
      loggedInUserId,
      messages,
    );

    const partnerIds = [
      ...new Set(
        messages.map((message) =>
          message.senderId.toString() === loggedInUserId.toString()
            ? message.receiverId.toString()
            : message.senderId.toString(),
        ),
      ),
    ];

    const partners = await User.find({ _id: { $in: partnerIds } }).select(
      "-password",
    );

    return res.status(200).json(
      partners.map((partner) => ({
        ...partner.toObject(),
        latestMessage:
          latestMessageByPartnerId.get(partner._id.toString()) || null,
      })),
    );
  } catch (error) {
    console.log("Error in getChatPartners", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ memberIds: req.user._id })
      .populate("memberIds", GROUP_MEMBER_SELECT)
      .sort({ updatedAt: -1, _id: -1 });

    const groupIds = groups.map((group) => group._id);
    const groupMessages = groupIds.length
      ? await Message.find({ groupId: { $in: groupIds } }).sort({
        createdAt: 1,
        _id: 1,
      })
      : [];

    const latestMessageByGroupId = buildLatestMessageByGroupId(groupMessages);
    const serializedGroups = groups
      .map((group) =>
        serializeGroupForUser(
          group,
          req.user._id,
          latestMessageByGroupId.get(group._id.toString()) || null,
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

    return res.status(200).json(serializedGroups);
  } catch (error) {
    console.log("Error in getMyGroups", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

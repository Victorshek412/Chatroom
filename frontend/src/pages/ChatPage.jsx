import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import AddContactModal from "../components/AddContactModal";
import AddGroupMembersModal from "../components/AddGroupMembersModal";
import ChangeGroupAvatarModal from "../components/ChangeGroupAvatarModal";
import ConfirmGroupActionModal from "../components/ConfirmGroupActionModal";
import CreateGroupModal from "../components/CreateGroupModal";
import CreateGroupSuccessModal from "../components/CreateGroupSuccessModal";
import GroupMembersModal from "../components/GroupMembersModal";
import RenameGroupModal from "../components/RenameGroupModal";
import RequestDrawer from "../components/RequestDrawer";
import {
  getListTimeLabel,
  getMessagePreview,
  getUnifiedAttachment,
} from "../lib/chatActivity";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";

const CHAT_UI_BASE_WIDTH = 1024;
const CHAT_UI_BASE_HEIGHT = 700;
const CHAT_UI_MAX_SCALE = 1.1;

const normalizeId = (value) => value?.toString?.() ?? String(value ?? "");

const getChatUiScale = () => {
  if (typeof window === "undefined") {
    return 1;
  }

  const viewportPadding = window.innerWidth >= 768 ? 64 : 32;
  const maxScaleByWidth =
    (window.innerWidth - viewportPadding) / CHAT_UI_BASE_WIDTH;
  const maxScaleByHeight =
    (window.innerHeight - viewportPadding) / CHAT_UI_BASE_HEIGHT;

  return Math.max(
    1,
    Math.min(CHAT_UI_MAX_SCALE, maxScaleByWidth, maxScaleByHeight),
  );
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

const getAvatarUrl = (user) => user?.profilePicture || user?.avatarUrl || "";

const getActivityTimestamp = (value) =>
  new Date(value || 0).getTime();

const getPreviewWithSenderPrefix = ({
  previewText,
  senderId,
  currentUserId,
}) => {
  if (!previewText || previewText === "Start the conversation") {
    return previewText || "Start the conversation";
  }

  return normalizeId(senderId) === normalizeId(currentUserId)
    ? `You: ${previewText}`
    : previewText;
};

const getGroupActivityTimestamp = (group) =>
  getActivityTimestamp(group?.latestMessage?.createdAt || group?.createdAt);

const sortChatItemsByActivity = (items) =>
  [...items].sort(
    (firstItem, secondItem) =>
      (secondItem.activityTimestamp || 0) - (firstItem.activityTimestamp || 0),
  );

const sortGroupsByActivity = (groups) =>
  [...groups].sort(
    (firstGroup, secondGroup) =>
      getGroupActivityTimestamp(secondGroup) - getGroupActivityTimestamp(firstGroup),
  );

const upsertGroup = (groups, nextGroup, { preservePosition = false } = {}) => {
  const nextGroupId = normalizeId(nextGroup?._id ?? nextGroup?.id);
  if (!nextGroupId) {
    return groups;
  }

  const existingIndex = groups.findIndex(
    (group) => normalizeId(group?._id ?? group?.id) === nextGroupId,
  );

  if (existingIndex === -1) {
    return sortGroupsByActivity([nextGroup, ...groups]);
  }

  const nextGroups = [...groups];
  const existingGroup = nextGroups[existingIndex];
  const mergedGroup = {
    ...existingGroup,
    ...nextGroup,
  };

  if (preservePosition) {
    nextGroups[existingIndex] = mergedGroup;
    return nextGroups;
  }

  nextGroups.splice(existingIndex, 1);

  return sortGroupsByActivity([mergedGroup, ...nextGroups]);
};

const removeGroup = (groups, groupId) =>
  groups.filter(
    (group) => normalizeId(group?._id ?? group?.id) !== normalizeId(groupId),
  );

const isUserGroupAdmin = (group, userId) => {
  const comparableUserId = normalizeId(userId);
  if (!comparableUserId) {
    return false;
  }

  return (
    normalizeId(group?.ownerId) === comparableUserId ||
    (Array.isArray(group?.adminIds) ? group.adminIds : []).some(
      (adminId) => normalizeId(adminId) === comparableUserId,
    )
  );
};

const upsertConversationMessage = (messages, nextMessage) => {
  const nextMessageId = normalizeId(nextMessage?._id ?? nextMessage?.id);
  if (!nextMessageId) {
    return messages;
  }

  const existingIndex = messages.findIndex(
    (message) => normalizeId(message?._id ?? message?.id) === nextMessageId,
  );

  if (existingIndex === -1) {
    return [...messages, nextMessage];
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = {
    ...nextMessages[existingIndex],
    ...nextMessage,
  };
  return nextMessages;
};

function ChatPage() {
  const {
    authUser,
    onlineUsers,
    logout,
    updateProfile,
    socket,
  } = useAuthStore();
  const {
    activeTab,
    setActiveTab,
    chats,
    messages,
    selectedUser,
    chatActivityByUserId,
    unreadCountsByUserId,
    isUsersLoading,
    isMessagesLoading,
    isSoundEnabled,
    getMyChatPartners,
    getMessagesByUserId,
    sendMessage,
    setSelectedUser,
    subscribeToMessages,
    toggleSound,
    unsubscribeFromMessages,
    uploadMessageAttachment,
  } = useChatStore();
  const {
    friends,
    incomingRequests,
    isFriendsLoading,
    fetchAcceptedFriends,
    fetchIncomingRequests,
    fetchOutgoingRequests,
  } = useFriendStore();

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [isGroupMessagesLoading, setIsGroupMessagesLoading] = useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [isRequestDrawerOpen, setIsRequestDrawerOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);
  const [isAddGroupMembersModalOpen, setIsAddGroupMembersModalOpen] = useState(false);
  const [isRenameGroupModalOpen, setIsRenameGroupModalOpen] = useState(false);
  const [isChangeGroupAvatarModalOpen, setIsChangeGroupAvatarModalOpen] = useState(false);
  const [groupConfirmationAction, setGroupConfirmationAction] = useState(null);
  const [isGroupActionSubmitting, setIsGroupActionSubmitting] = useState(false);
  const [groupSuccessData, setGroupSuccessData] = useState(null);
  const [groupUnreadById, setGroupUnreadById] = useState({});
  const [chatUiScale, setChatUiScale] = useState(() => getChatUiScale());
  const groupMessagesRequestIdRef = useRef(0);

  const closeGroupManagementOverlays = useCallback(() => {
    setIsGroupMembersModalOpen(false);
    setIsAddGroupMembersModalOpen(false);
    setIsRenameGroupModalOpen(false);
    setIsChangeGroupAvatarModalOpen(false);
    setGroupConfirmationAction(null);
    setIsGroupActionSubmitting(false);
  }, []);

  const closeActiveConversation = useCallback(() => {
    if (!selectedGroupId && !selectedUser) {
      return;
    }

    setSelectedGroupId(null);
    setSelectedUser(null);
    setGroupMessages([]);
    setIsGroupMessagesLoading(false);
    closeGroupManagementOverlays();
  }, [closeGroupManagementOverlays, selectedGroupId, selectedUser, setSelectedUser]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/messages/groups");
      setGroups(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    }
  }, []);

  useEffect(() => {
    setGroups([]);
    setGroupMessages([]);
    setSelectedGroupId(null);
    setGroupSuccessData(null);
    setGroupUnreadById({});
    setIsGroupMessagesLoading(false);
    closeGroupManagementOverlays();
    groupMessagesRequestIdRef.current = 0;
  }, [authUser?._id, closeGroupManagementOverlays]);

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }

    setGroupUnreadById((current) => {
      const comparableGroupId = normalizeId(selectedGroupId);
      if (!current[comparableGroupId]) {
        return current;
      }

      return {
        ...current,
        [comparableGroupId]: 0,
      };
    });
  }, [selectedGroupId]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    getMyChatPartners();
    fetchAcceptedFriends();
    fetchIncomingRequests();
    fetchOutgoingRequests();
    void fetchGroups();
  }, [
    authUser,
    fetchAcceptedFriends,
    fetchGroups,
    fetchIncomingRequests,
    fetchOutgoingRequests,
    getMyChatPartners,
  ]);

  useEffect(() => {
    if (activeTab === "contacts") {
      fetchAcceptedFriends();
    }
  }, [activeTab, fetchAcceptedFriends]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    getMessagesByUserId(selectedUser._id);
  }, [getMessagesByUserId, selectedUser]);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupMessages([]);
      setIsGroupMessagesLoading(false);
      return;
    }

    let isCancelled = false;
    groupMessagesRequestIdRef.current += 1;
    const requestId = groupMessagesRequestIdRef.current;

    setIsGroupMessagesLoading(true);

    const loadGroupMessages = async () => {
      try {
        const res = await axiosInstance.get(`/messages/groups/${selectedGroupId}/messages`);
        if (isCancelled || groupMessagesRequestIdRef.current !== requestId) {
          return;
        }

        setGroupMessages(res.data);
        setIsGroupMessagesLoading(false);
      } catch (error) {
        if (isCancelled || groupMessagesRequestIdRef.current !== requestId) {
          return;
        }

        toast.error(error.response?.data?.message || "Failed to load group messages");
        setIsGroupMessagesLoading(false);
      }
    };

    void loadGroupMessages();

    return () => {
      isCancelled = true;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    const handleResize = () => {
      setChatUiScale(getChatUiScale());
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    subscribeToMessages();

    return () => {
      unsubscribeFromMessages();
    };
  }, [
    socket,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleGroupCreated = (group) => {
      setGroups((current) => upsertGroup(current, group));
    };

    const handleGroupUpdated = (group) => {
      setGroups((current) =>
        upsertGroup(current, group, { preservePosition: true }),
      );
    };

    const handleGroupRemoved = ({ groupId }) => {
      setGroups((current) => removeGroup(current, groupId));
      setGroupUnreadById((current) => {
        const comparableGroupId = normalizeId(groupId);
        if (!Object.prototype.hasOwnProperty.call(current, comparableGroupId)) {
          return current;
        }

        const nextUnreadById = { ...current };
        delete nextUnreadById[comparableGroupId];
        return nextUnreadById;
      });

      if (normalizeId(groupId) === normalizeId(selectedGroupId)) {
        setSelectedGroupId(null);
        setGroupMessages([]);
        setIsGroupMessagesLoading(false);
        closeGroupManagementOverlays();
      }
    };

    const handleGroupMessage = ({ group, message }) => {
      const nextGroupId = normalizeId(group?._id ?? group?.id);
      const isIncomingMessage =
        normalizeId(message?.senderId) !== normalizeId(authUser?._id);

      setGroups((current) => upsertGroup(current, group));
      setGroupUnreadById((current) => {
        if (!nextGroupId || !isIncomingMessage) {
          return current;
        }

        if (nextGroupId === normalizeId(selectedGroupId)) {
          if (!current[nextGroupId]) {
            return current;
          }

          return {
            ...current,
            [nextGroupId]: 0,
          };
        }

        return {
          ...current,
          [nextGroupId]: (current[nextGroupId] || 0) + 1,
        };
      });

      if (nextGroupId && nextGroupId === normalizeId(selectedGroupId)) {
        setGroupMessages((current) => upsertConversationMessage(current, message));
      }
    };

    socket.on("groupCreated", handleGroupCreated);
    socket.on("groupUpdated", handleGroupUpdated);
    socket.on("groupRemoved", handleGroupRemoved);
    socket.on("groupMessage", handleGroupMessage);

    return () => {
      socket.off("groupCreated", handleGroupCreated);
      socket.off("groupUpdated", handleGroupUpdated);
      socket.off("groupRemoved", handleGroupRemoved);
      socket.off("groupMessage", handleGroupMessage);
    };
  }, [authUser?._id, closeGroupManagementOverlays, selectedGroupId, socket]);

  const handleProfileImageUpload = async (base64Image) => {
    if (!base64Image) {
      return;
    }

    await updateProfile({ profilePic: base64Image });
  };

  const handleSelectConversation = (item) => {
    if (item.kind === "group") {
      closeGroupManagementOverlays();
      setGroupUnreadById((current) => ({
        ...current,
        [item.id]: 0,
      }));
      setSelectedGroupId(item.id);
      setSelectedUser(null);
      return;
    }

    closeGroupManagementOverlays();
    setSelectedGroupId(null);
    setSelectedUser(item.rawUser);
  };

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) => normalizeId(group?._id ?? group?.id) === normalizeId(selectedGroupId),
      ) || null,
    [groups, selectedGroupId],
  );

  const isSelectedGroupAdmin =
    Boolean(selectedGroup) &&
    isUserGroupAdmin(selectedGroup, authUser?._id);

  const directMessages = useMemo(() => {
    if (!selectedUser || !authUser) {
      return [];
    }

    return messages.map((message) => {
      const senderId = normalizeId(message.senderId);
      const isOwnMessage = senderId === normalizeId(authUser._id);

      return {
        id: normalizeId(message._id),
        senderId,
        senderName: isOwnMessage ? authUser.fullName : selectedUser.fullName,
        senderAvatarText: getInitials(
          isOwnMessage ? authUser.fullName : selectedUser.fullName,
        ),
        senderAvatarUrl: isOwnMessage
          ? getAvatarUrl(authUser)
          : getAvatarUrl(selectedUser),
        text: message.text || "",
        createdAt: message.createdAt,
        attachment: getUnifiedAttachment(message),
      };
    });
  }, [authUser, messages, selectedUser]);

  const renderedGroupMessages = useMemo(() => {
    if (!selectedGroup || !authUser) {
      return [];
    }

    const authUserId = normalizeId(authUser._id);
    const membersById = new Map(
      (Array.isArray(selectedGroup.members) ? selectedGroup.members : []).map((member) => [
        normalizeId(member._id),
        member,
      ]),
    );

    return groupMessages.map((message) => {
      const senderId = normalizeId(message.senderId);
      const sender = senderId === authUserId ? authUser : membersById.get(senderId);
      const senderName = sender?.fullName || selectedGroup.name;

      return {
        id: normalizeId(message._id),
        senderId,
        senderName,
        senderAvatarText: getInitials(senderName),
        senderAvatarUrl: getAvatarUrl(sender),
        text: message.text || "",
        createdAt: message.createdAt,
        attachment: getUnifiedAttachment(message),
      };
    });
  }, [authUser, groupMessages, selectedGroup]);

  const chatItems = useMemo(() => {
    const onlineUserIds = new Set(onlineUsers.map((id) => normalizeId(id)));

    const groupItems = groups.map((group) => ({
      id: normalizeId(group._id ?? group.id),
      testId: normalizeId(group._id ?? group.id),
      kind: "group",
      title: group.name,
      avatarText: getInitials(group.name),
      avatarUrl: group.avatarUrl || "",
      status: "online",
      previewText: group.latestMessage
        ? getPreviewWithSenderPrefix({
            previewText: getMessagePreview(group.latestMessage),
            senderId: group.latestMessage.senderId,
            currentUserId: authUser?._id,
          })
        : "Group created",
      timeLabel: group.latestMessage
        ? getListTimeLabel(group.latestMessage.createdAt)
        : getListTimeLabel(group.createdAt),
      unreadCount: groupUnreadById[normalizeId(group._id ?? group.id)] || 0,
      activityTimestamp: getGroupActivityTimestamp(group),
      rawGroup: group,
    }));

    const directItems = chats.map((chat) => {
      const chatId = normalizeId(chat._id);
      const cachedPreview = chatActivityByUserId[chatId];
      const isOnline = onlineUserIds.has(chatId);
      const latestActivityAt = cachedPreview?.createdAt || chat.latestMessage?.createdAt || "";

      return {
        id: chatId,
        testId: chatId,
        kind: "direct",
        title: chat.fullName,
        avatarText: getInitials(chat.fullName),
        avatarUrl: getAvatarUrl(chat),
        status: isOnline ? "online" : "offline",
        previewText: getPreviewWithSenderPrefix({
          previewText:
            cachedPreview?.previewText ||
            (chat.latestMessage ? getMessagePreview(chat.latestMessage) : "Start the conversation"),
          senderId: cachedPreview?.senderId || chat.latestMessage?.senderId,
          currentUserId: authUser?._id,
        }),
        timeLabel:
          cachedPreview?.timeLabel ||
          (chat.latestMessage ? getListTimeLabel(chat.latestMessage.createdAt) : ""),
        unreadCount: unreadCountsByUserId[chatId] || 0,
        activityTimestamp: getActivityTimestamp(latestActivityAt),
        rawUser: chat,
      };
    });

    return sortChatItemsByActivity([...groupItems, ...directItems]);
  }, [authUser?._id, chatActivityByUserId, chats, groupUnreadById, groups, onlineUsers, unreadCountsByUserId]);

  const contactItems = useMemo(() => {
    const onlineUserIds = new Set(onlineUsers.map((id) => normalizeId(id)));

    return (friends ?? []).map((friend) => {
      const friendId = normalizeId(friend._id);
      const isOnline = onlineUserIds.has(friendId);

      return {
        id: friendId,
        testId: friendId,
        kind: "direct",
        title: friend.fullName,
        avatarText: getInitials(friend.fullName),
        avatarUrl: getAvatarUrl(friend),
        status: isOnline ? "online" : "offline",
        secondaryText: isOnline ? "online" : "offline",
        rawUser: friend,
      };
    });
  }, [friends, onlineUsers]);

  const activeConversationId =
    selectedGroupId || (selectedUser ? normalizeId(selectedUser._id) : null);
  const sidebarIsLoading = activeTab === "contacts"
    ? isFriendsLoading
    : isUsersLoading;

  const selectedConversation = useMemo(() => {
    if (selectedGroup) {
      const memberCount =
        Number(selectedGroup.memberCount) ||
        (Array.isArray(selectedGroup.members) ? selectedGroup.members.length : 1);

      return {
        id: normalizeId(selectedGroup._id ?? selectedGroup.id),
        kind: "group",
        title: selectedGroup.name,
        avatarText: getInitials(selectedGroup.name),
        avatarUrl: selectedGroup.avatarUrl || "",
        status: "online",
        statusLabel: `${memberCount} member${memberCount === 1 ? "" : "s"}`,
        messages: renderedGroupMessages,
        isLoading: isGroupMessagesLoading,
        isSoundEnabled,
      };
    }

    if (selectedUser && authUser) {
      const isOnline = onlineUsers
        .map((id) => normalizeId(id))
        .includes(normalizeId(selectedUser._id));

      return {
        id: normalizeId(selectedUser._id),
        kind: "direct",
        title: selectedUser.fullName,
        avatarText: getInitials(selectedUser.fullName),
        avatarUrl: getAvatarUrl(selectedUser),
        status: isOnline ? "online" : "offline",
        statusLabel: isOnline ? "online" : "offline",
        messages: directMessages,
        isLoading: isMessagesLoading,
        isSoundEnabled,
      };
    }

    return null;
  }, [
    authUser,
    directMessages,
    isGroupMessagesLoading,
    isMessagesLoading,
    isSoundEnabled,
    onlineUsers,
    renderedGroupMessages,
    selectedGroup,
    selectedUser,
  ]);

  const handleSendConversationMessage = async ({ text, attachment }) => {
    if (selectedGroup) {
      try {
        const res = await axiosInstance.post(
          `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}/messages`,
          {
            text,
            ...(attachment ? { attachments: [attachment] } : {}),
          },
          {
            headers: socket?.id ? { "x-socket-id": socket.id } : {},
          },
        );

        setGroupMessages((current) =>
          upsertConversationMessage(current, res.data.message),
        );
        setGroups((current) => upsertGroup(current, res.data.group));
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to send group message");
        return false;
      }
    }

    const sentMessage = await sendMessage({
      text,
      attachments: attachment ? [attachment] : [],
    });

    return Boolean(sentMessage);
  };

  const handleUploadAttachment = async (file) => uploadMessageAttachment(file);

  const handleCreateGroup = async (name, members) => {
    try {
      const res = await axiosInstance.post(
        "/messages/groups",
        {
          name,
          memberIds: Array.isArray(members)
            ? members.map((member) => normalizeId(member._id)).filter(Boolean)
            : [],
        },
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      const createdGroup = {
        ...res.data,
        id: normalizeId(res.data._id ?? res.data.id),
      };

      setGroups((current) => upsertGroup(current, createdGroup));
      setGroupMessages([]);
      setIsCreateGroupModalOpen(false);
      setGroupSuccessData(createdGroup);
      setActiveTab("chats");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return false;
    }
  };

  const handleFinishGroupCreation = (groupId) => {
    setGroupSuccessData(null);
    setSelectedGroupId(groupId);
    setSelectedUser(null);
  };

  const handleRenameGroup = async (nextName) => {
    if (!selectedGroup) {
      return false;
    }

    try {
      const res = await axiosInstance.patch(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}`,
        { name: nextName },
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        upsertGroup(current, res.data, { preservePosition: true }),
      );
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to rename group");
      return false;
    }
  };

  const handleChangeGroupAvatar = async (nextAvatar) => {
    if (!selectedGroup) {
      return false;
    }

    try {
      const res = await axiosInstance.patch(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}`,
        { avatar: nextAvatar },
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        upsertGroup(current, res.data, { preservePosition: true }),
      );
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group avatar");
      return false;
    }
  };

  const handleAddGroupMembers = async (members) => {
    if (!selectedGroup) {
      return false;
    }

    try {
      const res = await axiosInstance.post(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}/members`,
        {
          memberIds: Array.isArray(members)
            ? members.map((member) => normalizeId(member._id)).filter(Boolean)
            : [],
        },
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        upsertGroup(current, res.data, { preservePosition: true }),
      );
      setIsAddGroupMembersModalOpen(false);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add group members");
      return false;
    }
  };

  const handlePromoteGroupMember = async (member) => {
    if (!selectedGroup || !member?._id) {
      return false;
    }

    try {
      const res = await axiosInstance.post(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}/members/${normalizeId(member._id)}/promote`,
        {},
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        upsertGroup(current, res.data, { preservePosition: true }),
      );
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update administrator role");
      return false;
    }
  };

  const handleDemoteGroupMember = async (member) => {
    if (!selectedGroup || !member?._id) {
      return false;
    }

    try {
      const res = await axiosInstance.post(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}/members/${normalizeId(member._id)}/demote`,
        {},
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        upsertGroup(current, res.data, { preservePosition: true }),
      );
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update administrator role");
      return false;
    }
  };

  const handleRemoveGroupMember = async () => {
    if (
      !selectedGroup ||
      groupConfirmationAction?.type !== "remove-member" ||
      !groupConfirmationAction.member?._id
    ) {
      return false;
    }

    setIsGroupActionSubmitting(true);

    try {
      const res = await axiosInstance.delete(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}/members/${normalizeId(groupConfirmationAction.member._id)}`,
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      if (res.data?.deleted) {
        setGroups((current) =>
          removeGroup(current, normalizeId(selectedGroup._id ?? selectedGroup.id)),
        );
        closeActiveConversation();
        return true;
      }

      setGroups((current) =>
        upsertGroup(current, res.data, { preservePosition: true }),
      );
      setGroupConfirmationAction(null);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove group member");
      return false;
    } finally {
      setIsGroupActionSubmitting(false);
    }
  };

  const handleLeaveSelectedGroup = async () => {
    if (!selectedGroup) {
      return false;
    }

    setIsGroupActionSubmitting(true);

    try {
      await axiosInstance.post(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}/leave`,
        {},
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        removeGroup(current, normalizeId(selectedGroup._id ?? selectedGroup.id)),
      );
      closeActiveConversation();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave group");
      return false;
    } finally {
      setIsGroupActionSubmitting(false);
    }
  };

  const handleDeleteSelectedGroup = async () => {
    if (!selectedGroup) {
      return false;
    }

    setIsGroupActionSubmitting(true);

    try {
      await axiosInstance.delete(
        `/messages/groups/${normalizeId(selectedGroup._id ?? selectedGroup.id)}`,
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      setGroups((current) =>
        removeGroup(current, normalizeId(selectedGroup._id ?? selectedGroup.id)),
      );
      closeActiveConversation();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete group");
      return false;
    } finally {
      setIsGroupActionSubmitting(false);
    }
  };

  const groupConfirmationCopy =
    groupConfirmationAction?.type === "delete"
      ? {
          title: "Delete this group?",
          description:
            "This removes the group for everyone and cannot be undone.",
          confirmLabel: "Delete group",
          confirmTone: "destructive",
          confirmTestId: "confirm-delete-group",
          onConfirm: handleDeleteSelectedGroup,
        }
      : groupConfirmationAction?.type === "leave"
        ? {
            title: "Leave this group?",
            description:
              "You will stop receiving messages from this group and it will be removed from your chat list.",
            confirmLabel: "Leave group",
            confirmTone: "soft-destructive",
            confirmTestId: "confirm-leave-group",
            onConfirm: handleLeaveSelectedGroup,
          }
        : groupConfirmationAction?.type === "remove-member"
          ? {
              title: "Remove this member?",
              description: `${
                groupConfirmationAction.member?.fullName || "This member"
              } will lose access to the group immediately.`,
              confirmLabel: "Remove",
              confirmTone: "soft-destructive",
              confirmTestId: "confirm-remove-group-member",
              onConfirm: handleRemoveGroupMember,
            }
        : null;

  if (!authUser) {
    return null;
  }

  return (
    <>
      <div
        className="flex min-h-screen w-full items-center justify-center p-4 md:p-8"
        style={{ background: "var(--ct-page-bg)" }}
      >
        <div
          className="flex h-[min(700px,calc(100vh-32px))] w-full max-w-[1024px] overflow-hidden rounded-2xl md:h-[700px]"
          style={{
            background: "var(--ct-surface)",
            border: "1px solid var(--ct-border)",
            boxShadow: "var(--ct-card-shadow)",
            transform: `scale(${chatUiScale})`,
            transformOrigin: "center center",
          }}
          data-testid="chat-shell"
        >
          <ChatSidebar
            authUser={authUser}
            onlineUsers={onlineUsers}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            activeConversationId={activeConversationId}
            chatItems={chatItems}
            contactItems={contactItems}
            onSelectConversation={handleSelectConversation}
            onProfileImageUpload={handleProfileImageUpload}
            onLogout={logout}
            isSoundEnabled={isSoundEnabled}
            onToggleSound={toggleSound}
            isLoading={sidebarIsLoading}
          />

          <ChatWindow
            conversation={selectedConversation}
            currentUser={{ id: normalizeId(authUser._id), fullName: authUser.fullName }}
            onSendMessage={handleSendConversationMessage}
            onUploadAttachment={handleUploadAttachment}
            onCloseConversation={closeActiveConversation}
            onOpenAddContact={() => setIsAddContactModalOpen(true)}
            onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)}
            onOpenRequests={() => setIsRequestDrawerOpen(true)}
            canManageGroup={isSelectedGroupAdmin}
            onOpenMembers={() => {
              if (selectedGroup) {
                setIsGroupMembersModalOpen(true);
              }
            }}
            onOpenAddMembers={() => {
              if (selectedGroup && isSelectedGroupAdmin) {
                setIsAddGroupMembersModalOpen(true);
              }
            }}
            onOpenRenameGroup={() => {
              if (selectedGroup && isSelectedGroupAdmin) {
                setIsRenameGroupModalOpen(true);
              }
            }}
            onOpenChangeGroupAvatar={() => {
              if (selectedGroup && isSelectedGroupAdmin) {
                setIsChangeGroupAvatarModalOpen(true);
              }
            }}
            onOpenLeaveGroup={() => {
              if (selectedGroup) {
                setGroupConfirmationAction({ type: "leave" });
              }
            }}
            onOpenDeleteGroup={() => {
              if (selectedGroup && isSelectedGroupAdmin) {
                setGroupConfirmationAction({ type: "delete" });
              }
            }}
            requestCount={incomingRequests.length}
          />
        </div>
      </div>

      <AddContactModal
        isOpen={isAddContactModalOpen}
        onClose={() => setIsAddContactModalOpen(false)}
      />
      <RequestDrawer
        isOpen={isRequestDrawerOpen}
        onClose={() => setIsRequestDrawerOpen(false)}
      />
      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        friends={friends}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onCreateGroup={handleCreateGroup}
      />
      <AddGroupMembersModal
        isOpen={isAddGroupMembersModalOpen}
        group={selectedGroup}
        friends={friends}
        onClose={() => setIsAddGroupMembersModalOpen(false)}
        onAddMembers={handleAddGroupMembers}
      />
      <CreateGroupSuccessModal
        group={groupSuccessData}
        currentUserId={normalizeId(authUser._id)}
        onComplete={handleFinishGroupCreation}
      />
      <GroupMembersModal
        isOpen={isGroupMembersModalOpen}
        group={selectedGroup}
        currentUserId={normalizeId(authUser._id)}
        canManageMembers={isSelectedGroupAdmin}
        onPromoteMember={handlePromoteGroupMember}
        onDemoteMember={handleDemoteGroupMember}
        onRemoveMember={(member) => {
          setGroupConfirmationAction({ type: "remove-member", member });
        }}
        onClose={() => setIsGroupMembersModalOpen(false)}
      />
      <RenameGroupModal
        isOpen={isRenameGroupModalOpen}
        group={selectedGroup}
        onClose={() => setIsRenameGroupModalOpen(false)}
        onSave={handleRenameGroup}
      />
      <ChangeGroupAvatarModal
        isOpen={isChangeGroupAvatarModalOpen}
        group={selectedGroup}
        onClose={() => setIsChangeGroupAvatarModalOpen(false)}
        onSave={handleChangeGroupAvatar}
      />
      <ConfirmGroupActionModal
        isOpen={Boolean(groupConfirmationCopy)}
        title={groupConfirmationCopy?.title || ""}
        description={groupConfirmationCopy?.description || ""}
        confirmLabel={groupConfirmationCopy?.confirmLabel || "Confirm"}
        confirmTone={groupConfirmationCopy?.confirmTone || "soft-destructive"}
        confirmTestId={groupConfirmationCopy?.confirmTestId}
        onClose={() => {
          setGroupConfirmationAction(null);
          setIsGroupActionSubmitting(false);
        }}
        onConfirm={() => groupConfirmationCopy?.onConfirm?.()}
        isSubmitting={isGroupActionSubmitting}
      />
    </>
  );
}

export default ChatPage;

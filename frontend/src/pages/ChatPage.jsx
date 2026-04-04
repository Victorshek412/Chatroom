import { useEffect, useMemo, useRef, useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import AddContactModal from "../components/AddContactModal";
import CreateGroupModal from "../components/CreateGroupModal";
import CreateGroupSuccessModal from "../components/CreateGroupSuccessModal";
import RequestDrawer from "../components/RequestDrawer";
import {
  getListTimeLabel,
  getMessagePreview,
  getUnifiedAttachment,
} from "../lib/chatActivity";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";

const normalizeId = (value) => value?.toString?.() ?? String(value ?? "");

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

const getAvatarUrl = (user) => user?.profilePicture || user?.avatarUrl || "";

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
  const [localGroups, setLocalGroups] = useState([]);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [isRequestDrawerOpen, setIsRequestDrawerOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [groupSuccessData, setGroupSuccessData] = useState(null);
  const localObjectUrlsRef = useRef(new Set());

  useEffect(() => () => {
    localObjectUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    localObjectUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    getMyChatPartners();
    fetchAcceptedFriends();
    fetchIncomingRequests();
    fetchOutgoingRequests();
  }, [
    fetchAcceptedFriends,
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

  const handleProfileImageUpload = async (base64Image) => {
    if (!base64Image) {
      return;
    }

    await updateProfile({ profilePic: base64Image });
  };

  const handleSelectConversation = (item) => {
    if (item.kind === "group") {
      setSelectedGroupId(item.id);
      setSelectedUser(null);
      return;
    }

    setSelectedGroupId(null);
    setSelectedUser(item.rawUser);
  };

  const selectedGroup = useMemo(
    () => localGroups.find((group) => group.id === selectedGroupId) || null,
    [localGroups, selectedGroupId],
  );

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

  const chatItems = useMemo(() => {
    const onlineUserIds = new Set(onlineUsers.map((id) => normalizeId(id)));

    const groupItems = localGroups.map((group) => {
      const latestMessage = group.messages[group.messages.length - 1];

      return {
        id: group.id,
        testId: group.id,
        kind: "group",
        title: group.name,
        avatarText: getInitials(group.name),
        avatarUrl: null,
        status: "online",
        previewText: latestMessage
          ? getMessagePreview(latestMessage)
          : "Group created",
        timeLabel: latestMessage
          ? getListTimeLabel(latestMessage.createdAt)
          : getListTimeLabel(group.createdAt),
        unreadCount: 0,
      };
    });

    const directItems = chats.map((chat) => {
      const chatId = normalizeId(chat._id);
      const cachedPreview = chatActivityByUserId[chatId];
      const isOnline = onlineUserIds.has(chatId);

      return {
        id: chatId,
        testId: chatId,
        kind: "direct",
        title: chat.fullName,
        avatarText: getInitials(chat.fullName),
        avatarUrl: getAvatarUrl(chat),
        status: isOnline ? "online" : "offline",
        previewText: cachedPreview?.previewText || "Start the conversation",
        timeLabel: cachedPreview?.timeLabel || "",
        unreadCount: 0,
        rawUser: chat,
      };
    });

    return [...groupItems, ...directItems];
  }, [chatActivityByUserId, chats, localGroups, onlineUsers]);

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
      const groupMembers = Array.isArray(selectedGroup.members)
        ? selectedGroup.members
        : [];

      return {
        id: selectedGroup.id,
        kind: "group",
        title: selectedGroup.name,
        avatarText: getInitials(selectedGroup.name),
        avatarUrl: null,
        status: "online",
        statusLabel:
          selectedGroup.messages.length > 0
            ? `${groupMembers.length + 1} members`
            : "active now",
        messages: selectedGroup.messages,
        isLoading: false,
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
    isMessagesLoading,
    isSoundEnabled,
    onlineUsers,
    selectedGroup,
    selectedUser,
  ]);

  const handleSendConversationMessage = async ({ text, attachment }) => {
    if (selectedGroup && authUser) {
      const nextMessage = {
        id: `group-message-${Date.now()}`,
        senderId: normalizeId(authUser._id),
        senderName: authUser.fullName,
        senderAvatarText: getInitials(authUser.fullName),
        senderAvatarUrl: getAvatarUrl(authUser),
        text,
        createdAt: new Date().toISOString(),
        attachment: attachment || null,
      };

      setLocalGroups((current) =>
        current.map((group) =>
          group.id === selectedGroup.id
            ? { ...group, messages: [...group.messages, nextMessage] }
            : group,
        ),
      );

      return true;
    }

    const sentMessage = await sendMessage({
      text,
      attachments: attachment ? [attachment] : [],
    });

    return Boolean(sentMessage);
  };

  const handleUploadAttachment = async (file) => {
    if (selectedGroup) {
      const objectUrl = URL.createObjectURL(file);
      localObjectUrlsRef.current.add(objectUrl);

      return {
        kind: file.type.startsWith("image/") ? "image" : "file",
        url: objectUrl,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        isLocalObjectUrl: true,
      };
    }

    return uploadMessageAttachment(file);
  };

  const handleCreateGroup = async (name, members) => {
    const nextGroup = {
      id: `group-${Date.now()}`,
      name,
      members: Array.isArray(members) ? members : [],
      messages: [],
      createdAt: new Date().toISOString(),
    };

    setLocalGroups((current) => [nextGroup, ...current]);
    setIsCreateGroupModalOpen(false);
    setGroupSuccessData(nextGroup);
    setActiveTab("chats");
    return true;
  };

  const handleFinishGroupCreation = (groupId) => {
    setGroupSuccessData(null);
    setSelectedGroupId(groupId);
    setSelectedUser(null);
  };

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
          }}
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
            onCloseConversation={() => {
              setSelectedGroupId(null);
              setSelectedUser(null);
            }}
            onOpenAddContact={() => setIsAddContactModalOpen(true)}
            onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)}
            onOpenRequests={() => setIsRequestDrawerOpen(true)}
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
      <CreateGroupSuccessModal
        group={groupSuccessData}
        onComplete={handleFinishGroupCreation}
      />
    </>
  );
}

export default ChatPage;

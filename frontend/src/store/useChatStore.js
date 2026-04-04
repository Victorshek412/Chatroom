import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { buildChatActivity } from "../lib/chatActivity";
import {
  playSoundEffect,
  primeSoundPlayback,
} from "../lib/soundEffects";
import { useAuthStore } from "./useAuthStore";
import { useFriendStore } from "./useFriendStore";

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.message || fallbackMessage;

const getComparableId = (value) => value?.toString?.() ?? value;

const upsertMessage = (messages, nextMessage) => {
  const nextMessageId = getComparableId(nextMessage._id);
  const existingIndex = messages.findIndex(
    (message) => getComparableId(message._id) === nextMessageId,
  );

  if (existingIndex === -1) {
    return [...messages, nextMessage];
  }

  const updatedMessages = [...messages];
  updatedMessages[existingIndex] = {
    ...updatedMessages[existingIndex],
    ...nextMessage,
    isOptimistic: false,
  };

  return updatedMessages;
};

const upsertChatPartner = (chats, nextChatPartner) => {
  if (!nextChatPartner?._id) {
    return chats;
  }

  const nextChatPartnerId = getComparableId(nextChatPartner._id);
  const existingIndex = chats.findIndex(
    (chat) => getComparableId(chat._id) === nextChatPartnerId,
  );

  if (existingIndex === -1) {
    return [nextChatPartner, ...chats];
  }

  const nextChats = [...chats];
  const [existingChat] = nextChats.splice(existingIndex, 1);

  return [
    {
      ...existingChat,
      ...nextChatPartner,
    },
    ...nextChats,
  ];
};

const upsertChatActivity = (chatActivityByUserId, userId, message) => {
  const comparableUserId = getComparableId(userId);
  if (!comparableUserId || !message) {
    return chatActivityByUserId;
  }

  return {
    ...chatActivityByUserId,
    [comparableUserId]: buildChatActivity(message),
  };
};

const isPageActive = () => {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
};

const findKnownChatPartner = (state, partnerId) => {
  const comparablePartnerId = getComparableId(partnerId);
  if (!comparablePartnerId) {
    return null;
  }

  return [
    state.selectedUser,
    ...state.chats,
    ...state.allContacts,
    ...useFriendStore.getState().friends,
  ].find(
    (candidate) => getComparableId(candidate?._id) === comparablePartnerId,
  ) || null;
};

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  chatActivityByUserId: {},
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  currentMessagesRequestId: 0,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    const nextIsSoundEnabled = !get().isSoundEnabled;

    if (nextIsSoundEnabled) {
      void primeSoundPlayback();
    }

    localStorage.setItem("isSoundEnabled", nextIsSoundEnabled);
    set({ isSoundEnabled: nextIsSoundEnabled });
  },

  resetChatState: () =>
    set({
      allContacts: [],
      chats: [],
      messages: [],
      chatActivityByUserId: {},
      selectedUser: null,
      isUsersLoading: false,
      isMessagesLoading: false,
      currentMessagesRequestId: 0,
    }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) =>
    set((state) => {
      const currentSelectedUserId = getComparableId(state.selectedUser?._id);
      const nextSelectedUserId = getComparableId(selectedUser?._id);

      if (currentSelectedUserId === nextSelectedUserId) {
        return { selectedUser };
      }

      return {
        selectedUser,
        messages: [],
        isMessagesLoading: Boolean(selectedUser),
      };
    }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load contacts"));
    } finally {
      set({ isUsersLoading: false });
    }
  },
  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load chats"));
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    let requestId = 0;
    set((state) => {
      requestId = state.currentMessagesRequestId + 1;
      return {
        isMessagesLoading: true,
        currentMessagesRequestId: requestId,
      };
    });

    try {
      const res = await axiosInstance.get(`/messages/${userId}`);

      if (
        get().currentMessagesRequestId !== requestId ||
        getComparableId(get().selectedUser?._id) !== getComparableId(userId)
      ) {
        return;
      }

      set({ messages: res.data, isMessagesLoading: false });

      const latestMessage = res.data[res.data.length - 1];
      if (latestMessage) {
        set((state) => ({
          chatActivityByUserId: upsertChatActivity(
            state.chatActivityByUserId,
            userId,
            latestMessage,
          ),
        }));
      }
    } catch (error) {
      if (
        get().currentMessagesRequestId !== requestId ||
        getComparableId(get().selectedUser?._id) !== getComparableId(userId)
      ) {
        return;
      }

      toast.error(getErrorMessage(error, "Failed to load messages"));
      set({ isMessagesLoading: false });
    }
  },

  uploadMessageAttachment: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axiosInstance.post("/messages/attachments/upload", formData);
      return res.data.attachment;
    } catch (error) {
      throw new Error(
        getErrorMessage(error, "Failed to upload attachment"),
      );
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { authUser, socket } = useAuthStore.getState();
    const selectedUserId = getComparableId(selectedUser?._id);
    const attachments = Array.isArray(messageData.attachments)
      ? messageData.attachments.slice(0, 1)
      : [];
    const primaryAttachment = attachments[0];

    // Guard against null authUser or selectedUser
    if (!authUser || !selectedUser) {
      toast.error("User information is missing");
      return null;
    }

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image:
        messageData.image ||
        (primaryAttachment?.kind === "image" ? primaryAttachment.url : null),
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
      isOptimistic: true, // flag to identify optimistic messages (optional)
    };
    // immediately update the UI by adding the message
    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        {
          text: messageData.text,
          ...(messageData.image ? { image: messageData.image } : {}),
          ...(attachments.length > 0 ? { attachments } : {}),
        },
        {
          headers: socket?.id ? { "x-socket-id": socket.id } : {},
        },
      );

      // Replace the optimistic message with the actual message from the server
      set((state) => ({
        chats: upsertChatPartner(state.chats, selectedUser),
        messages: upsertMessage(
          state.messages.filter((message) => message._id !== tempId),
          res.data,
        ),
        chatActivityByUserId: upsertChatActivity(
          state.chatActivityByUserId,
          selectedUserId,
          res.data,
        ),
      }));
      return res.data;
    } catch (error) {
      // remove optimistic message on failure
      set((state) => ({
        messages: state.messages.filter((message) => message._id !== tempId),
      }));
      toast.error(getErrorMessage(error, "Failed to send message"));
      return null;
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.on("newMessage", (newMessage) => {
      // Re-read fresh state on each event
      const { selectedUser, isSoundEnabled } = get();
      const { authUser } = useAuthStore.getState();

      if (!authUser) return;

      const selectedUserId = getComparableId(selectedUser?._id);
      const authUserId = getComparableId(authUser._id);
      const senderId = getComparableId(newMessage.senderId);
      const receiverId = getComparableId(newMessage.receiverId);
      const chatPartnerId = senderId === authUserId ? receiverId : senderId;

      const isCurrentConversationMessage =
        Boolean(selectedUserId) &&
        (
          (senderId === selectedUserId && receiverId === authUserId) ||
          (senderId === authUserId && receiverId === selectedUserId)
        );

      let shouldRefreshChats = false;

      set((state) => ({
        chats: (() => {
          const chatPartner = findKnownChatPartner(state, chatPartnerId);
          if (!chatPartner) {
            shouldRefreshChats = true;
            return state.chats;
          }

          return upsertChatPartner(state.chats, chatPartner);
        })(),
        messages: isCurrentConversationMessage
          ? upsertMessage(state.messages, newMessage)
          : state.messages,
        chatActivityByUserId: upsertChatActivity(
          state.chatActivityByUserId,
          chatPartnerId,
          newMessage,
        ),
      }));

      if (shouldRefreshChats) {
        void get().getMyChatPartners();
      }

      const isIncomingMessage = senderId !== authUserId;
      const shouldPlayNotification =
        isSoundEnabled &&
        isIncomingMessage &&
        !isPageActive();

      if (shouldPlayNotification) {
        void playSoundEffect("notification");
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
  },
}));

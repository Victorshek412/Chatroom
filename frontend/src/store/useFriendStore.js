import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.message || fallbackMessage;

const getComparableId = (value) => value?.toString?.() ?? value;

const upsertFriend = (friends, nextFriend) => {
  if (!nextFriend?._id) {
    return friends;
  }

  const existingIndex = friends.findIndex(
    (friend) => friend._id?.toString?.() === nextFriend._id?.toString?.(),
  );

  if (existingIndex === -1) {
    return [nextFriend, ...friends];
  }

  const nextFriends = [...friends];
  nextFriends[existingIndex] = nextFriend;
  return nextFriends;
};

const upsertFriendRequest = (requests, nextRequest) => {
  if (!nextRequest?._id) {
    return requests;
  }

  const nextRequestId = getComparableId(nextRequest._id);
  const existingIndex = requests.findIndex(
    (request) => getComparableId(request._id) === nextRequestId,
  );

  if (existingIndex === -1) {
    return [nextRequest, ...requests];
  }

  const nextRequests = [...requests];
  nextRequests[existingIndex] = nextRequest;
  return nextRequests;
};

const removeFriendRequest = (requests, requestId) => {
  const comparableRequestId = getComparableId(requestId);
  return requests.filter(
    (request) => getComparableId(request._id) !== comparableRequestId,
  );
};

const getSocketRequestConfig = () => {
  const socketId = useAuthStore.getState().socket?.id;
  return socketId
    ? {
        headers: {
          "x-socket-id": socketId,
        },
      }
    : undefined;
};

export const useFriendStore = create((set, get) => ({
  friends: [],
  myFriendCard: null,
  incomingRequests: [],
  outgoingRequests: [],
  searchResult: null,
  searchError: "",
  isFriendsLoading: false,
  isMyFriendCardLoading: false,
  isSearchingByFriendId: false,
  isIncomingRequestsLoading: false,
  isOutgoingRequestsLoading: false,
  isSendingFriendRequest: false,
  isCancellingFriendRequest: false,
  isUpdatingFriendRequest: false,
  friendRequestEventHandler: null,

  resetFriendState: () =>
    set({
      friends: [],
      myFriendCard: null,
      incomingRequests: [],
      outgoingRequests: [],
      searchResult: null,
      searchError: "",
      isFriendsLoading: false,
      isMyFriendCardLoading: false,
      isSearchingByFriendId: false,
      isIncomingRequestsLoading: false,
      isOutgoingRequestsLoading: false,
      isSendingFriendRequest: false,
      isCancellingFriendRequest: false,
      isUpdatingFriendRequest: false,
      friendRequestEventHandler: null,
    }),

  clearFriendSearch: () =>
    set({
      searchResult: null,
      searchError: "",
    }),

  fetchMyFriendCard: async () => {
    set({ isMyFriendCardLoading: true });

    try {
      const res = await axiosInstance.get("/friends/me");
      set({ myFriendCard: res.data });
      return res.data;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load your Friend ID"));
      return null;
    } finally {
      set({ isMyFriendCardLoading: false });
    }
  },

  fetchAcceptedFriends: async () => {
    set({ isFriendsLoading: true });

    try {
      const res = await axiosInstance.get("/friends");
      set({ friends: res.data.friends || [] });
      return res.data.friends || [];
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load friends"));
      return [];
    } finally {
      set({ isFriendsLoading: false });
    }
  },

  findUserByFriendId: async (friendId) => {
    const trimmedFriendId = friendId.trim();

    if (!trimmedFriendId) {
      set({
        searchResult: null,
        searchError: "Enter a Friend ID to search.",
      });
      return null;
    }

    set({
      isSearchingByFriendId: true,
      searchError: "",
    });

    try {
      const res = await axiosInstance.get("/friends/search", {
        params: { friendId: trimmedFriendId },
      });

      set({
        searchResult: res.data.user,
        searchError: "",
      });
      return res.data.user;
    } catch (error) {
      set({
        searchResult: null,
        searchError: getErrorMessage(error, "Failed to find that Friend ID"),
      });
      return null;
    } finally {
      set({ isSearchingByFriendId: false });
    }
  },

  sendFriendRequest: async (friendId) => {
    set({ isSendingFriendRequest: true });

    try {
      const res = await axiosInstance.post(
        "/friends/requests",
        { friendId },
        getSocketRequestConfig(),
      );
      const nextRequest = res.data.request;

      set((state) => ({
        outgoingRequests: upsertFriendRequest(state.outgoingRequests, nextRequest),
      }));

      toast.success("Friend request sent");
      return nextRequest;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send friend request"));
      return null;
    } finally {
      set({ isSendingFriendRequest: false });
    }
  },

  cancelFriendRequest: async (requestId) => {
    set({ isCancellingFriendRequest: true });

    try {
      const res = await axiosInstance.post(
        `/friends/requests/${requestId}/cancel`,
        {},
        getSocketRequestConfig(),
      );
      const cancelledRequestId = res.data.request?._id || requestId;

      set((state) => ({
        outgoingRequests: removeFriendRequest(
          state.outgoingRequests,
          cancelledRequestId,
        ),
      }));

      toast.success("Friend request cancelled");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to cancel request"));
      return false;
    } finally {
      set({ isCancellingFriendRequest: false });
    }
  },

  fetchIncomingRequests: async () => {
    set({ isIncomingRequestsLoading: true });

    try {
      const res = await axiosInstance.get("/friends/requests/incoming");
      set({ incomingRequests: res.data.requests || [] });
      return res.data.requests || [];
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load incoming requests"));
      return [];
    } finally {
      set({ isIncomingRequestsLoading: false });
    }
  },

  fetchOutgoingRequests: async () => {
    set({ isOutgoingRequestsLoading: true });

    try {
      const res = await axiosInstance.get("/friends/requests/outgoing");
      set({ outgoingRequests: res.data.requests || [] });
      return res.data.requests || [];
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load outgoing requests"));
      return [];
    } finally {
      set({ isOutgoingRequestsLoading: false });
    }
  },

  acceptFriendRequest: async (requestId) => {
    set({ isUpdatingFriendRequest: true });

    try {
      const res = await axiosInstance.post(
        `/friends/requests/${requestId}/accept`,
        {},
        getSocketRequestConfig(),
      );
      const nextFriend = res.data.friend;

      set((state) => ({
        incomingRequests: removeFriendRequest(state.incomingRequests, requestId),
        friends: upsertFriend(state.friends, nextFriend),
      }));

      toast.success("Friend request accepted");
      return nextFriend;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to accept request"));
      return null;
    } finally {
      set({ isUpdatingFriendRequest: false });
    }
  },

  rejectFriendRequest: async (requestId) => {
    set({ isUpdatingFriendRequest: true });

    try {
      await axiosInstance.post(
        `/friends/requests/${requestId}/reject`,
        {},
        getSocketRequestConfig(),
      );
      set((state) => ({
        incomingRequests: removeFriendRequest(state.incomingRequests, requestId),
      }));

      toast.success("Friend request rejected");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reject request"));
      return false;
    } finally {
      set({ isUpdatingFriendRequest: false });
    }
  },

  hydrateFriendModal: async () => {
    await Promise.all([
      get().fetchMyFriendCard(),
      get().fetchIncomingRequests(),
      get().fetchOutgoingRequests(),
      get().fetchAcceptedFriends(),
    ]);
  },

  subscribeToFriendRequests: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      return;
    }

    const existingHandler = get().friendRequestEventHandler;
    if (existingHandler) {
      socket.off("friendRequestEvent", existingHandler);
    } else {
      socket.off("friendRequestEvent");
    }

    const handleFriendRequestEvent = (event) => {
      if (!event?.scope || !event?.action) {
        return;
      }

      set((state) => {
        const scopeKey =
          event.scope === "outgoing" ? "outgoingRequests" : "incomingRequests";
        const nextState = {};

        if (event.action === "created" && event.request) {
          nextState[scopeKey] = upsertFriendRequest(
            state[scopeKey],
            event.request,
          );
        }

        if (
          event.action === "accepted" ||
          event.action === "rejected" ||
          event.action === "cancelled"
        ) {
          nextState[scopeKey] = removeFriendRequest(
            state[scopeKey],
            event.requestId,
          );
        }

        if (event.action === "accepted" && event.friend) {
          nextState.friends = upsertFriend(state.friends, event.friend);
        }

        return nextState;
      });
    };

    socket.on("friendRequestEvent", handleFriendRequestEvent);
    set({ friendRequestEventHandler: handleFriendRequestEvent });
  },

  unsubscribeFromFriendRequests: () => {
    const socket = useAuthStore.getState().socket;
    const handler = get().friendRequestEventHandler;

    if (socket && handler) {
      socket.off("friendRequestEvent", handler);
    }

    set({ friendRequestEventHandler: null });
  },
}));

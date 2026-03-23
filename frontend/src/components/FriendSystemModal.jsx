import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckIcon,
  Clock3Icon,
  CopyIcon,
  SearchIcon,
  UserRoundPlusIcon,
  XIcon,
} from "lucide-react";
import { useFriendStore } from "../store/useFriendStore";

const formatRequestAge = (timestamp) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

function FriendSystemModal({ isOpen, onClose }) {
  const {
    friends,
    myFriendCard,
    incomingRequests,
    outgoingRequests,
    searchResult,
    searchError,
    isFriendsLoading,
    isMyFriendCardLoading,
    isSearchingByFriendId,
    isIncomingRequestsLoading,
    isOutgoingRequestsLoading,
    isSendingFriendRequest,
    isUpdatingFriendRequest,
    acceptFriendRequest,
    clearFriendSearch,
    fetchAcceptedFriends,
    findUserByFriendId,
    hydrateFriendModal,
    rejectFriendRequest,
    sendFriendRequest,
  } = useFriendStore();
  const [friendIdInput, setFriendIdInput] = useState("");

  const handleClose = useCallback(() => {
    setFriendIdInput("");
    clearFriendSearch();
    onClose();
  }, [clearFriendSearch, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    hydrateFriendModal();

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [handleClose, hydrateFriendModal, isOpen]);

  const searchRelationship = useMemo(() => {
    if (!searchResult?._id) {
      return null;
    }

    const selectedUserId = searchResult._id.toString();

    if (friends.some((friend) => friend._id?.toString() === selectedUserId)) {
      return {
        label: "Already friends",
        actionDisabled: true,
      };
    }

    if (
      outgoingRequests.some(
        (request) => request.user?._id?.toString() === selectedUserId,
      )
    ) {
      return {
        label: "Request pending",
        actionDisabled: true,
      };
    }

    if (
      incomingRequests.some(
        (request) => request.user?._id?.toString() === selectedUserId,
      )
    ) {
      return {
        label: "Incoming request",
        actionDisabled: true,
      };
    }

    return {
      label: "Send friend request",
      actionDisabled: false,
    };
  }, [friends, incomingRequests, outgoingRequests, searchResult]);

  if (!isOpen) {
    return null;
  }

  const handleSearch = async (event) => {
    event.preventDefault();
    await findUserByFriendId(friendIdInput);
  };

  const handleCopyFriendId = async () => {
    if (!myFriendCard?.friendId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(myFriendCard.friendId);
      toast.success("Friend ID copied");
    } catch {
      toast.error("Failed to copy Friend ID");
    }
  };

  const handleSendFriendRequest = async () => {
    const createdRequest = await sendFriendRequest(friendIdInput || searchResult.friendId);

    if (createdRequest) {
      await fetchAcceptedFriends();
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-[28px] bg-white shadow-2xl"
        data-testid="friend-modal"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">
              Friend System
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              Add friends with Friend ID
            </h2>
          </div>

          <button
            type="button"
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            onClick={handleClose}
            data-testid="close-friend-modal"
            aria-label="Close friend modal"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-90px)] overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="avatar">
                    <div className="size-16 rounded-full ring-4 ring-white shadow-sm">
                      <img
                        src={myFriendCard?.profilePicture || "/avatar.png"}
                        alt="My avatar"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      My Friend ID
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {myFriendCard?.fullName || "Loading..."}
                    </h3>
                    <p
                      className="mt-1 font-mono text-sm uppercase tracking-[0.18em] text-slate-700"
                      data-testid="my-friend-id-value"
                    >
                      {isMyFriendCardLoading
                        ? "Loading..."
                        : myFriendCard?.friendId || "Unavailable"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={handleCopyFriendId}
                  disabled={!myFriendCard?.friendId}
                  data-testid="copy-friend-id"
                >
                  <CopyIcon className="size-4" />
                  Copy Friend ID
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-700">
                  <UserRoundPlusIcon className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Add Friend by ID
                  </h3>
                  <p className="text-sm text-slate-500">
                    Paste a Friend ID to find the right person quickly.
                  </p>
                </div>
              </div>

              <form
                className="mt-5 flex flex-col gap-3 sm:flex-row"
                onSubmit={handleSearch}
              >
                <input
                  value={friendIdInput}
                  onChange={(event) => {
                    setFriendIdInput(event.target.value.toUpperCase());
                    if (searchError || searchResult) {
                      clearFriendSearch();
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="Enter Friend ID"
                  data-testid="friend-id-input"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-300"
                  disabled={isSearchingByFriendId}
                  data-testid="friend-id-search"
                >
                  <SearchIcon className="size-4" />
                  {isSearchingByFriendId ? "Finding..." : "Find"}
                </button>
              </form>

              {searchError ? (
                <p className="mt-3 text-sm text-rose-600">{searchError}</p>
              ) : null}

              {searchResult ? (
                <div
                  className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  data-testid="friend-search-result"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="avatar">
                        <div className="size-14 rounded-full">
                          <img
                            src={searchResult.profilePicture || "/avatar.png"}
                            alt={`${searchResult.fullName} avatar`}
                          />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-base font-semibold text-slate-900">
                          {searchResult.fullName}
                        </h4>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                          {searchResult.friendId}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      onClick={handleSendFriendRequest}
                      disabled={
                        searchRelationship?.actionDisabled || isSendingFriendRequest
                      }
                      data-testid="send-friend-request"
                    >
                      {isSendingFriendRequest
                        ? "Sending..."
                        : searchRelationship?.label || "Send friend request"}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Requests</h3>
                  <p className="text-sm text-slate-500">
                    Review new requests and keep track of pending sends.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {friends.length} friend{friends.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Incoming requests
                    </h4>
                  </div>

                  <div className="mt-4 space-y-3" data-testid="incoming-requests-list">
                    {isIncomingRequestsLoading ? (
                      <p className="text-sm text-slate-500">Loading requests...</p>
                    ) : incomingRequests.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No incoming requests right now.
                      </p>
                    ) : (
                      incomingRequests.map((request) => (
                        <div
                          key={request._id}
                          className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="size-11 rounded-full">
                                <img
                                  src={request.user?.profilePicture || "/avatar.png"}
                                  alt={`${request.user?.fullName} avatar`}
                                />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {request.user?.fullName}
                              </p>
                              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500">
                                {request.user?.friendId}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-slate-500">
                            Received {formatRequestAge(request.createdAt)}
                          </p>

                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                              onClick={() => acceptFriendRequest(request._id)}
                              disabled={isUpdatingFriendRequest}
                              data-testid={`accept-friend-request-${request._id}`}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                              onClick={() => rejectFriendRequest(request._id)}
                              disabled={isUpdatingFriendRequest}
                              data-testid={`reject-friend-request-${request._id}`}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Clock3Icon className="size-4 text-amber-600" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Outgoing requests
                    </h4>
                  </div>

                  <div className="mt-4 space-y-3" data-testid="outgoing-requests-list">
                    {isOutgoingRequestsLoading ? (
                      <p className="text-sm text-slate-500">Loading requests...</p>
                    ) : outgoingRequests.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No pending outgoing requests.
                      </p>
                    ) : (
                      outgoingRequests.map((request) => (
                        <div
                          key={request._id}
                          className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="size-11 rounded-full">
                                <img
                                  src={request.user?.profilePicture || "/avatar.png"}
                                  alt={`${request.user?.fullName} avatar`}
                                />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {request.user?.fullName}
                              </p>
                              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500">
                                {request.user?.friendId}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-slate-500">
                            Sent {formatRequestAge(request.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {!isFriendsLoading && friends.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                  Accepted friends now appear in the Friends tab on the left.
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FriendSystemModal;

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardIcon, SearchIcon, XIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";
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

function AddContactModal({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef(null);
  const searchInputRef = useRef(null);
  const {
    friends,
    myFriendCard,
    incomingRequests,
    outgoingRequests,
    searchResult,
    searchError,
    isSearchingByFriendId,
    isSendingFriendRequest,
    isCancellingFriendRequest,
    hydrateFriendModal,
    findUserByFriendId,
    sendFriendRequest,
    cancelFriendRequest,
    clearFriendSearch,
  } = useFriendStore();
  const safeFriends = friends ?? [];
  const safeIncomingRequests = incomingRequests ?? [];
  const safeOutgoingRequests = outgoingRequests ?? [];
  const closeFromEffect = useEffectEvent(() => {
    setQuery("");
    clearFriendSearch();
    onClose();
  });

  useFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: searchInputRef,
    onClose: closeFromEffect,
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    hydrateFriendModal();
    return undefined;
  }, [hydrateFriendModal, isOpen]);

  const handleClose = () => {
    setQuery("");
    clearFriendSearch();
    onClose();
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await findUserByFriendId(query);
  };

  const handleCopy = async () => {
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

  const relationshipState = useMemo(() => {
    const searchId = normalizeId(searchResult?._id);
    if (!searchId) {
      return {
        action: null,
        disabled: true,
        label: "Request",
        requestId: null,
      };
    }

    if (safeFriends.some((friend) => normalizeId(friend._id) === searchId)) {
      return {
        action: null,
        disabled: true,
        label: "Already added",
        requestId: null,
      };
    }

    const incomingRequest = safeIncomingRequests.find(
      (request) => normalizeId(request.user?._id) === searchId,
    );
    if (incomingRequest) {
      return {
        action: null,
        disabled: true,
        label: "Incoming request",
        requestId: incomingRequest._id,
      };
    }

    const outgoingRequest = safeOutgoingRequests.find(
      (request) => normalizeId(request.user?._id) === searchId,
    );
    if (outgoingRequest) {
      return {
        action: "cancel",
        disabled: false,
        label: "Requested",
        requestId: outgoingRequest._id,
      };
    }

    return {
      action: "send",
      disabled: false,
      label: "Request",
      requestId: null,
    };
  }, [safeFriends, safeIncomingRequests, safeOutgoingRequests, searchResult]);
  const isSecondaryAction =
    relationshipState.disabled || relationshipState.action === "cancel";

  const handleRequestToggle = async () => {
    if (relationshipState.action === "cancel") {
      if (!relationshipState.requestId) {
        return;
      }

      await cancelFriendRequest(relationshipState.requestId);
      return;
    }

    if (relationshipState.action === "send" && searchResult?.friendId) {
      await sendFriendRequest(searchResult.friendId);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(14, 15, 19, 0.28)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[356px] overflow-hidden rounded-[22px]"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-contact-modal-title"
        data-testid="friend-modal"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
        >
          <h2
            id="add-contact-modal-title"
            className="text-[18px] font-semibold"
            style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
          >
            Add Contact
          </h2>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={handleClose}
            aria-label="Close add contact dialog"
            data-testid="close-friend-modal"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
          <form onSubmit={handleSearch}>
            <div
              className="flex items-center gap-2.5 rounded-[16px] px-3.5"
              style={{
                minHeight: 48,
                background: "var(--ct-field-bg)",
                border: "1px solid var(--ct-border-light)",
              }}
            >
              <SearchIcon size={16} style={{ color: "var(--ct-text3)" }} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value.toUpperCase());
                  if (searchResult || searchError) {
                    clearFriendSearch();
                  }
                }}
                className="w-full bg-transparent text-[14px] outline-none"
                style={{ color: "var(--ct-text1)" }}
                placeholder="Search by Friend ID"
                data-testid="friend-id-input"
              />
              <button
                type="submit"
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ background: "var(--ct-active-bg)", color: "var(--ct-icon)" }}
                data-testid="friend-id-search"
                disabled={isSearchingByFriendId}
              >
                <SearchIcon size={14} />
              </button>
            </div>
          </form>

          {searchError ? (
            <p className="mt-2.5 text-[12px]" style={{ color: "var(--ct-destructive)" }}>
              {searchError}
            </p>
          ) : null}

          {searchResult ? (
            <div
              className="mt-3 rounded-[16px] px-3.5 py-3.5"
              style={{
                border: "1px solid var(--ct-border-light)",
                background: "var(--ct-panel)",
              }}
              data-testid="friend-search-result"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: "var(--ct-avatar-bg)",
                    color: "var(--ct-avatar-text)",
                  }}
                >
                  <span className="text-[12px] font-semibold">
                    {getInitials(searchResult.fullName)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[15px] font-semibold"
                    style={{ color: "var(--ct-text1)" }}
                  >
                    {searchResult.fullName}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--ct-text3)" }}>
                    {searchResult.friendId}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-[12px] px-3 py-2 text-[12px] font-semibold"
                  style={{
                    background: isSecondaryAction
                      ? "var(--ct-field-bg)"
                      : "var(--ct-accent)",
                    color: isSecondaryAction
                      ? "var(--ct-text3)"
                      : "var(--ct-accent-fg)",
                    border: isSecondaryAction
                      ? "1px solid var(--ct-border-light)"
                      : "1px solid transparent",
                  }}
                  onClick={handleRequestToggle}
                  disabled={
                    relationshipState.disabled ||
                    isSendingFriendRequest ||
                    isCancellingFriendRequest
                  }
                  data-testid="send-friend-request"
                >
                  {relationshipState.label}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 py-3.5"
          style={{ borderTop: "1px solid var(--ct-border-light)" }}
        >
          <div className="min-w-0">
            <p className="text-[12px]" style={{ color: "var(--ct-text3)" }}>
              Your ID
            </p>
            <p
              className="truncate text-[15px] font-semibold"
              style={{ color: "var(--ct-text1)" }}
              data-testid="my-friend-id-value"
            >
              {myFriendCard?.friendId || "Loading..."}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-[12px] font-semibold"
            style={{
              background: "var(--ct-field-bg)",
              border: "1px solid var(--ct-border-light)",
              color: "var(--ct-text2)",
            }}
            onClick={handleCopy}
            data-testid="copy-friend-id"
          >
            <ClipboardIcon size={14} />
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddContactModal;

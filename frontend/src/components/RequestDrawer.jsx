import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CheckIcon, InboxIcon, XIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";
import { useFriendStore } from "../store/useFriendStore";

const PANEL_WIDTH = 252;
const PANEL_GAP = 16;
const DEFAULT_TOP = 134;
const DEFAULT_RIGHT = 28;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getClampedPosition = (left, top, panelWidth, panelHeight) => {
  const maxLeft = Math.max(PANEL_GAP, window.innerWidth - panelWidth - PANEL_GAP);
  const maxTop = Math.max(PANEL_GAP, window.innerHeight - panelHeight - PANEL_GAP);

  return {
    left: clamp(left, PANEL_GAP, maxLeft),
    top: clamp(top, PANEL_GAP, maxTop),
  };
};

const getInitialPosition = (panelHeight = 320) =>
  getClampedPosition(
    window.innerWidth - PANEL_WIDTH - DEFAULT_RIGHT,
    DEFAULT_TOP,
    PANEL_WIDTH,
    panelHeight,
  );

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

function RequestDrawer({ isOpen, onClose }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dragStateRef = useRef(null);
  const {
    incomingRequests,
    isIncomingRequestsLoading,
    isUpdatingFriendRequest,
    fetchIncomingRequests,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useFriendStore();
  const closeFromEffect = useEffectEvent(() => {
    onClose();
  });
  useFocusTrap({
    isOpen,
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    onClose: closeFromEffect,
  });
  const [position, setPosition] = useState(() => ({
    left: typeof window === "undefined"
      ? PANEL_GAP
      : window.innerWidth - PANEL_WIDTH - DEFAULT_RIGHT,
    top: DEFAULT_TOP,
  }));
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    fetchIncomingRequests();
    return undefined;
  }, [fetchIncomingRequests, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
      dragStateRef.current = null;
      return undefined;
    }

    const syncPosition = () => {
      const panelHeight = panelRef.current?.offsetHeight ?? 320;
      setPosition(getInitialPosition(panelHeight));
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    return () => window.removeEventListener("resize", syncPosition);
  }, [isOpen]);

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const nextLeft = dragState.originLeft + (event.clientX - dragState.startX);
      const nextTop = dragState.originTop + (event.clientY - dragState.startY);
      const panelWidth = panelRef.current?.offsetWidth ?? PANEL_WIDTH;
      const panelHeight = panelRef.current?.offsetHeight ?? 320;

      setPosition(getClampedPosition(nextLeft, nextTop, panelWidth, panelHeight));
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  const handleDragStart = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest("button")) {
      return;
    }

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
    };
    setIsDragging(true);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed z-50 w-[252px] overflow-hidden rounded-[18px]"
        style={{
          left: position.left,
          top: position.top,
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
          userSelect: isDragging ? "none" : "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-requests-title"
        data-testid="friend-requests-panel"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-3.5 py-3"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
          onPointerDown={handleDragStart}
          data-testid="friend-requests-drag-handle"
        >
          <div className="flex items-center gap-3">
            <h3
              id="friend-requests-title"
              className="text-[14px] font-semibold"
              style={{
                color: "var(--ct-text1)",
                letterSpacing: "-0.02em",
                cursor: isDragging ? "grabbing" : "grab",
              }}
            >
              Friend Requests
            </h3>
            <span
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
              style={{
                background: "var(--ct-badge-bg)",
                color: "var(--ct-badge-fg)",
                cursor: isDragging ? "grabbing" : "grab",
              }}
            >
              {incomingRequests.length}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={onClose}
            aria-label="Close friend requests"
          >
            <XIcon size={14} />
          </button>
        </div>

        <div className="max-h-[288px] overflow-y-auto px-2.5 py-2.5">
          {isIncomingRequestsLoading ? (
            <p className="px-3 py-4 text-[12px]" style={{ color: "var(--ct-text3)" }}>
              Loading requests...
            </p>
          ) : incomingRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 px-4 py-7 text-center">
              <InboxIcon size={18} style={{ color: "var(--ct-text3)" }} />
              <p className="text-[13px]" style={{ color: "var(--ct-text3)" }}>
                No pending requests.
              </p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="incoming-requests-list">
              {incomingRequests.map((request) => (
                <div
                  key={request._id}
                  className="flex items-center gap-2.5 rounded-[14px] px-2.5 py-2.5"
                  style={{ background: "var(--ct-panel)" }}
                >
                  <div
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
                    style={{
                      background: "var(--ct-avatar-bg)",
                      color: "var(--ct-avatar-text)",
                    }}
                  >
                    <span className="text-[11px] font-semibold">
                      {getInitials(request.user?.fullName)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: "var(--ct-text1)" }}
                    >
                      {request.user?.fullName}
                    </p>
                    <p
                      className="truncate text-[11px]"
                      style={{ color: "var(--ct-text3)" }}
                    >
                      {request.user?.friendId}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="rounded-[11px] px-2.5 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: "var(--ct-surface)",
                      border: "1px solid var(--ct-border-light)",
                      color: "var(--ct-text1)",
                      opacity: isUpdatingFriendRequest ? 0.7 : 1,
                    }}
                    onClick={() => acceptFriendRequest(request._id)}
                    disabled={isUpdatingFriendRequest}
                    data-testid={`accept-friend-request-${request._id}`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      color: "var(--ct-text3)",
                      opacity: isUpdatingFriendRequest ? 0.7 : 1,
                    }}
                    onClick={() => rejectFriendRequest(request._id)}
                    disabled={isUpdatingFriendRequest}
                    data-testid={`reject-friend-request-${request._id}`}
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {incomingRequests.length > 0 ? (
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 text-[11px]"
            style={{
              borderTop: "1px solid var(--ct-border-light)",
              color: "var(--ct-text3)",
            }}
          >
            <CheckIcon size={13} />
            Accepting a request adds that contact to the Contacts tab.
          </div>
        ) : null}
      </div>
    </>
  );
}

export default RequestDrawer;

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, LoaderCircleIcon, UsersIcon, XIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";

const MODAL_GAP = 16;
const FALLBACK_MODAL_WIDTH = 472;
const FALLBACK_MODAL_HEIGHT = 472;
const ACTION_MENU_WIDTH = 188;
const ACTION_MENU_GAP = 8;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getClampedPosition = (left, top, panelWidth, panelHeight) => {
  const maxLeft = Math.max(
    MODAL_GAP,
    window.innerWidth - panelWidth - MODAL_GAP,
  );
  const maxTop = Math.max(
    MODAL_GAP,
    window.innerHeight - panelHeight - MODAL_GAP,
  );

  return {
    left: clamp(left, MODAL_GAP, maxLeft),
    top: clamp(top, MODAL_GAP, maxTop),
  };
};

const getInitialPosition = (
  panelWidth = FALLBACK_MODAL_WIDTH,
  panelHeight = FALLBACK_MODAL_HEIGHT,
) =>
  getClampedPosition(
    (window.innerWidth - panelWidth) / 2,
    (window.innerHeight - panelHeight) / 2 - 12,
    panelWidth,
    panelHeight,
  );

const normalizeId = (value) => value?.toString?.() ?? String(value ?? "");
const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "G";

function MemberAvatar({ name, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-11 w-11 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-full"
      style={{
        background: "var(--ct-avatar-bg)",
        color: "var(--ct-avatar-text)",
      }}
    >
      <span className="text-[12px] font-semibold">{getInitials(name)}</span>
    </div>
  );
}

const getRolePillTone = (role) => {
  const isAdministrator = String(role || "member").toLowerCase() === "admin";

  return {
    isAdministrator,
    label: isAdministrator ? "Administrator" : "Member",
    background: isAdministrator ? "var(--ct-active-bg)" : "var(--ct-panel)",
    border: isAdministrator
      ? "1px solid var(--ct-active-border)"
      : "1px solid var(--ct-border-light)",
  };
};

function RolePill({
  role,
  memberId,
  memberName,
  interactive = false,
  isOpen = false,
  isPending = false,
  onClick,
}) {
  const { label, background, border } = getRolePillTone(role);
  const sharedStyle = {
    background,
    border,
    color: "var(--ct-text2)",
    letterSpacing: "0.01em",
  };

  if (!interactive) {
    return (
      <span
        className="inline-flex min-w-[114px] items-center justify-center rounded-full px-2.5 py-[7px] text-[10px] font-semibold"
        style={sharedStyle}
        data-testid={`group-member-role-display-${memberId}`}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex min-w-[114px] items-center justify-center gap-1.5 rounded-full px-2.5 py-[7px] text-[10px] font-semibold transition duration-100 hover:opacity-95"
      style={{
        ...sharedStyle,
        cursor: isPending ? "progress" : "pointer",
        boxShadow: isOpen ? "inset 0 0 0 1px var(--ct-border-light)" : "none",
      }}
      onClick={onClick}
      disabled={isPending}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label={`Manage ${memberName}`}
      data-group-member-role-trigger="true"
      data-testid={`group-member-role-trigger-${memberId}`}
    >
      <span>{label}</span>
      {isPending ? (
        <LoaderCircleIcon size={12} className="animate-spin" />
      ) : (
        <ChevronDownIcon
          size={12}
          className={`transition-transform duration-100 ${isOpen ? "rotate-180" : ""}`}
        />
      )}
    </button>
  );
}

function GroupMembersModal({
  isOpen,
  group,
  currentUserId,
  canManageMembers = false,
  onPromoteMember,
  onDemoteMember,
  onRemoveMember,
  onClose,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dragStateRef = useRef(null);
  const [position, setPosition] = useState(() => ({
    left: typeof window === "undefined" ? MODAL_GAP : getInitialPosition().left,
    top: typeof window === "undefined" ? MODAL_GAP : getInitialPosition().top,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);
  const [pendingMemberId, setPendingMemberId] = useState(null);
  const closeFromEffect = useEffectEvent(() => {
    setActionMenu(null);
    setPendingMemberId(null);
    onClose();
  });

  useFocusTrap({
    isOpen,
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    onClose: closeFromEffect,
  });

  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
      setActionMenu(null);
      setPendingMemberId(null);
      dragStateRef.current = null;
      return undefined;
    }

    const syncPosition = () => {
      const panelWidth = panelRef.current?.offsetWidth ?? FALLBACK_MODAL_WIDTH;
      const panelHeight = panelRef.current?.offsetHeight ?? FALLBACK_MODAL_HEIGHT;
      setPosition(getInitialPosition(panelWidth, panelHeight));
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    return () => window.removeEventListener("resize", syncPosition);
  }, [isOpen, group?._id]);

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
      const panelWidth = panelRef.current?.offsetWidth ?? FALLBACK_MODAL_WIDTH;
      const panelHeight = panelRef.current?.offsetHeight ?? FALLBACK_MODAL_HEIGHT;

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

  useEffect(() => {
    if (!actionMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        event.target.closest("[data-group-member-role-trigger='true']") ||
        event.target.closest("[data-group-member-menu='true']")
      ) {
        return;
      }

      setActionMenu(null);
    };

    const handleResize = () => {
      setActionMenu(null);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActionMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenu]);

  const members = useMemo(
    () => (Array.isArray(group?.members) ? group.members : []),
    [group?.members],
  );

  const handleDragStart = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest("button")) {
      return;
    }

    setActionMenu(null);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
    };
    setIsDragging(true);
  };

  const openActionMenu = (event, member, actionCount) => {
    const memberId = normalizeId(member?._id);

    if (actionMenu?.memberId === memberId) {
      setActionMenu(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = 12 + actionCount * 37 + Math.max(actionCount - 1, 0) * 4;
    const nextLeft = clamp(
      rect.right - ACTION_MENU_WIDTH,
      MODAL_GAP,
      window.innerWidth - ACTION_MENU_WIDTH - MODAL_GAP,
    );
    const preferredTop = rect.bottom + ACTION_MENU_GAP;
    const nextTop =
      preferredTop + estimatedMenuHeight + MODAL_GAP <= window.innerHeight
        ? preferredTop
        : Math.max(MODAL_GAP, rect.top - estimatedMenuHeight - ACTION_MENU_GAP);

    setActionMenu({
      memberId,
      left: nextLeft,
      top: nextTop,
    });
  };

  const runMemberMutation = async (member, callback) => {
    if (!callback) {
      return;
    }

    const memberId = normalizeId(member?._id);
    setPendingMemberId(memberId);
    setActionMenu(null);

    try {
      await callback(member);
    } finally {
      setPendingMemberId(null);
    }
  };

  if (!isOpen || !group) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed z-50 w-[min(472px,calc(100vw-24px))] rounded-[24px]"
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
        aria-labelledby="group-members-modal-title"
        data-testid="group-members-modal"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
          onPointerDown={handleDragStart}
          data-testid="group-members-drag-handle"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: "var(--ct-avatar-bg)",
                color: "var(--ct-avatar-text)",
              }}
            >
              <UsersIcon size={18} />
            </div>
            <div>
              <h2
                id="group-members-modal-title"
                className="text-[18px] font-semibold"
                style={{
                  color: "var(--ct-text1)",
                  letterSpacing: "-0.03em",
                  cursor: isDragging ? "grabbing" : "grab",
                }}
              >
                Members
              </h2>
              <p
                className="text-[11px]"
                style={{
                  color: "var(--ct-text3)",
                  cursor: isDragging ? "grabbing" : "grab",
                }}
              >
                {members.length} member{members.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={onClose}
            aria-label="Close members dialog"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-5 py-5">
          {members.length === 0 ? (
            <div
              className="rounded-[16px] px-4 py-6 text-center text-[13px]"
              style={{ background: "var(--ct-panel)", color: "var(--ct-text3)" }}
            >
              No members found.
            </div>
          ) : (
            <div
              className="hidden-scrollbar max-h-[404px] space-y-2.5 overflow-y-auto pr-1"
              onScroll={() => setActionMenu(null)}
            >
              {members.map((member) => {
                const memberId = normalizeId(member._id);
                const isSelf = memberId === normalizeId(currentUserId);
                const isAdministrator =
                  String(member.role || "member").toLowerCase() === "admin";
                const canPromote = canManageMembers && !isSelf && !isAdministrator && Boolean(onPromoteMember);
                const canDemote = canManageMembers && !isSelf && isAdministrator && Boolean(onDemoteMember);
                const canRemove = canManageMembers && !isSelf && Boolean(onRemoveMember);
                const actionCount = [canPromote || canDemote, canRemove].filter(Boolean).length;
                const hasManageActions = actionCount > 0;
                const isPending = pendingMemberId === memberId;

                return (
                  <div
                    key={member._id}
                    className="rounded-[18px] px-3 py-3"
                    style={{
                      background: "var(--ct-sidebar)",
                      border: "1px solid var(--ct-border-light)",
                    }}
                  >
                    <div className="mx-auto flex w-full max-w-[352px] items-center gap-2.5">
                      <MemberAvatar
                        name={member.fullName}
                        src={member.profilePicture || ""}
                      />

                      <div className="min-w-0 flex-1 pr-1">
                        <p
                          className="truncate text-[14px] font-semibold"
                          style={{ color: "var(--ct-text1)" }}
                        >
                          {member.fullName}
                          {isSelf ? " (You)" : ""}
                        </p>
                        <p
                          className="truncate text-[11px]"
                          style={{ color: "var(--ct-text3)" }}
                        >
                          {member.friendId || "Group member"}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <RolePill
                          role={member.role}
                          memberId={memberId}
                          memberName={member.fullName}
                          interactive={hasManageActions}
                          isOpen={actionMenu?.memberId === memberId}
                          isPending={isPending}
                          onClick={(event) => openActionMenu(event, member, actionCount)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {actionMenu ? (
          <div
            className="fixed z-[60] w-[188px] rounded-[16px] p-[4px]"
            style={{
              left: actionMenu.left,
              top: actionMenu.top,
              background: "var(--ct-surface)",
              border: "1px solid var(--ct-border)",
              boxShadow: "var(--ct-card-shadow)",
            }}
            data-group-member-menu="true"
          >
            {(() => {
              const member = members.find(
                (entry) => normalizeId(entry._id) === actionMenu.memberId,
              );

              if (!member) {
                return null;
              }

              const memberId = normalizeId(member._id);
              const isSelf = memberId === normalizeId(currentUserId);
              const isAdministrator =
                String(member.role || "member").toLowerCase() === "admin";
              const canPromote =
                canManageMembers && !isSelf && !isAdministrator && Boolean(onPromoteMember);
              const canDemote =
                canManageMembers && !isSelf && isAdministrator && Boolean(onDemoteMember);
              const canRemove =
                canManageMembers && !isSelf && Boolean(onRemoveMember);

              return (
                <div className="space-y-1">
                  {canPromote ? (
                    <button
                      type="button"
                      className="flex h-[34px] w-full items-center rounded-[10px] px-3 text-left"
                      style={{ color: "var(--ct-text2)" }}
                      onClick={() => void runMemberMutation(member, onPromoteMember)}
                      data-testid={`promote-group-member-${memberId}`}
                    >
                      <span
                        className="whitespace-nowrap"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 450,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Make Administrator
                      </span>
                    </button>
                  ) : null}

                  {canDemote ? (
                    <button
                      type="button"
                      className="flex h-[34px] w-full items-center rounded-[10px] px-3 text-left"
                      style={{ color: "var(--ct-text2)" }}
                      onClick={() => void runMemberMutation(member, onDemoteMember)}
                      data-testid={`demote-group-member-${memberId}`}
                    >
                      <span
                        className="whitespace-nowrap"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 450,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Make Member
                      </span>
                    </button>
                  ) : null}

                  {canRemove ? (
                    <button
                      type="button"
                      className="flex h-[34px] w-full items-center rounded-[10px] px-3 text-left"
                      style={{ color: "var(--ct-destructive)" }}
                      onClick={() => {
                        setActionMenu(null);
                        onRemoveMember(member);
                      }}
                      data-testid={`remove-group-member-${memberId}`}
                    >
                      <span
                        className="whitespace-nowrap"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 450,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Remove from group
                      </span>
                    </button>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default GroupMembersModal;

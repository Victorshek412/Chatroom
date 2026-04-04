import { CheckIcon, SearchIcon, UsersIcon, XIcon } from "lucide-react";
import { useEffectEvent, useMemo, useRef, useState } from "react";
import useFocusTrap from "../hooks/useFocusTrap";

const normalizeId = (value) => value?.toString?.() ?? String(value ?? "");
const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

function CreateGroupModal({ isOpen, friends, onClose, onCreateGroup }) {
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef(null);
  const groupNameInputRef = useRef(null);
  const safeFriends = friends ?? [];

  const resetForm = () => {
    setGroupName("");
    setQuery("");
    setSelectedIds([]);
    setIsSubmitting(false);
  };

  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return safeFriends;
    }

    return safeFriends.filter((friend) => {
      const fullName = String(friend.fullName || "").toLowerCase();
      const friendId = String(friend.friendId || "").toLowerCase();
      return (
        fullName.includes(normalizedQuery) || friendId.includes(normalizedQuery)
      );
    });
  }, [query, safeFriends]);

  const selectedFriends = useMemo(
    () =>
      safeFriends.filter((friend) =>
        selectedIds.includes(normalizeId(friend._id)),
      ),
    [safeFriends, selectedIds],
  );

  const handleToggleFriend = (friendId) => {
    setSelectedIds((current) =>
      current.includes(friendId)
        ? current.filter((entry) => entry !== friendId)
        : [...current, friendId],
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const closeFromEffect = useEffectEvent(() => {
    handleClose();
  });

  useFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: groupNameInputRef,
    onClose: closeFromEffect,
  });

  const handleSubmit = async () => {
    if (!groupName.trim() || selectedFriends.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const didCreate = await onCreateGroup(groupName.trim(), selectedFriends);
      if (didCreate !== false) {
        resetForm();
      } else {
        setIsSubmitting(false);
      }
    } catch {
      setIsSubmitting(false);
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
        className="w-full max-w-[410px] overflow-hidden rounded-[22px]"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-modal-title"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
        >
          <h2
            id="create-group-modal-title"
            className="text-[18px] font-semibold"
            style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
          >
            Create Group
          </h2>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={handleClose}
            aria-label="Close create group dialog"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 flex flex-col items-center gap-2">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: "var(--ct-avatar-bg)",
                color: "var(--ct-avatar-text)",
              }}
            >
              <UsersIcon size={24} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--ct-text3)" }}>
              Edit avatar after creating
            </p>
          </div>

          <div
            className="mb-3.5 flex items-center gap-2.5 rounded-[16px] px-3.5"
            style={{
              minHeight: 48,
              background: "var(--ct-field-bg)",
              border: "1px solid var(--ct-border-light)",
            }}
          >
            <input
              ref={groupNameInputRef}
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="w-full bg-transparent text-[14px] outline-none"
              style={{ color: "var(--ct-text1)" }}
              placeholder="Enter group name"
            />
            {groupName ? (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ color: "var(--ct-text3)" }}
                onClick={() => setGroupName("")}
              >
                <XIcon size={12} />
              </button>
            ) : null}
          </div>

          <div
            className="mb-3.5 flex items-center gap-2.5 rounded-[16px] px-3.5"
            style={{
              minHeight: 48,
              background: "var(--ct-field-bg)",
              border: "1px solid var(--ct-border-light)",
            }}
          >
            <SearchIcon size={16} style={{ color: "var(--ct-text3)" }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-[14px] outline-none"
              style={{ color: "var(--ct-text1)" }}
              placeholder="Search friends"
            />
          </div>

          {selectedFriends.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {selectedFriends.map((friend) => (
                <button
                  key={friend._id}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[12px] px-2.5 py-1.5"
                  style={{
                    background: "var(--ct-active-bg)",
                    border: "1px solid var(--ct-active-border)",
                    color: "var(--ct-text1)",
                  }}
                  onClick={() => handleToggleFriend(normalizeId(friend._id))}
                >
                  <span
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-semibold"
                    style={{
                      background: "var(--ct-avatar-bg)",
                      color: "var(--ct-avatar-text)",
                    }}
                  >
                    {getInitials(friend.fullName)}
                  </span>
                  <span className="text-[12px]">{friend.fullName}</span>
                  <XIcon size={10} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between">
            <p
              className="text-[11px] font-semibold uppercase"
              style={{ color: "var(--ct-text3)", letterSpacing: "0.08em" }}
            >
              Friends
            </p>
            <p className="text-[12px]" style={{ color: "var(--ct-text3)" }}>
              {filteredFriends.length}
            </p>
          </div>

          <div className="hidden-scrollbar max-h-[220px] overflow-y-auto">
            {filteredFriends.length === 0 ? (
              <div
                className="rounded-[16px] px-4 py-4 text-center text-[13px]"
                style={{ background: "var(--ct-panel)", color: "var(--ct-text3)" }}
              >
                No friends found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => {
                  const friendId = normalizeId(friend._id);
                  const isSelected = selectedIds.includes(friendId);

                  return (
                    <button
                      key={friend._id}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-[16px] px-3 py-2.5 text-left"
                      style={{
                        background: isSelected ? "var(--ct-active-bg)" : "var(--ct-panel)",
                        border: isSelected
                          ? "1px solid var(--ct-active-border)"
                          : "1px solid transparent",
                      }}
                      onClick={() => handleToggleFriend(friendId)}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full"
                        style={{
                          background: "var(--ct-avatar-bg)",
                          color: "var(--ct-avatar-text)",
                        }}
                      >
                        <span className="text-[12px] font-semibold">
                          {getInitials(friend.fullName)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-[14px] font-semibold"
                          style={{ color: "var(--ct-text1)" }}
                        >
                          {friend.fullName}
                        </p>
                        <p
                          className="truncate text-[11px]"
                          style={{ color: "var(--ct-text3)" }}
                        >
                          {friend.friendId}
                        </p>
                      </div>
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full"
                        style={{
                          border: "1px solid var(--ct-border)",
                          background: isSelected
                            ? "var(--ct-accent)"
                            : "transparent",
                          color: isSelected
                            ? "var(--ct-accent-fg)"
                            : "transparent",
                        }}
                      >
                        {isSelected ? <CheckIcon size={10} strokeWidth={2.8} /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className="px-4 py-3.5"
          style={{ borderTop: "1px solid var(--ct-border-light)" }}
        >
          <p className="mb-2.5 text-[12px]" style={{ color: "var(--ct-text3)" }}>
            {selectedFriends.length} member
            {selectedFriends.length === 1 ? "" : "s"} selected
          </p>
          <button
            type="button"
            className="h-11 w-full rounded-[16px] text-[15px] font-semibold"
            style={{
              background:
                groupName.trim() && selectedFriends.length > 0
                  ? "var(--ct-accent)"
                  : "var(--ct-field-bg)",
              color:
                groupName.trim() && selectedFriends.length > 0
                  ? "var(--ct-accent-fg)"
                  : "var(--ct-text3)",
              border:
                groupName.trim() && selectedFriends.length > 0
                  ? "1px solid transparent"
                  : "1px solid var(--ct-border-light)",
            }}
            onClick={handleSubmit}
            disabled={!groupName.trim() || selectedFriends.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateGroupModal;

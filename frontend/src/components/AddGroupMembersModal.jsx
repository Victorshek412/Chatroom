import { CheckIcon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
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

function AddGroupMembersModal({
  isOpen,
  group,
  friends,
  onClose,
  onAddMembers,
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef(null);
  const searchInputRef = useRef(null);
  const safeFriends = friends ?? [];

  const resetForm = () => {
    setQuery("");
    setSelectedIds([]);
    setIsSubmitting(false);
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
    initialFocusRef: searchInputRef,
    onClose: closeFromEffect,
  });

  const currentMemberIds = useMemo(
    () =>
      new Set(
        (Array.isArray(group?.members) ? group.members : []).map((member) =>
          normalizeId(member._id),
        ),
      ),
    [group?.members],
  );

  const availableFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return safeFriends.filter((friend) => {
      const friendId = normalizeId(friend._id);
      if (currentMemberIds.has(friendId)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const fullName = String(friend.fullName || "").toLowerCase();
      const contactId = String(friend.friendId || "").toLowerCase();
      return (
        fullName.includes(normalizedQuery) ||
        contactId.includes(normalizedQuery)
      );
    });
  }, [currentMemberIds, query, safeFriends]);

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

  const handleSubmit = async () => {
    if (selectedFriends.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const didAddMembers = await onAddMembers(selectedFriends);
      if (didAddMembers !== false) {
        resetForm();
      } else {
        setIsSubmitting(false);
      }
    } catch {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !group) {
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
        aria-labelledby="add-group-members-modal-title"
        data-testid="add-group-members-modal"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: "var(--ct-avatar-bg)",
                color: "var(--ct-avatar-text)",
              }}
            >
              <UserPlusIcon size={16} />
            </div>
            <div>
              <h2
                id="add-group-members-modal-title"
                className="text-[18px] font-semibold"
                style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
              >
                Add members
              </h2>
              <p className="text-[11px]" style={{ color: "var(--ct-text3)" }}>
                Invite accepted friends who are not already in {group.name}.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={handleClose}
            aria-label="Close add members dialog"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
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
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-[14px] outline-none"
              style={{ color: "var(--ct-text1)" }}
              placeholder="Search friends"
            />
            {query ? (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ color: "var(--ct-text3)" }}
                onClick={() => setQuery("")}
                aria-label="Clear add members search"
              >
                <XIcon size={12} />
              </button>
            ) : null}
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
              {availableFriends.length}
            </p>
          </div>

          <div className="hidden-scrollbar max-h-[220px] overflow-y-auto">
            {availableFriends.length === 0 ? (
              <div
                className="rounded-[16px] px-4 py-4 text-center text-[13px]"
                style={{ background: "var(--ct-panel)", color: "var(--ct-text3)" }}
              >
                No friends available to add.
              </div>
            ) : (
              <div className="space-y-2">
                {availableFriends.map((friend) => {
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
                      data-testid={`addable-group-friend-${friendId}`}
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
          className="flex items-center justify-between gap-3 px-4 py-3.5"
          style={{ borderTop: "1px solid var(--ct-border-light)" }}
        >
          <p className="text-[12px]" style={{ color: "var(--ct-text3)" }}>
            {selectedFriends.length} member
            {selectedFriends.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold"
              style={{
                background: "var(--ct-field-bg)",
                color: "var(--ct-text2)",
                border: "1px solid var(--ct-border-light)",
              }}
              onClick={handleClose}
              disabled={isSubmitting}
              data-testid="cancel-add-group-members"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold"
              style={{
                background:
                  selectedFriends.length > 0
                    ? "var(--ct-accent)"
                    : "var(--ct-field-bg)",
                color:
                  selectedFriends.length > 0
                    ? "var(--ct-accent-fg)"
                    : "var(--ct-text3)",
                border: "1px solid transparent",
              }}
              onClick={handleSubmit}
              disabled={selectedFriends.length === 0 || isSubmitting}
              data-testid="add-group-members-submit"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddGroupMembersModal;

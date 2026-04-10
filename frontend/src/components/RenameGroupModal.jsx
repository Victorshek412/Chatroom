import { useEffect, useEffectEvent, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";

function RenameGroupModal({ isOpen, group, onClose, onSave }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setError("");
      setIsSubmitting(false);
      return;
    }

    setName(group?.name || "");
    setError("");
    setIsSubmitting(false);
  }, [group?.name, isOpen]);

  const closeFromEffect = useEffectEvent(() => {
    setError("");
    setIsSubmitting(false);
    onClose();
  });

  useFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
    onClose: closeFromEffect,
  });

  const trimmedName = name.trim();

  const handleSubmit = async () => {
    if (!trimmedName || isSubmitting) {
      setError("Enter a group name.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const didSave = await onSave(trimmedName);
      if (didSave !== false) {
        onClose();
        return;
      }
    } catch {
      // Parent handles the toast.
    }

    setIsSubmitting(false);
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
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[380px] overflow-hidden rounded-[22px]"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-group-modal-title"
        data-testid="rename-group-modal"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
        >
          <div>
            <h2
              id="rename-group-modal-title"
              className="text-[18px] font-semibold"
              style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
            >
              Rename group
            </h2>
            <p className="text-[11px]" style={{ color: "var(--ct-text3)" }}>
              Current name: {group.name}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={onClose}
            aria-label="Close rename group dialog"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
          <label
            htmlFor="rename-group-input"
            className="mb-2 block text-[11px] font-semibold uppercase"
            style={{ color: "var(--ct-text3)", letterSpacing: "0.08em" }}
          >
            Group name
          </label>
          <div
            className="flex items-center gap-2.5 rounded-[16px] px-3.5"
            style={{
              minHeight: 48,
              background: "var(--ct-field-bg)",
              border: "1px solid var(--ct-border-light)",
            }}
          >
            <input
              id="rename-group-input"
              ref={inputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              className="w-full bg-transparent text-[14px] outline-none"
              style={{ color: "var(--ct-text1)" }}
              placeholder="Enter group name"
              data-testid="rename-group-input"
            />
            {name ? (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ color: "var(--ct-text3)" }}
                onClick={() => setName("")}
              >
                <XIcon size={12} />
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="mt-2 text-[12px]" style={{ color: "var(--ct-destructive)" }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3.5"
          style={{ borderTop: "1px solid var(--ct-border-light)" }}
        >
          <button
            type="button"
            className="rounded-[14px] px-4 py-2 text-[13px] font-semibold"
            style={{
              background: "var(--ct-field-bg)",
              color: "var(--ct-text2)",
              border: "1px solid var(--ct-border-light)",
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-[14px] px-4 py-2 text-[13px] font-semibold"
            style={{
              background: trimmedName ? "var(--ct-accent)" : "var(--ct-field-bg)",
              color: trimmedName ? "var(--ct-accent-fg)" : "var(--ct-text3)",
              border: trimmedName
                ? "1px solid transparent"
                : "1px solid var(--ct-border-light)",
            }}
            onClick={handleSubmit}
            disabled={!trimmedName || isSubmitting}
            data-testid="save-group-name"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RenameGroupModal;

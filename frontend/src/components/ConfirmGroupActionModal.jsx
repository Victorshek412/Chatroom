import { useEffectEvent, useRef } from "react";
import { AlertTriangleIcon, XIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";

function ConfirmGroupActionModal({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmTone = "soft-destructive",
  confirmTestId,
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const closeFromEffect = useEffectEvent(() => {
    onClose();
  });

  useFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: confirmButtonRef,
    onClose: closeFromEffect,
  });

  if (!isOpen) {
    return null;
  }

  const isStrongDestructive = confirmTone === "destructive";

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
        className="w-full max-w-[360px] overflow-hidden rounded-[22px]"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-group-action-title"
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
                background: "var(--ct-destructive-bg)",
                color: "var(--ct-destructive)",
              }}
            >
              <AlertTriangleIcon size={16} />
            </div>
            <h2
              id="confirm-group-action-title"
              className="text-[18px] font-semibold"
              style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={onClose}
            aria-label="Close group action dialog"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
          <p
            className="text-[13px]"
            style={{ color: "var(--ct-text2)", lineHeight: 1.7 }}
          >
            {description}
          </p>
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
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="rounded-[14px] px-4 py-2 text-[13px] font-semibold"
            style={{
              background: isStrongDestructive
                ? "var(--ct-destructive)"
                : "transparent",
              color: isStrongDestructive
                ? "var(--ct-accent-fg)"
                : "var(--ct-destructive)",
              border: isStrongDestructive
                ? "1px solid transparent"
                : "1px solid var(--ct-border-light)",
            }}
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid={confirmTestId}
          >
            {isSubmitting ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmGroupActionModal;

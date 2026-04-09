import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CameraIcon, UploadIcon, UsersIcon, XIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "G";

function AvatarPreview({ name, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-[88px] w-[88px] rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-[88px] w-[88px] items-center justify-center rounded-full"
      style={{
        background: "var(--ct-avatar-bg)",
        color: "var(--ct-avatar-text)",
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <UsersIcon size={24} />
        <span className="text-[12px] font-semibold">{getInitials(name)}</span>
      </div>
    </div>
  );
}

function ChangeGroupAvatarModal({ isOpen, group, onClose, onSave }) {
  const dialogRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const fileInputRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState(undefined);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPreviewSrc("");
      setPendingAvatar(undefined);
      setError("");
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setPreviewSrc(group?.avatarUrl || "");
    setPendingAvatar(undefined);
    setError("");
    setIsSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [group?.avatarUrl, isOpen]);

  const closeFromEffect = useEffectEvent(() => {
    setError("");
    setIsSubmitting(false);
    onClose();
  });

  useFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: uploadButtonRef,
    onClose: closeFromEffect,
  });

  const hasChanges = pendingAvatar !== undefined;

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string" || !reader.result) {
        setError("Failed to read the selected image.");
        return;
      }

      setPreviewSrc(reader.result);
      setPendingAvatar(reader.result);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreviewSrc("");
    setPendingAvatar(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!hasChanges || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const didSave = await onSave(pendingAvatar);
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
        className="w-full max-w-[390px] overflow-hidden rounded-[22px]"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-group-avatar-modal-title"
        data-testid="change-group-avatar-modal"
        tabIndex={-1}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--ct-border-light)" }}
        >
          <div>
            <h2
              id="change-group-avatar-modal-title"
              className="text-[18px] font-semibold"
              style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
            >
              Change group avatar
            </h2>
            <p className="text-[11px]" style={{ color: "var(--ct-text3)" }}>
              Update the avatar shown in the sidebar and header.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: "var(--ct-icon)" }}
            onClick={onClose}
            aria-label="Close change group avatar dialog"
          >
            <XIcon size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center">
              <AvatarPreview name={group.name} src={previewSrc} />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              data-testid="group-avatar-input"
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                ref={uploadButtonRef}
                type="button"
                className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2 text-[13px] font-semibold"
                style={{
                  background: "var(--ct-field-bg)",
                  color: "var(--ct-text1)",
                  border: "1px solid var(--ct-border-light)",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon size={14} />
                Upload image
              </button>
              {(previewSrc || group.avatarUrl) ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2 text-[13px] font-semibold"
                  style={{
                    background: "transparent",
                    color: "var(--ct-destructive)",
                    border: "1px solid var(--ct-border-light)",
                  }}
                  onClick={handleRemove}
                  data-testid="remove-group-avatar"
                >
                  <CameraIcon size={14} />
                  Remove avatar
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-[12px]" style={{ color: "var(--ct-destructive)" }}>
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
              background: hasChanges ? "var(--ct-accent)" : "var(--ct-field-bg)",
              color: hasChanges ? "var(--ct-accent-fg)" : "var(--ct-text3)",
              border: hasChanges
                ? "1px solid transparent"
                : "1px solid var(--ct-border-light)",
            }}
            onClick={handleSubmit}
            disabled={!hasChanges || isSubmitting}
            data-testid="save-group-avatar"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeGroupAvatarModal;

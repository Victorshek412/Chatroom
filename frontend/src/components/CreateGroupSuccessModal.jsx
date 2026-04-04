import { useEffect, useEffectEvent, useRef } from "react";
import { UsersIcon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap";

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

function CreateGroupSuccessModal({ group, onComplete }) {
  const dialogRef = useRef(null);
  const members = Array.isArray(group?.members) ? group.members : [];
  const closeFromEffect = useEffectEvent(() => {
    if (group?.id) {
      onComplete(group.id);
    }
  });

  useFocusTrap({
    isOpen: Boolean(group),
    containerRef: dialogRef,
    onClose: closeFromEffect,
  });

  useEffect(() => {
    if (!group) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      closeFromEffect();
    }, 1700);

    return () => window.clearTimeout(timer);
  }, [group]);

  if (!group) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(14, 15, 19, 0.28)" }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[500px] rounded-[30px] px-8 py-10 text-center"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-shadow-md)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-success-title"
        tabIndex={-1}
      >
        <div
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "var(--ct-avatar-bg)", color: "var(--ct-avatar-text)" }}
        >
          <UsersIcon size={32} />
        </div>

        <h2
          id="create-group-success-title"
          className="text-[28px] font-semibold"
          style={{ color: "var(--ct-text1)", letterSpacing: "-0.03em" }}
        >
          "{group.name}" created
        </h2>
        <p className="mt-3 text-lg" style={{ color: "var(--ct-text2)" }}>
          {members.length > 0
            ? `${members.map((member) => member.fullName).join(" & ")} joined the group.`
            : "Your group is ready."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {members.map((member) => (
            <div
              key={member._id}
              className="inline-flex items-center gap-2 rounded-[16px] px-3 py-2"
              style={{
                background: "var(--ct-active-bg)",
                border: "1px solid var(--ct-active-border)",
                color: "var(--ct-text1)",
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: "var(--ct-avatar-bg)",
                  color: "var(--ct-avatar-text)",
                }}
              >
                {getInitials(member.fullName)}
              </span>
              <span>{member.fullName}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm" style={{ color: "var(--ct-text3)" }}>
          Redirecting to group...
        </p>
      </div>
    </div>
  );
}

export default CreateGroupSuccessModal;

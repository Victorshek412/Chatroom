import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FileTextIcon,
  FolderOpenIcon,
  ImageIcon,
  InboxIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  SendIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import MessageAttachment from "./MessageAttachment";
import {
  MAX_MESSAGE_ATTACHMENT_SIZE,
  formatAttachmentSize,
  getAttachmentTypeLabel,
  isImageAttachmentType,
  isPdfAttachmentType,
} from "../lib/messageAttachments";

const formatMessageTime = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const getSenderAvatarText = (message, fallbackInitials) => {
  if (message.senderAvatarText) {
    return message.senderAvatarText;
  }

  if (!message.senderName) {
    return fallbackInitials;
  }

  return message.senderName
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getSenderAvatarUrl = (message, fallbackUrl = "") =>
  message.senderAvatarUrl || fallbackUrl || "";

function Avatar({ initials, src = "", alt = "Avatar", size = 28 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--ct-avatar-bg)",
        color: "var(--ct-avatar-text)",
      }}
    >
      <span
        className="select-none font-semibold"
        style={{ fontSize: size * 0.33, letterSpacing: "0.01em" }}
      >
        {initials}
      </span>
    </div>
  );
}

function StatusDot({ status, borderColor }) {
  const background =
    status === "online"
      ? "var(--ct-status-green)"
      : status === "away"
        ? "var(--ct-status-amber)"
        : "var(--ct-status-gray)";

  return (
    <span
      className="absolute bottom-0 right-0 block h-[8px] w-[8px] rounded-full border-[1.5px]"
      style={{ backgroundColor: background, borderColor }}
    />
  );
}

function HeaderMenu({
  requestCount,
  onOpenAddContact,
  onOpenCreateGroup,
  onOpenRequests,
  onCloseConversation,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const runAction = (callback) => {
    callback();
    window.setTimeout(() => {
      setIsOpen(false);
    }, 0);
  };

  const menuItems = [
    {
      label: "Add Contact",
      icon: <UserPlusIcon size={13} strokeWidth={2} />,
      onClick: onOpenAddContact,
      testId: "open-add-contact",
    },
    {
      label: "Create Group",
      icon: <UsersIcon size={13} strokeWidth={2} />,
      onClick: onOpenCreateGroup,
      testId: "open-create-group",
    },
    {
      label: "Requests",
      icon: <InboxIcon size={13} strokeWidth={2} />,
      onClick: onOpenRequests,
      badge: requestCount,
      testId: "open-requests",
    },
    {
      label: "Close chat",
      icon: <XIcon size={13} strokeWidth={2} />,
      onClick: onCloseConversation,
      testId: "close-chat-action",
    },
  ];

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        className="relative rounded-lg p-1.5"
        style={{
          color: isOpen || isHovered ? "var(--ct-text2)" : "var(--ct-icon-cw)",
          background: isOpen || isHovered ? "var(--ct-icon-hover)" : "transparent",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsOpen((current) => !current)}
        data-testid="chat-actions-trigger"
      >
        <MoreHorizontalIcon size={16} strokeWidth={1.9} />
        {requestCount > 0 ? (
          <span
            className="absolute -right-1 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1"
            style={{
              background: "var(--ct-count-badge-bg)",
              color: "var(--ct-count-badge-text)",
              fontSize: 9.5,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {requestCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[172px] rounded-[14px] p-[3px]"
          style={{
            background: "var(--ct-surface)",
            border: "1px solid var(--ct-border)",
            boxShadow: "var(--ct-card-shadow)",
          }}
        >
          {menuItems.map((item, index) => (
            <div key={item.label}>
              <button
                type="button"
                className="flex h-[33px] w-full items-center gap-[9px] rounded-[8px] px-[11px] text-left"
                style={{
                  color: "var(--ct-text2)",
                  transition: "background 100ms ease, color 100ms ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "var(--ct-hover-bg)";
                  event.currentTarget.style.color = "var(--ct-text1)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.color = "var(--ct-text2)";
                }}
                onClick={() => runAction(item.onClick)}
                data-testid={item.testId}
              >
                <span className="shrink-0">{item.icon}</span>
                <span
                  className="flex-1 whitespace-nowrap"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 450,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1"
                    style={{
                      background: "var(--ct-count-badge-bg)",
                      color: "var(--ct-count-badge-text)",
                      fontSize: 9.5,
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
              {index === 2 ? (
                <div
                  className="mx-2 my-[2px] h-px"
                  style={{ background: "var(--ct-border-light)" }}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PendingAttachment({ attachment, isUploading, onRemove }) {
  if (!attachment && !isUploading) {
    return null;
  }

  const attachmentTypeLabel = attachment ? getAttachmentTypeLabel(attachment) : "";

  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-2.5"
      style={{ borderColor: "var(--ct-border-light)" }}
      data-testid="pending-attachment"
    >
      {isUploading ? (
        <LoaderCircleIcon
          size={14}
          className="animate-spin"
          style={{ color: "var(--ct-text3)" }}
        />
      ) : attachment?.kind === "image" ? (
        <img
          src={attachment.url}
          alt={attachment.originalName}
          className="h-7 w-7 rounded-[6px] object-cover"
        />
      ) : (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[6px]"
          style={{ background: "var(--ct-active-bg)", color: "var(--ct-text1)" }}
        >
          <FileTextIcon size={12} strokeWidth={1.8} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: "var(--ct-text1)",
            letterSpacing: "-0.01em",
          }}
        >
          {isUploading ? "Uploading attachment..." : attachment?.originalName}
        </p>
        {!isUploading && attachment ? (
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--ct-text2)" }}>
            {attachmentTypeLabel} - {formatAttachmentSize(attachment.size)}
          </p>
        ) : null}
      </div>

      {!isUploading && attachment ? (
        <button
          type="button"
          className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px]"
          style={{ color: "var(--ct-text3)" }}
          onClick={onRemove}
          data-testid="remove-attachment"
        >
          <XIcon size={11} strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}

function Composer({
  conversation,
  onSendMessage,
  onUploadAttachment,
  isSoundEnabled,
}) {
  const [text, setText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const skipNextPendingCleanupRef = useRef(false);
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const canSend = Boolean(text.trim() || pendingAttachment);

  const revokePendingAttachment = (attachment) => {
    if (attachment?.isLocalObjectUrl && attachment.url) {
      URL.revokeObjectURL(attachment.url);
    }
  };

  useEffect(() => () => {
    if (skipNextPendingCleanupRef.current) {
      skipNextPendingCleanupRef.current = false;
      return;
    }

    revokePendingAttachment(pendingAttachment);
  }, [pendingAttachment]);

  useEffect(() => {
    setText("");
    setPendingAttachment(null);
    setIsUploadingAttachment(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [conversation?.id]);

  const resetInputs = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachmentSelection = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isValidType =
      type === "image"
        ? isImageAttachmentType(file.type)
        : isPdfAttachmentType(file.type);

    if (!isValidType) {
      toast.error(
        type === "image" ? "Only image files are allowed." : "Only PDF files are allowed.",
      );
      resetInputs();
      return;
    }

    if (file.size > MAX_MESSAGE_ATTACHMENT_SIZE) {
      toast.error("Attachment must be 5 MB or smaller.");
      resetInputs();
      return;
    }

    setIsUploadingAttachment(true);

    try {
      const attachment = await onUploadAttachment(file);
      setPendingAttachment((currentAttachment) => {
        revokePendingAttachment(currentAttachment);
        return attachment;
      });
    } catch (error) {
      toast.error(error.message || "Failed to upload attachment.");
      resetInputs();
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    let didSend = false;

    try {
      didSend = await onSendMessage({
        text: text.trim(),
        attachment: pendingAttachment,
      });
    } catch (error) {
      toast.error(error.message || "Failed to send message.");
      return;
    }

    if (!didSend) {
      return;
    }

    if (conversation?.kind === "group" && pendingAttachment?.isLocalObjectUrl) {
      skipNextPendingCleanupRef.current = true;
    }

    setText("");
    setPendingAttachment(null);
    resetInputs();
  };

  return (
    <div
      className="shrink-0 px-5 py-4"
      style={{
        background: "var(--ct-surface)",
        borderTop: "1px solid var(--ct-border)",
      }}
    >
      <form onSubmit={handleSend}>
        <div
          className="flex flex-col overflow-hidden rounded-2xl"
          style={{
            background: "var(--ct-field-bg)",
            border: isFocused
              ? "1.5px solid var(--ct-field-focus)"
              : "1.5px solid var(--ct-field-border)",
            boxShadow: "var(--ct-field-shadow)",
          }}
        >
          <PendingAttachment
            attachment={pendingAttachment}
            isUploading={isUploadingAttachment}
            onRemove={() => {
              setPendingAttachment(null);
              resetInputs();
            }}
          />

          <div className="flex items-center gap-2 px-2" style={{ height: 48 }}>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleAttachmentSelection(event, "image")}
              data-testid="image-attachment-input"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => handleAttachmentSelection(event, "file")}
              data-testid="file-attachment-input"
            />

            <button
              type="button"
              className="shrink-0 rounded-lg p-1.5"
              style={{ color: "var(--ct-icon-cw)" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "var(--ct-icon-hover)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingAttachment || Boolean(pendingAttachment)}
              data-testid="image-attachment-button"
            >
              <ImageIcon size={20} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1.5"
              style={{ color: "var(--ct-icon-cw)" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "var(--ct-icon-hover)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment || Boolean(pendingAttachment)}
              data-testid="file-attachment-button"
            >
              <FolderOpenIcon size={20} strokeWidth={1.9} />
            </button>

            <input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (isSoundEnabled) {
                  playRandomKeyStrokeSound();
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--ct-text1)", caretColor: "var(--ct-accent)" }}
              placeholder="Message..."
              data-testid="message-input"
            />

            <button
              type="submit"
              className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl"
              style={{
                background: canSend ? "var(--ct-send-bg)" : "transparent",
                color: canSend ? "var(--ct-send-fg)" : "var(--ct-icon-cw)",
              }}
              onMouseEnter={(event) => {
                if (!canSend) {
                  event.currentTarget.style.background = "var(--ct-icon-hover)";
                }
              }}
              onMouseLeave={(event) => {
                if (!canSend) {
                  event.currentTarget.style.background = "transparent";
                }
              }}
              disabled={!canSend || isUploadingAttachment}
              data-testid="send-message"
            >
              <SendIcon
                size={18}
                strokeWidth={1.9}
                style={{ marginLeft: "-1px", marginTop: "1px" }}
              />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ conversation }) {
  if (!conversation) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center px-8 text-center"
        data-testid="no-conversation-placeholder"
      >
        <MessageCircleIcon size={24} style={{ color: "var(--ct-text3)" }} />
        <h2
          className="mt-3 text-sm font-semibold"
          style={{ color: "var(--ct-text1)", letterSpacing: "-0.01em" }}
        >
          No conversation selected
        </h2>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--ct-text2)", maxWidth: 220, lineHeight: 1.7 }}
        >
          Choose a contact from the sidebar to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <Avatar
        initials={conversation.avatarText}
        src={conversation.avatarUrl}
        alt={conversation.title}
        size={44}
      />
      <div className="mt-1 text-center">
        <p
          className="text-[13px] font-semibold"
          style={{ color: "var(--ct-text2)", letterSpacing: "-0.01em" }}
        >
          {conversation.kind === "group" ? "Group created" : "Start the conversation"}
        </p>
        <p className="mt-[3px] text-[11.5px]" style={{ color: "var(--ct-text3)" }}>
          {conversation.kind === "group"
            ? `Send the first message to ${conversation.title}`
            : `Say hello to ${conversation.title}`}
        </p>
      </div>
    </div>
  );
}

function ChatWindow({
  conversation,
  currentUser,
  onSendMessage,
  onUploadAttachment,
  onCloseConversation,
  onOpenAddContact,
  onOpenCreateGroup,
  onOpenRequests,
  requestCount,
}) {
  const scrollerRef = useRef(null);
  const messageCount = conversation?.messages?.length ?? 0;
  const lastMessage = messageCount > 0
    ? conversation.messages[messageCount - 1]
    : null;
  const lastMessageKey =
    lastMessage?.id || lastMessage?._id || lastMessage?.createdAt || null;

  useEffect(() => {
    if (!messageCount || !scrollerRef.current) {
      return;
    }

    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [lastMessageKey, messageCount]);

  const headerStatus = conversation?.statusLabel || "";
  const headerStatusTone = conversation?.status || "offline";
  const headerStatusColor =
    headerStatusTone === "online"
      ? "var(--ct-status-green)"
      : headerStatusTone === "away"
        ? "var(--ct-status-amber)"
        : "var(--ct-text3)";

  return (
    <section
      className="flex h-full flex-1 flex-col overflow-hidden"
      style={{ background: "var(--ct-surface)", position: "relative" }}
    >
      {conversation ? (
        <>
          <header
            className="flex shrink-0 items-center justify-between px-5 py-3.5"
            style={{
              background: "var(--ct-surface)",
              borderBottom: "1px solid var(--ct-border-light)",
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative">
                <Avatar
                  initials={conversation.avatarText}
                  src={conversation.avatarUrl}
                  alt={conversation.title}
                  size={34}
                />
                {conversation.kind !== "group" ? (
                  <StatusDot
                    status={headerStatusTone}
                    borderColor="var(--ct-surface)"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <h2
                  className="truncate text-sm font-semibold"
                  style={{ color: "var(--ct-text1)", letterSpacing: "-0.01em" }}
                >
                  <span data-testid="chat-header-name">{conversation.title}</span>
                </h2>
                <p className="text-[11px]" style={{ color: headerStatusColor }}>
                  {headerStatus}
                </p>
              </div>
            </div>

            <HeaderMenu
              requestCount={requestCount}
              onOpenAddContact={onOpenAddContact}
              onOpenCreateGroup={onOpenCreateGroup}
              onOpenRequests={onOpenRequests}
              onCloseConversation={onCloseConversation}
            />
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            {conversation.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <LoaderCircleIcon
                  className="animate-spin"
                  size={22}
                  style={{ color: "var(--ct-text3)" }}
                />
              </div>
            ) : conversation.messages.length === 0 ? (
              <EmptyState conversation={conversation} />
            ) : (
              <div
                ref={scrollerRef}
                className="hidden-scrollbar flex-1 overflow-y-auto px-8 py-6"
                style={{
                  background: "var(--ct-chat-bg)",
                  scrollbarWidth: "thin",
                  scrollbarColor: "var(--ct-scrollbar) transparent",
                }}
                data-testid="message-list"
              >
                {conversation.messages.map((message, index) => {
                  const isOwnMessage =
                    String(message.senderId) === String(currentUser.id);
                  const previousMessage = conversation.messages[index - 1];
                  const nextMessage = conversation.messages[index + 1];
                  const isFirstInGroup =
                    !previousMessage ||
                    String(previousMessage.senderId) !== String(message.senderId);
                  const isLastInGroup =
                    !nextMessage ||
                    String(nextMessage.senderId) !== String(message.senderId);
                  const senderLabel = message.senderName || conversation.title;
                  const senderAvatarText = getSenderAvatarText(
                    message,
                    conversation.avatarText,
                  );
                  const senderAvatarUrl = getSenderAvatarUrl(
                    message,
                    !isOwnMessage && conversation.kind === "direct"
                      ? conversation.avatarUrl
                      : "",
                  );

                  return (
                    <div
                      key={message.id}
                      style={{ marginTop: index === 0 ? 0 : isFirstInGroup ? 12 : 6 }}
                    >
                      <div
                        className={`flex items-start gap-2.5 ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                          {!isOwnMessage ? (
                          <div className="w-7 shrink-0">
                            {isFirstInGroup ? (
                              <Avatar
                                initials={senderAvatarText}
                                src={senderAvatarUrl}
                                alt={senderLabel}
                                size={27}
                              />
                            ) : (
                              <div style={{ width: 27 }} />
                            )}
                          </div>
                        ) : null}

                        <div
                          className={`flex max-w-[58%] flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                        >
                          {isFirstInGroup && !isOwnMessage ? (
                            <span
                              className="mb-1 px-1 text-[10px] font-medium"
                              style={{ color: "var(--ct-text3)" }}
                            >
                              {senderLabel}
                            </span>
                          ) : null}

                          {message.attachment ? (
                            <div
                              className={message.text ? "mb-2" : ""}
                              style={{ width: "fit-content", maxWidth: "100%" }}
                            >
                              <MessageAttachment
                                attachment={message.attachment}
                                isOwnMessage={isOwnMessage}
                              />
                            </div>
                          ) : null}

                          {message.text ? (
                            <div
                              className="min-w-[48px] rounded-[18px] px-[14px] py-[9px]"
                              style={{
                                width: "fit-content",
                                background: "var(--ct-bubble-bg)",
                                color: "var(--ct-bubble-text)",
                              }}
                            >
                              <p className="text-[14px]" style={{ lineHeight: 1.45 }}>
                                {message.text}
                              </p>
                            </div>
                          ) : null}

                          {isLastInGroup ? (
                            <div
                              className={`mt-1 flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                              style={{ width: "100%" }}
                            >
                              <span
                                className="px-1 text-[10px]"
                                style={{ color: "var(--ct-text3)" }}
                              >
                                {formatMessageTime(message.createdAt)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Composer
              conversation={conversation}
              onSendMessage={onSendMessage}
              onUploadAttachment={onUploadAttachment}
              isSoundEnabled={conversation.isSoundEnabled}
            />
          </div>
        </>
      ) : (
        <EmptyState conversation={null} />
      )}
    </section>
  );
}

export default ChatWindow;

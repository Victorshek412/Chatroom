import { useRef, useState } from "react";
import {
  LoaderCircleIcon,
  LogOutIcon,
  MessageCircleIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SunIcon,
  UsersIcon,
  Volume2Icon,
  VolumeOffIcon,
} from "lucide-react";
import { useTheme } from "./ThemeContext";

const normalizeForTestId = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

const normalizeId = (value) => value?.toString?.() ?? String(value ?? "");

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

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

function EmptyList({ isContacts }) {
  const Icon = isContacts ? UsersIcon : MessageCircleIcon;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <Icon size={22} strokeWidth={1.6} style={{ color: "var(--ct-text3)" }} />
      <p
        className="mt-2 text-[12px] font-medium"
        style={{ color: "var(--ct-text3)", letterSpacing: "-0.01em" }}
        data-testid={isContacts ? "empty-friends-state" : undefined}
      >
        {isContacts ? "No contacts yet" : "No conversations yet"}
      </p>
      <p
        className="mt-1 text-[11px]"
        style={{ color: "var(--ct-text3)", lineHeight: 1.6, opacity: 0.75 }}
      >
        {isContacts
          ? "Use Add Contact to start messaging."
          : "Choose a contact to begin."}
      </p>
    </div>
  );
}

function LoadingList({ isContacts }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <LoaderCircleIcon
        size={20}
        className="animate-spin"
        style={{ color: "var(--ct-text3)" }}
      />
      <p
        className="mt-2 text-[12px] font-medium"
        style={{ color: "var(--ct-text3)", letterSpacing: "-0.01em" }}
      >
        {isContacts ? "Loading contacts..." : "Loading chats..."}
      </p>
    </div>
  );
}

function ListItem({ item, isActive, isContacts, onSelect }) {
  const testIdPrefix = isContacts ? "friend-item" : "chat-item";
  const [isHovered, setIsHovered] = useState(false);
  const previewText = isContacts ? item.secondaryText : "\u00A0";
  const avatarBorder = isActive ? "transparent" : "var(--ct-sidebar)";
  const avatarTextColor = isActive
    ? "var(--ct-avatar-text-act)"
    : "var(--ct-avatar-text)";
  const avatarBackground = isActive
    ? "var(--ct-avatar-bg-act)"
    : "var(--ct-avatar-bg)";
  const contactStatusColor =
    item.status === "online"
      ? "var(--ct-status-green)"
      : item.status === "away"
        ? "var(--ct-status-amber)"
        : "var(--ct-text3)";

  return (
    <button
      type="button"
      className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-[9px] text-left"
      style={{
        background:
          isActive ? "var(--ct-active-bg)" : isHovered ? "var(--ct-hover-bg)" : "transparent",
        border: isActive
          ? "1px solid var(--ct-active-border)"
          : "1px solid transparent",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      data-testid={`${testIdPrefix}-${normalizeForTestId(item.testId)}`}
    >
      {isActive ? (
        <span
          className="absolute left-0 top-[10px] bottom-[10px] w-[2.5px] rounded-r-full"
          style={{ background: "var(--ct-accent)" }}
        />
      ) : null}

      <div className="relative shrink-0">
        {item.avatarUrl ? (
          <img
            src={item.avatarUrl}
            alt={item.title}
            className="h-[35px] w-[35px] rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-[35px] w-[35px] items-center justify-center rounded-full"
            style={{
              background: avatarBackground,
              color: avatarTextColor,
            }}
          >
            <span className="select-none text-[11.5px] font-semibold tracking-[0.01em]">
              {item.avatarText}
            </span>
          </div>
        )}
        {item.kind !== "group" ? (
          <StatusDot status={item.status} borderColor={avatarBorder} />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className="truncate text-[13px]"
            style={{
              color: isActive ? "var(--ct-accent)" : "var(--ct-text1)",
              fontWeight: isActive ? 600 : 500,
              letterSpacing: "-0.01em",
            }}
          >
            {item.title}
          </span>
          {item.timeLabel ? (
            <span
              className="shrink-0 text-[10px]"
              style={{ color: "var(--ct-text3)" }}
            >
              {item.timeLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-[2px] flex items-center justify-between gap-1">
          <p
            className="truncate text-[11.5px]"
            style={{
              color: isContacts
                ? contactStatusColor
                : isActive
                  ? "var(--ct-text2)"
                  : "var(--ct-text3)",
            }}
          >
            {previewText}
          </p>
          {!isContacts && item.unreadCount > 0 ? (
            <span
              className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full px-1 text-[9.5px] font-semibold"
              style={{
                background: "var(--ct-badge-bg)",
                color: "var(--ct-badge-fg)",
              }}
            >
              {item.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function SidebarIconButton({ title, onClick, children, testId, highlight = false }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      className="rounded-md p-1.5"
      style={{
        color:
          highlight && isHovered ? "var(--ct-text1)" : "var(--ct-icon)",
        background: isHovered ? "var(--ct-icon-hover)" : "transparent",
      }}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function ProfileAvatar({ name, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-[34px] w-[34px] rounded-full object-cover"
        data-testid="profile-avatar-image"
      />
    );
  }

  return (
    <div
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
      style={{
        background: "var(--ct-avatar-bg)",
        color: "var(--ct-avatar-text)",
      }}
      data-testid="profile-avatar-image"
    >
      <span className="select-none text-[11.5px] font-semibold tracking-[0.01em]">
        {getInitials(name)}
      </span>
    </div>
  );
}

function ChatSidebar({
  authUser,
  onlineUsers,
  activeTab,
  onChangeTab,
  activeConversationId,
  chatItems,
  contactItems,
  onSelectConversation,
  onProfileImageUpload,
  onLogout,
  isSoundEnabled,
  onToggleSound,
  isLoading,
}) {
  const { isDark, toggle } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [previewAvatarSrc, setPreviewAvatarSrc] = useState("");
  const fileInputRef = useRef(null);
  const onlineUserIds = new Set((onlineUsers || []).map((entry) => normalizeId(entry)));
  const currentStatus = onlineUserIds.has(normalizeId(authUser._id))
    ? "online"
    : "offline";
  const visibleItems = activeTab === "chats" ? chatItems : contactItems;
  const profileAvatarSrc = previewAvatarSrc || authUser.profilePicture || "";

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      if (typeof base64Image !== "string" || !base64Image) {
        return;
      }

      setPreviewAvatarSrc(base64Image);

      try {
        const updatedUser = await onProfileImageUpload(base64Image);
        setPreviewAvatarSrc(updatedUser?.profilePicture || base64Image);
      } catch {
        setPreviewAvatarSrc("");
      }
    };
    reader.readAsDataURL(file);
  };

  if (isCollapsed) {
    return (
      <aside
        className="flex h-full flex-col"
        style={{
          width: 60,
          background: "var(--ct-sidebar)",
          borderRight: "1px solid var(--ct-border)",
        }}
      >
        <div
          className="relative flex items-center justify-center py-3.5"
          style={{
            background: "var(--ct-panel)",
            borderBottom: "1px solid var(--ct-border-light)",
          }}
        >
          <div className="invisible select-none pointer-events-none flex flex-col">
            <span className="text-sm">ghost</span>
            <span className="text-[11px]">ghost</span>
          </div>
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center rounded-md"
            style={{ color: "var(--ct-icon)" }}
            onClick={() => setIsCollapsed(false)}
            title="Expand sidebar"
          >
            <PanelLeftOpenIcon size={16} strokeWidth={1.9} />
          </button>
        </div>
        <div className="flex-1" />
        <div
          className="flex items-center justify-center py-2.5"
          style={{ borderTop: "1px solid var(--ct-border-light)" }}
        >
          <SidebarIconButton title="Log out" onClick={onLogout} testId="logout-button">
            <LogOutIcon size={15} strokeWidth={1.9} />
          </SidebarIconButton>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full flex-col"
      style={{
        width: 230,
        background: "var(--ct-sidebar)",
        borderRight: "1px solid var(--ct-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-3.5 py-3.5"
        style={{
          background: "var(--ct-panel)",
          borderBottom: "1px solid var(--ct-border-light)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <button
              type="button"
              className="block rounded-full"
              onClick={() => fileInputRef.current?.click()}
              data-testid="profile-avatar-button"
            >
              <ProfileAvatar name={authUser.fullName} src={profileAvatarSrc} />
            </button>
            <StatusDot status={currentStatus} borderColor="var(--ct-panel)" />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
            data-testid="profile-avatar-input"
          />

          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--ct-text1)", letterSpacing: "-0.01em" }}
            >
              {authUser.fullName}
            </p>
            <p
              className="text-[11px]"
              style={{
                color:
                  currentStatus === "online"
                    ? "var(--ct-status-green)"
                    : "var(--ct-text3)",
              }}
            >
              {currentStatus === "online" ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <SidebarIconButton
            title={isSoundEnabled ? "Mute sounds" : "Enable sounds"}
            onClick={onToggleSound}
            testId="sound-toggle"
          >
            {isSoundEnabled ? (
              <Volume2Icon size={16} strokeWidth={1.9} />
            ) : (
              <VolumeOffIcon size={16} strokeWidth={1.9} />
            )}
          </SidebarIconButton>
          <SidebarIconButton
            title={isDark ? "Light mode" : "Dark mode"}
            onClick={toggle}
          >
            {isDark ? (
              <SunIcon size={16} strokeWidth={1.9} />
            ) : (
              <MoonIcon size={16} strokeWidth={1.9} />
            )}
          </SidebarIconButton>
          <SidebarIconButton
            title="Collapse sidebar"
            onClick={() => setIsCollapsed(true)}
            highlight
          >
            <PanelLeftCloseIcon size={16} strokeWidth={1.9} />
          </SidebarIconButton>
        </div>
      </div>

      <div className="flex gap-1 px-3 pb-2 pt-3">
        <button
          type="button"
          className="flex-1 rounded-xl py-[6px] text-[13px]"
          style={{
            background:
              activeTab === "chats" ? "var(--ct-tab-active-bg)" : "transparent",
            color:
              activeTab === "chats"
                ? "var(--ct-accent)"
                : "var(--ct-tab-inactive)",
            fontWeight: activeTab === "chats" ? 600 : 400,
            letterSpacing: "-0.01em",
            boxShadow: activeTab === "chats" ? "var(--ct-tab-shadow)" : "none",
            border:
              activeTab === "chats"
                ? "1px solid var(--ct-tab-border)"
                : "1px solid transparent",
          }}
          onClick={() => onChangeTab("chats")}
          data-testid="tab-chats"
        >
          Chats
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl py-[6px] text-[13px]"
          style={{
            background:
              activeTab === "contacts" ? "var(--ct-tab-active-bg)" : "transparent",
            color:
              activeTab === "contacts"
                ? "var(--ct-accent)"
                : "var(--ct-tab-inactive)",
            fontWeight: activeTab === "contacts" ? 600 : 400,
            letterSpacing: "-0.01em",
            boxShadow:
              activeTab === "contacts" ? "var(--ct-tab-shadow)" : "none",
            border:
              activeTab === "contacts"
                ? "1px solid var(--ct-tab-border)"
                : "1px solid transparent",
          }}
          onClick={() => onChangeTab("contacts")}
          data-testid="tab-friends"
        >
          Contacts
        </button>
      </div>

      <div
        className="hidden-scrollbar flex flex-1 flex-col overflow-y-auto px-2 pb-2"
      >
        {isLoading ? (
          <LoadingList isContacts={activeTab === "contacts"} />
        ) : visibleItems.length === 0 ? (
          <EmptyList isContacts={activeTab === "contacts"} />
        ) : (
          <>
            {visibleItems.map((item) => (
              <ListItem
                key={item.id}
                item={item}
                isContacts={activeTab === "contacts"}
                isActive={item.id === activeConversationId}
                onSelect={() => onSelectConversation(item)}
              />
            ))}
          </>
        )}
      </div>

      <div
        className="px-3 py-2.5"
        style={{ borderTop: "1px solid var(--ct-border-light)" }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left"
          style={{ color: "var(--ct-text3)" }}
          onClick={onLogout}
          data-testid="logout-button"
        >
          <LogOutIcon size={15} strokeWidth={1.9} />
          <span className="text-[12.5px]" style={{ letterSpacing: "-0.01em" }}>
            Log out
          </span>
        </button>
      </div>
    </aside>
  );
}

export default ChatSidebar;

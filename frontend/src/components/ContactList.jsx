import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";

const getFriendTestId = (friendId) =>
  `friend-item-${String(friendId).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function ContactList() {
  const { setSelectedUser } = useChatStore();
  const { fetchAcceptedFriends, friends, isFriendsLoading } = useFriendStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    fetchAcceptedFriends();
  }, [fetchAcceptedFriends]);

  if (isFriendsLoading) return <UsersLoadingSkeleton />;
  if (friends.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/30 p-6 text-center"
        data-testid="empty-friends-state"
      >
        <h4 className="text-slate-200 font-medium">No friends yet</h4>
        <p className="mt-2 text-sm text-slate-400">
          Use the add-friend button in the header to search by Friend ID.
        </p>
      </div>
    );
  }

  return (
    <>
      {friends.map((contact) => (
        <div
          key={contact._id}
          className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
          onClick={() => setSelectedUser(contact)}
          onKeyDown={(e) => e.key === "Enter" && setSelectedUser(contact)}
          role="button"
          tabIndex={0}
          data-testid={getFriendTestId(contact._id)}
        >
          <div className="flex items-center gap-3">
            <div
              className={`avatar ${onlineUsers.includes(contact._id) ? "online" : "offline"}`}
            >
              <div className="size-12 rounded-full">
                <img
                  src={contact.profilePicture || "/avatar.png"}
                  alt={`${contact.fullName}'s avatar`}
                />
              </div>
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-slate-200 font-medium">
                {contact.fullName}
              </h4>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
                {contact.friendId}
              </p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
export default ContactList;

import FriendRequest, { FRIEND_REQUEST_STATUS } from "../models/FriendRequest.js";

const FRIEND_USER_SELECT = "fullName profilePicture friendId";

export const serializeFriendUser = (user) =>
  user
    ? {
        _id: user._id,
        fullName: user.fullName,
        profilePicture: user.profilePicture || "",
        friendId: user.friendId,
      }
    : null;

export const serializeFriendRequest = (friendRequest, counterpartField) => ({
  _id: friendRequest._id,
  status: friendRequest.status,
  createdAt: friendRequest.createdAt,
  updatedAt: friendRequest.updatedAt,
  user: serializeFriendUser(friendRequest[counterpartField]),
});

export const listAcceptedFriendsForUser = async (userId) => {
  const acceptedRequests = await FriendRequest.find({
    status: FRIEND_REQUEST_STATUS.ACCEPTED,
    $or: [{ senderId: userId }, { receiverId: userId }],
  })
    .sort({ updatedAt: -1, _id: -1 })
    .populate("senderId", FRIEND_USER_SELECT)
    .populate("receiverId", FRIEND_USER_SELECT);

  const friendsById = new Map();

  acceptedRequests.forEach((friendRequest) => {
    const isCurrentUserSender =
      friendRequest.senderId?._id?.toString() === userId.toString();
    const counterpart = isCurrentUserSender
      ? friendRequest.receiverId
      : friendRequest.senderId;

    if (counterpart?._id && !friendsById.has(counterpart._id.toString())) {
      friendsById.set(counterpart._id.toString(), serializeFriendUser(counterpart));
    }
  });

  return Array.from(friendsById.values());
};

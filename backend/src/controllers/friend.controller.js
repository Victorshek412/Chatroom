import { parseFriendId } from "../lib/friendIds.js";
import {
  listAcceptedFriendsForUser,
  serializeFriendRequest,
  serializeFriendUser,
} from "../lib/friendships.js";
import FriendRequest, { FRIEND_REQUEST_STATUS } from "../models/FriendRequest.js";
import User from "../models/User.js";

const FRIEND_USER_SELECT = "fullName profilePicture friendId";

const getFormattedFriendId = (value) => parseFriendId(value);

const findRelevantRelationship = (currentUserId, otherUserId) =>
  FriendRequest.findOne({
    status: {
      $in: [FRIEND_REQUEST_STATUS.PENDING, FRIEND_REQUEST_STATUS.ACCEPTED],
    },
    $or: [
      { senderId: currentUserId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: currentUserId },
    ],
  }).sort({ createdAt: -1, _id: -1 });

const populateFriendRequest = (query) =>
  query
    .populate("senderId", FRIEND_USER_SELECT)
    .populate("receiverId", FRIEND_USER_SELECT);

const resolveFriendRequestTransitionError = async ({
  requestId,
  actorId,
  actorField,
  forbiddenMessage,
}) => {
  const friendRequest = await FriendRequest.findById(requestId);

  if (!friendRequest) {
    return { error: { status: 404, message: "Friend request not found." } };
  }

  if (friendRequest[actorField]?.toString() !== actorId.toString()) {
    return {
      error: { status: 403, message: forbiddenMessage },
    };
  }

  return {
    error: { status: 409, message: "This friend request is no longer pending." },
  };
};

const updatePendingFriendRequestStatus = async ({
  requestId,
  actorId,
  actorField,
  nextStatus,
  forbiddenMessage,
}) => {
  const friendRequest = await populateFriendRequest(
    FriendRequest.findOneAndUpdate(
      {
        _id: requestId,
        [actorField]: actorId,
        status: FRIEND_REQUEST_STATUS.PENDING,
      },
      {
        $set: { status: nextStatus },
      },
      { new: true },
    ),
  );

  if (friendRequest) {
    return { friendRequest };
  }

  return resolveFriendRequestTransitionError({
    requestId,
    actorId,
    actorField,
    forbiddenMessage,
  });
};

export const getMyFriendProfile = async (req, res) => {
  try {
    res.status(200).json(serializeFriendUser(req.user));
  } catch (error) {
    console.log("Error in getMyFriendProfile", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const findUserByFriendId = async (req, res) => {
  try {
    const formattedFriendId = getFormattedFriendId(req.query.friendId);

    if (!formattedFriendId) {
      return res.status(400).json({ message: "Enter a valid Friend ID." });
    }

    if (formattedFriendId === req.user.friendId) {
      return res
        .status(400)
        .json({ message: "You cannot send a friend request to yourself." });
    }

    const foundUser = await User.findOne({
      friendId: formattedFriendId,
      _id: { $ne: req.user._id },
    }).select(FRIEND_USER_SELECT);

    if (!foundUser) {
      return res.status(404).json({ message: "No user found for that Friend ID." });
    }

    res.status(200).json({ user: serializeFriendUser(foundUser) });
  } catch (error) {
    console.log("Error in findUserByFriendId", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendFriendRequest = async (req, res) => {
  try {
    const formattedFriendId = getFormattedFriendId(req.body?.friendId);

    if (!formattedFriendId) {
      return res.status(400).json({ message: "Enter a valid Friend ID." });
    }

    const receiver = await User.findOne({ friendId: formattedFriendId }).select(
      FRIEND_USER_SELECT,
    );

    if (!receiver) {
      return res.status(404).json({ message: "No user found for that Friend ID." });
    }

    if (receiver._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot send a friend request to yourself." });
    }

    const existingRelationship = await findRelevantRelationship(
      req.user._id,
      receiver._id,
    );

    if (existingRelationship?.status === FRIEND_REQUEST_STATUS.ACCEPTED) {
      return res.status(400).json({ message: "You are already friends." });
    }

    if (existingRelationship?.status === FRIEND_REQUEST_STATUS.PENDING) {
      const isOutgoingDuplicate =
        existingRelationship.senderId.toString() === req.user._id.toString();

      return res.status(409).json({
        message: isOutgoingDuplicate
          ? "You already sent a friend request to this user."
          : "This user has already sent you a friend request.",
      });
    }

    let populatedRequest;
    try {
      const friendRequest = await FriendRequest.create({
        senderId: req.user._id,
        receiverId: receiver._id,
      });

      populatedRequest = await FriendRequest.findById(friendRequest._id).populate(
        "receiverId",
        FRIEND_USER_SELECT,
      );
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      const latestRelationship = await findRelevantRelationship(
        req.user._id,
        receiver._id,
      );

      if (latestRelationship?.status === FRIEND_REQUEST_STATUS.ACCEPTED) {
        return res.status(400).json({ message: "You are already friends." });
      }

      if (latestRelationship?.status === FRIEND_REQUEST_STATUS.PENDING) {
        const isOutgoingDuplicate =
          latestRelationship.senderId.toString() === req.user._id.toString();

        return res.status(409).json({
          message: isOutgoingDuplicate
            ? "You already sent a friend request to this user."
            : "This user has already sent you a friend request.",
        });
      }

      throw error;
    }

    res.status(201).json({
      request: serializeFriendRequest(populatedRequest, "receiverId"),
    });
  } catch (error) {
    console.log("Error in sendFriendRequest", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const listIncomingFriendRequests = async (req, res) => {
  try {
    const incomingRequests = await FriendRequest.find({
      receiverId: req.user._id,
      status: FRIEND_REQUEST_STATUS.PENDING,
    })
      .sort({ createdAt: -1, _id: -1 })
      .populate("senderId", FRIEND_USER_SELECT);

    res.status(200).json({
      requests: incomingRequests.map((request) =>
        serializeFriendRequest(request, "senderId"),
      ),
    });
  } catch (error) {
    console.log("Error in listIncomingFriendRequests", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const listOutgoingFriendRequests = async (req, res) => {
  try {
    const outgoingRequests = await FriendRequest.find({
      senderId: req.user._id,
      status: FRIEND_REQUEST_STATUS.PENDING,
    })
      .sort({ createdAt: -1, _id: -1 })
      .populate("receiverId", FRIEND_USER_SELECT);

    res.status(200).json({
      requests: outgoingRequests.map((request) =>
        serializeFriendRequest(request, "receiverId"),
      ),
    });
  } catch (error) {
    console.log("Error in listOutgoingFriendRequests", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { friendRequest, error } = await updatePendingFriendRequestStatus({
      requestId: req.params.requestId,
      actorId: req.user._id,
      actorField: "receiverId",
      nextStatus: FRIEND_REQUEST_STATUS.ACCEPTED,
      forbiddenMessage: "You can only respond to incoming requests.",
    });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    res.status(200).json({
      request: serializeFriendRequest(friendRequest, "senderId"),
      friend: serializeFriendUser(friendRequest.senderId),
    });
  } catch (error) {
    console.log("Error in acceptFriendRequest", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { friendRequest, error } = await updatePendingFriendRequestStatus({
      requestId: req.params.requestId,
      actorId: req.user._id,
      actorField: "receiverId",
      nextStatus: FRIEND_REQUEST_STATUS.REJECTED,
      forbiddenMessage: "You can only respond to incoming requests.",
    });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    res.status(200).json({
      request: serializeFriendRequest(friendRequest, "senderId"),
    });
  } catch (error) {
    console.log("Error in rejectFriendRequest", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const cancelFriendRequest = async (req, res) => {
  try {
    const { friendRequest, error } = await updatePendingFriendRequestStatus({
      requestId: req.params.requestId,
      actorId: req.user._id,
      actorField: "senderId",
      nextStatus: FRIEND_REQUEST_STATUS.REJECTED,
      forbiddenMessage: "You can only cancel outgoing requests.",
    });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    res.status(200).json({
      request: serializeFriendRequest(friendRequest, "receiverId"),
    });
  } catch (error) {
    console.log("Error in cancelFriendRequest", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const listAcceptedFriends = async (req, res) => {
  try {
    const friends = await listAcceptedFriendsForUser(req.user._id);
    res.status(200).json({ friends });
  } catch (error) {
    console.log("Error in listAcceptedFriends", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

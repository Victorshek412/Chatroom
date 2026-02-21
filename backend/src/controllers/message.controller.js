import cloudinary from "../lib/cloudinary.js";
import Message from "../models/message.js";
import User from "../models/User.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const getMessageByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatID } = req.params; // get the user id of the person I want to chat with
    //{id:userToChatID} is destructuring the id parameter from the request parameters and renaming it to userToChatID for clarity in the code.
    //req.params is an object containing properties mapped to the named route parameters. In this case, it extracts the id parameter from the URL and assigns it to userToChatID.

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatID },
        { senderId: userToChatID, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessageByUserId", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const sendMessage = async (req, res) => {
  try {
    //1. get the message text and image from the request body
    //2. get the receiver id from the request parameters
    //3. get the sender id from the logged in user (req.user)
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required." });
    }
    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    //4. if there is an image, upload it to cloudinary and get the secure URL
    if (image) {
      //upload base64 image to cloudinary and get the URL
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    //5. create a new message document in the database with the sender id, receiver id, text, and image URL (if any)
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });
    await newMessage.save(); // Save the new message document to the database
    // what is await ? The await keyword is used to wait for a Promise to resolve. In this case, it waits for the save() method to complete before proceeding to the next line of code. This ensures that the message is saved to the database before sending the response back to the client.
    // what if we don't use await ? If we don't use await, the code will continue executing without waiting for the save() method to complete. This means that the response could be sent back to the client before the message is actually saved in the database, which could lead to inconsistencies and errors in the application.
    //todo send messafe in real-time if user is online using - socket.io
    //6. return the created message in the response with a 201 status code
    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });
    const partnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString(),
        ),
      ),
    ];
    const partners = await User.find({ _id: { $in: partnerIds } }).select(
      "-password",
    );
    res.status(200).json(partners);
  } catch (error) {
    console.log("Error in getChatPartners", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

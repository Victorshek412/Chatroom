import mongoose from "mongoose"; // Import Mongoose for MongoDB interaction

const messageSchema = new mongoose.Schema( //what is a schema? A schema in Mongoose defines the structure of the documents within a collection. It specifies the fields, their data types, and any validation rules or constraints that should be applied to the data. In this case, the messageSchema defines the structure for messages in a messaging application.
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId, //type: mongoose.Schema.Types.ObjectId indicates that the sender field will store an ObjectId, which is a unique identifier for a document in MongoDB.
      ref: "User", //ref: "User" indicates that this field references the User model, establishing a relationship between messages and users.
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000, // Optional text content of the message with a maximum length of 2000 characters
    },
    image: {
      type: String, // Optional image URL associated with the message
    },
  },
  { timestamps: true },
); // Automatically manage createdAt & updatedAt fields

const Message = mongoose.model("Message", messageSchema); // Create the Message model based on the defined schema, allowing us to interact with the messages collection in MongoDB
export default Message; // Export the Message model for use in other parts of the application

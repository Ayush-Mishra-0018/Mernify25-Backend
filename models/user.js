const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ["citizen", "ngo", "admin"],
    required: true
  },

  // Common relationships
  communityDrivesCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommunityDrive" }],
  communityDrivesJoined: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommunityDrive" }],

  // NGO specific
  collectionInitiativesCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: "CollectionInitiative" }],
  collectionLocation: { type: String },

  // Citizen-specific
  aiChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "AIChat" }],

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

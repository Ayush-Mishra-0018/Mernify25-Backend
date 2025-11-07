const mongoose = require("mongoose");

const communityChatSchema = new mongoose.Schema({
  communityDrive: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityDrive", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Index for faster queries
communityChatSchema.index({ communityDrive: 1, timestamp: 1 });

module.exports = mongoose.model("CommunityChat", communityChatSchema);

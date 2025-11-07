const communityChatSchema = new mongoose.Schema({
  communityDrive: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityDrive", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("CommunityChat", communityChatSchema);

const aiChatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  inputText: { type: String },
  inputImage: { type: String }, // URL from Cloudinary or local uploads
  output: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("AIChat", aiChatSchema);

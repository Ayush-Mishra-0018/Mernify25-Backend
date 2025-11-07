const mongoose = require("mongoose");

const communityDriveSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  heading: { type: String, required: true },
  description: { type: String, required: true },

  creationDate: { type: Date, default: Date.now },
  eventDate: { type: Date, required: true },
  timeFrom: { type: Date, required: true },
  timeTo: { type: Date, required: true },

  upperLimit: { type: Number, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  result: { type: String }, // summary after completion

  // Collaborative Impact Board data
  impactData: {
    summary: { type: String, default: "" }, // Collaborative impact summary
  },

  status: {
    type: String,
    enum: ["active", "cancelled", "completed"],
    default: "active"
  },

  cancellationReason: { type: String },
}, { timestamps: true });

// Auto mark as completed when current time > event time
communityDriveSchema.pre("save", function(next) {
  const now = new Date();
  if (this.status === "active" && this.timeTo < now) {
    this.status = "completed";
  }
  next();
});

module.exports = mongoose.model("CommunityDrive", communityDriveSchema);

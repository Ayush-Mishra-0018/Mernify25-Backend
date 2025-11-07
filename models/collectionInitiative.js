const collectionInitiativeSchema = new mongoose.Schema({
  ngo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  creationDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },

  status: {
    type: String,
    enum: ["ongoing", "completed"],
    default: "ongoing"
  },

  // Automatically mark completed after end date
  items: [
    {
      name: { type: String, required: true },
      description: { type: String }
    }
  ],

  donors: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      givenStatus: { type: String, enum: ["pending", "given"], default: "pending" }
    }
  ]
}, { timestamps: true });

collectionInitiativeSchema.pre("save", function(next) {
  const now = new Date();
  if (this.status === "ongoing" && this.endDate < now) {
    this.status = "completed";
  }
  next();
});

module.exports = mongoose.model("CollectionInitiative", collectionInitiativeSchema);

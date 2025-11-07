const CommunityDrive = require("../models/CommunityDrive");
const User = require("../models/User");
const ExpressError = require("../utils/ExpressError");


module.exports.getAllCommunityDrives = async (req, res, next) => {
  try {
    const { status } = req.query; // e.g., ?status=active
    const validStatuses = ["active", "completed", "cancelled"];

    let query = {};

    // ✅ Validate and apply status filter (optional)
    if (status) {
      if (!validStatuses.includes(status)) {
        throw new ExpressError("Invalid status filter. Use active, completed, or cancelled.", 400);
      }
      query.status = status;
    }

    // ✅ Fetch all drives
    const drives = await CommunityDrive.find(query)
      .populate("createdBy", "name email")
      .sort({ eventDate: -1 });

    res.status(200).json({
      success: true,
      count: drives.length,
      drives,
    });
  } catch (err) {
    console.error("❌ Error fetching all community drives:", err);
    next(err);
  }
};

module.exports.getCommunityDriveDetails = async (req, res, next) => {
  try {
    const { driveId } = req.params;

    // 🔍 Fetch the drive with participant + creator details
    const drive = await CommunityDrive.findById(driveId)
      .populate("createdBy", "name email")
      .populate("participants", "name email");

    if (!drive) throw new ExpressError("Community Drive not found", 404);

    res.status(200).json({
      success: true,
      drive,
      participantsCount: drive.participants.length,
      participants: drive.participants, // optional explicit field
    });
  } catch (err) {
    console.error("❌ Error fetching community drive details:", err);
    next(err);
  }
};
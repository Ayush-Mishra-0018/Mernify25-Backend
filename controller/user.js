const CommunityDrive = require("../models/CommunityDrive");
const User = require("../models/User");
const ExpressError = require("../utils/ExpressError");



const { communityDriveSchemaJoi } = require("../joiSchema");

module.exports.createCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.mongoId; // from JWT middleware

    // ✅ Validate request body with Joi
    const { error, value } = communityDriveSchemaJoi.validate(req.body);
    if (error) {
      throw new ExpressError(error.details[0].message, 400);
    }

    // ✅ Ensure user exists (optional safety check)
    const user = await User.findById(userId);
    if (!user) {
      throw new ExpressError("User not found.", 404);
    }

    // ✅ Create new drive
    const drive = new CommunityDrive({
      createdBy: user._id,
      heading: value.heading,
      description: value.description,
      eventDate: value.eventDate,
      timeFrom: value.timeFrom,
      timeTo: value.timeTo,
      upperLimit: value.upperLimit,
    });

    await drive.save();

    return res.status(201).json({
      success: true,
      message: "Community drive created successfully.",
      drive,
    });
  } catch (err) {
    console.error("❌ Error creating community drive:", err);
    next(err);
  }
};

module.exports.getUserCommunityDrives = async (req, res, next) => {
  try {
    const userId = req.user.mongoId; // from JWT middleware
    const filter = req.query.filter; 
    const now = new Date();

    let query = { createdBy: userId };

    if (filter === "completed") {
      query.timeTo = { $lt: now };
    } else if (filter === "active") {
      query.timeTo = { $gte: now };
    }

    const drives = await CommunityDrive.find(query)
      .sort({ eventDate: -1 });

    res.status(200).json({
      success: true,
      count: drives.length,
      drives,
    });
  } catch (err) {
    console.error("❌ Error fetching user community drives:", err);
    next(err);
  }
};



module.exports.joinCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.mongoId;
    const { driveId } = req.params; // from URL param
    const now = new Date();

    // ✅ Find the drive
    const drive = await CommunityDrive.findById(driveId);
    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // ✅ Check drive status
    if (drive.status !== "active") {
      throw new ExpressError("You can only join active drives.", 400);
    }

    // ✅ Check event timing
    if (now >= drive.timeFrom) {
      throw new ExpressError("You cannot join after the event has started.", 400);
    }

    // ✅ Check if user already joined
    if (drive.participants.includes(userId)) {
      throw new ExpressError("You have already joined this drive.", 400);
    }

    // ✅ Check upper limit
    if (drive.participants.length >= drive.upperLimit) {
      throw new ExpressError("This drive has reached its participant limit.", 400);
    }

    // ✅ Add participant
    drive.participants.push(userId);
    await drive.save();

    res.status(200).json({
      success: true,
      message: "Successfully joined the drive.",
      participantsCount: drive.participants.length,
    });
  } catch (err) {
    console.error("❌ Error joining community drive:", err);
    next(err);
  }
};


module.exports.cancelCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.mongoId;
    const { driveId } = req.params;
    const { cancellationReason } = req.body;
    const now = new Date();

    // ✅ Find the drive
    const drive = await CommunityDrive.findById(driveId);
    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // ✅ Check if the logged-in user is the creator
    if (drive.createdBy.toString() !== userId) {
      throw new ExpressError("You are not authorized to cancel this drive.", 403);
    }

    // ✅ Check if the event has already started
    if (now >= drive.timeFrom) {
      throw new ExpressError("You cannot cancel a drive that has already started.", 400);
    }

    // ✅ Check if it's already cancelled or completed
    if (drive.status !== "active") {
      throw new ExpressError(`Drive is already ${drive.status}.`, 400);
    }

    // ✅ Update drive status and reason
    drive.status = "cancelled";
    if (cancellationReason) {
      drive.cancellationReason = cancellationReason;
    }

    await drive.save();

    res.status(200).json({
      success: true,
      message: "Drive cancelled successfully.",
      drive,
    });
  } catch (err) {
    console.error("❌ Error cancelling community drive:", err);
    next(err);
  }
};


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


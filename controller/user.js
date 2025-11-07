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
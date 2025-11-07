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

    // 🕒 Apply filters based on query param
    if (filter === "completed") {
      // Drives whose timeTo is in the past
      query.timeTo = { $lt: now };
    } else if (filter === "ongoing") {
      // Drives whose timeFrom <= now <= timeTo
      query.timeTo = { $gte: now };
    }
    // else → no filter (get all drives created by this user)

    // 🧩 Fetch drives and populate createdBy (basic info)
    const drives = await CommunityDrive.find(query)
      .populate("createdBy", "name email role")
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
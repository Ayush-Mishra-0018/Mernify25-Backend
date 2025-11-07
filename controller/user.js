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
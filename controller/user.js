const ExpressError = require("../utils/ExpressError");
const CommunityDrive = require("../models/CommunityDrive");
const User = require("../models/User");

module.exports.createCommunityDrive = async (req, res, next) => {
  const {
    heading,
    description,
    eventDate,
    timeFrom,
    timeTo,
    upperLimit,
  } = req.body;

  const userId = req.user?._id || "6748f00c8a7c222fa6a8f91b"; // temp fallback for testing

  // 1️⃣ Validate required fields
  if (!heading || !description || !eventDate || !timeFrom || !timeTo || !upperLimit) {
    throw new ExpressError("All fields are required to create a community drive.", 400);
  }

  // 2️⃣ Create new community drive
  const newDrive = new CommunityDrive({
    createdBy: userId,
    heading,
    description,
    eventDate,
    timeFrom,
    timeTo,
    upperLimit,
  });

  await newDrive.save();

  // 3️⃣ Add to user's created drives array
  await User.findByIdAndUpdate(userId, {
    $push: { communityDrivesCreated: newDrive._id },
  });

  // 4️⃣ Send response
  res.status(201).json({
    success: true,
    message: "Community drive created successfully.",
    drive: newDrive,
  });
};


module.exports.getOngoingCommunityDrives = async (req, res, next) => {
  const now = new Date();

  // Find all drives that are active and not yet finished
  const ongoingDrives = await CommunityDrive.find({
    status: "active",
    timeTo: { $gte: now },
  })
    .populate("createdBy", "name role") // get creator’s name + role
    .sort({ eventDate: 1 }); // upcoming drives first

  if (!ongoingDrives || ongoingDrives.length === 0) {
    throw new ExpressError("No ongoing community drives found.", 404);
  }

  res.status(200).json({
    success: true,
    total: ongoingDrives.length,
    drives: ongoingDrives.map(drive => ({
      id: drive._id,
      heading: drive.heading,
      description: drive.description,
      createdBy: drive.createdBy.name,
      creatorRole: drive.createdBy.role,
      eventDate: drive.eventDate,
      timeFrom: drive.timeFrom,
      timeTo: drive.timeTo,
      upperLimit: drive.upperLimit,
      participantsCount: drive.participants.length,
      status: drive.status
    }))
  });
};
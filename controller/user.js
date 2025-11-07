const ExpressError = require("../utils/ExpressError");
const CommunityDrive = require("../models/CommunityDrive");
const User = require("../models/User");

// -----------------------------------------------------------------------------
// 1️⃣ CREATE COMMUNITY DRIVE
// -----------------------------------------------------------------------------
module.exports.createCommunityDrive = async (req, res, next) => {
  const { heading, description, eventDate, timeFrom, timeTo, upperLimit } = req.body;
  const userId = req.user?._id || "6748f00c8a7c222fa6a8f91b"; // temp fallback for testing

  if (!heading || !description || !eventDate || !timeFrom || !timeTo || !upperLimit) {
    throw new ExpressError("All fields are required to create a community drive.", 400);
  }

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

  await User.findByIdAndUpdate(userId, {
    $push: { communityDrivesCreated: newDrive._id },
  });

  res.status(201).json({
    success: true,
    message: "Community drive created successfully.",
    drive: newDrive,
  });
};

// -----------------------------------------------------------------------------
// 2️⃣ GET ONGOING COMMUNITY DRIVES
// -----------------------------------------------------------------------------
module.exports.getOngoingCommunityDrives = async (req, res, next) => {
  const now = new Date();

  const ongoingDrives = await CommunityDrive.find({
    status: "active",
    timeTo: { $gte: now },
  })
    .populate("createdBy", "name role")
    .sort({ eventDate: 1 });

  if (!ongoingDrives || ongoingDrives.length === 0) {
    throw new ExpressError("No ongoing community drives found.", 404);
  }

  res.status(200).json({
    success: true,
    total: ongoingDrives.length,
    drives: ongoingDrives.map((drive) => ({
      id: drive._id,
      heading: drive.heading,
      description: drive.description,
      createdBy: drive.createdBy?.name || "Unknown",
      creatorRole: drive.createdBy?.role || "unknown",
      eventDate: drive.eventDate,
      timeFrom: drive.timeFrom,
      timeTo: drive.timeTo,
      upperLimit: drive.upperLimit,
      participantsCount: drive.participants.length,
      status: drive.status,
    })),
  });
};

// -----------------------------------------------------------------------------
// 3️⃣ GET ALL COMMUNITY DRIVES (ALL STATUSES)
// -----------------------------------------------------------------------------
module.exports.getAllCommunityDrives = async (req, res, next) => {
  const drives = await CommunityDrive.find({})
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 });

  if (!drives || drives.length === 0) {
    throw new ExpressError("No community drives found.", 404);
  }

  res.status(200).json({
    success: true,
    total: drives.length,
    drives,
  });
};

// -----------------------------------------------------------------------------
// 4️⃣ GET COMPLETED COMMUNITY DRIVES
// -----------------------------------------------------------------------------
module.exports.getCompletedCommunityDrives = async (req, res, next) => {
  const drives = await CommunityDrive.find({ status: "completed" })
    .populate("createdBy", "name role")
    .sort({ eventDate: -1 });

  if (!drives || drives.length === 0) {
    throw new ExpressError("No completed drives found.", 404);
  }

  res.status(200).json({
    success: true,
    total: drives.length,
    drives,
  });
};

// -----------------------------------------------------------------------------
// 5️⃣ GET CANCELLED COMMUNITY DRIVES
// -----------------------------------------------------------------------------
module.exports.getCancelledCommunityDrives = async (req, res, next) => {
  const drives = await CommunityDrive.find({ status: "cancelled" })
    .populate("createdBy", "name role")
    .sort({ eventDate: -1 });

  if (!drives || drives.length === 0) {
    throw new ExpressError("No cancelled drives found.", 404);
  }

  res.status(200).json({
    success: true,
    total: drives.length,
    drives,
  });
};

// -----------------------------------------------------------------------------
// 6️⃣ ADD RESULT AFTER DRIVE COMPLETION (Only Creator)
// -----------------------------------------------------------------------------
module.exports.addResultToCompletedDrive = async (req, res, next) => {
  const { driveId } = req.params;
  const { result } = req.body;
  const userId = req.user?._id || "6748f00c8a7c222fa6a8f91b"; // fallback

  const drive = await CommunityDrive.findById(driveId);
  if (!drive) throw new ExpressError("Community drive not found.", 404);

  if (String(drive.createdBy) !== String(userId)) {
    throw new ExpressError("Only the creator can add a result to this drive.", 403);
  }

  if (drive.status !== "completed") {
    throw new ExpressError("Result can only be added after the drive is completed.", 400);
  }

  drive.result = result;
  await drive.save();

  res.status(200).json({
    success: true,
    message: "Result added successfully.",
    drive,
  });
};

// -----------------------------------------------------------------------------
// 7️⃣ CANCEL A COMMUNITY DRIVE (Only Creator Before Completion)
// -----------------------------------------------------------------------------
module.exports.cancelCommunityDrive = async (req, res, next) => {
  const { driveId } = req.params;
  const { reason } = req.body;
  const userId = req.user?._id || "6748f00c8a7c222fa6a8f91b";

  const drive = await CommunityDrive.findById(driveId);
  if (!drive) throw new ExpressError("Community drive not found.", 404);

  if (String(drive.createdBy) !== String(userId)) {
    throw new ExpressError("Only the creator can cancel this drive.", 403);
  }

  if (drive.status !== "active") {
    throw new ExpressError("Only active drives can be cancelled.", 400);
  }

  const now = new Date();
  if (now > drive.timeTo) {
    throw new ExpressError("Drive has already been completed, cannot cancel.", 400);
  }

  drive.status = "cancelled";
  drive.cancellationReason = reason || "No reason specified.";
  await drive.save();

  res.status(200).json({
    success: true,
    message: "Community drive cancelled successfully.",
    drive,
  });
};

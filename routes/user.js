const express = require("express");
const router = express.Router();
const wrapForError = require("../utils/catchAsync");
const {
  createCommunityDrive,
  getOngoingCommunityDrives,
  getAllCommunityDrives,
  getCompletedCommunityDrives,
  getCancelledCommunityDrives,
  addResultToCompletedDrive,
  cancelCommunityDrive,
} = require("../controller/user");

// 1️⃣ Create new community drive
router.post("/communityDrive", wrapForError(createCommunityDrive));

// 2️⃣ Get all ongoing (active & future)
router.get("/communityDrives/ongoing", wrapForError(getOngoingCommunityDrives));

// 3️⃣ Get all drives (any status)
router.get("/communityDrives/all", wrapForError(getAllCommunityDrives));

// 4️⃣ Get completed drives
router.get("/communityDrives/completed", wrapForError(getCompletedCommunityDrives));

// 5️⃣ Get cancelled drives
router.get("/communityDrives/cancelled", wrapForError(getCancelledCommunityDrives));

// 6️⃣ Add result (only creator)
router.put("/communityDrive/:driveId/result", wrapForError(addResultToCompletedDrive));

// 7️⃣ Cancel drive (only creator)
router.put("/communityDrive/:driveId/cancel", wrapForError(cancelCommunityDrive));

module.exports = router;

const express = require("express");
const router = express.Router();
const wrapForError = require("../utils/catchAsync");
const { createCommunityDrive } = require("../controller/user");
const { getOngoingCommunityDrives } = require("../controller/user");

// POST: /user/community-drive
router.post("/community-drive", wrapForError(createCommunityDrive));



// GET: /user/community-drives/ongoing
router.get("/community-drives/ongoing", wrapForError(getOngoingCommunityDrives));


module.exports = router;

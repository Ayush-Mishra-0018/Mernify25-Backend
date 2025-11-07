const express = require("express");
const router = express.Router();
const wrapForError = require("../utils/catchAsync");

let nonLoggedController = require("../controller/nonLogged");

router.get(
  "/allCommunityDrives",
  wrapForError(nonLoggedController.getAllCommunityDrives)
);

router.get("/driveDetails/:driveId", wrapForError(nonLoggedController.getCommunityDriveDetails));

module.exports = router;
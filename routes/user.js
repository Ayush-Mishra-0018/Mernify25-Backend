const express = require("express");
const router = express.Router();
const wrapForError = require("../utils/catchAsync");

let UserController = require("../controller/user");
let { authenticateJWT } = require("../middleware");

router.use(authenticateJWT)

router.post(
  "/communityDrive",
  wrapForError(UserController.createCommunityDrive)
);

router.get("/myDrive", wrapForError(UserController.getUserCommunityDrives));

router.put("/joinDrive/:driveId", wrapForError(UserController.joinCommunityDrive));

router.put("/cancelDrive/:driveId", wrapForError(UserController.cancelCommunityDrive));

router.get("/allDrives", wrapForError(UserController.getAllCommunityDrives));

router.post("/leaveDrive/:driveId", wrapForError(UserController.leaveCommunityDrive));

router.get("/driveDetails/:driveId", wrapForError(UserController.getCommunityDriveDetails));
module.exports = router;

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

module.exports = router;

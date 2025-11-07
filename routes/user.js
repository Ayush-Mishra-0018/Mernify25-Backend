const express = require("express");
const router = express.Router();
const wrapForError = require("../utils/catchAsync");

let UserController = require("../controller/user");

module.exports = router;

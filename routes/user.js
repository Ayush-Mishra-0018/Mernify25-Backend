let express = require("express");
let router = express.Router();

let wrapForError = require("../utils/catchAsync");
let UserMethods = require("../controller/user");
let middleware = require("../middleware");

router.get("/hello",wrapForError(UserMethods.helloUser));


module.exports = router;
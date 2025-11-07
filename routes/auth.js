const express = require("express");
const passport = require("passport");
const AuthController = require("../controller/auth");
const wrapForError = require("../utils/catchAsync");

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  wrapForError(AuthController.getGoogleAuth)
);

router.post("/exchange-token", wrapForError(AuthController.exchangeToken));
router.post("/refresh-token", wrapForError(AuthController.refreshToken));
router.post("/logout", wrapForError(AuthController.logout));

module.exports = router;
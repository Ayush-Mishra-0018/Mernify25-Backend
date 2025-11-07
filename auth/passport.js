const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("🔍 Google Profile Data:\n", JSON.stringify(profile, null, 2));

        const email = profile?.emails?.[0]?.value?.toLowerCase();
        const name =
          profile?.displayName ||
          `${profile?.name?.givenName || ""} ${profile?.name?.familyName || ""}`.trim();
        const photo = profile?.photos?.[0]?.value || null;

        if (!email) return done(null, false, { message: "No email returned by Google" });

        // Role logic
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
        const ngoEmail = process.env.NGO_EMAIL?.toLowerCase();

        let role = "citizen";
        if (email === adminEmail) role = "admin";
        else if (email === ngoEmail) role = "ngo";

        // Find or create user
        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            name,
            email,
            profilePictureURL: photo,
            role,
          });
          console.log(`✅ New user created: ${email} (${role})`);
        } else {
          // Optional: update name/photo if they changed in Google profile
          let updated = false;
          if (user.profilePictureURL !== photo) {
            user.profilePictureURL = photo;
            updated = true;
          }
          if (user.name !== name) {
            user.name = name;
            updated = true;
          }
          if (updated) await user.save();
          console.log(`✅ Existing user found: ${email}`);
        }

        return done(null, {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePictureURL: user.profilePictureURL,
        });
      } catch (err) {
        console.error("❌ Google OAuth error:", err);
        done(err, null);
      }
    }
  )
);

module.exports = passport;
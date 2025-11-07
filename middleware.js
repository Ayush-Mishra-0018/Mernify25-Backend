const ExpressError = require("./utils/ExpressError");
const jwt = require("jsonwebtoken");
let redis=require("./utils/redis");

module.exports.authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ Invalid JWT:", err.message);
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = decoded; // user info like { mongoId, rollNumber, email }
    console.log("✅ JWT verified:", req.user);
    next();
  });
};
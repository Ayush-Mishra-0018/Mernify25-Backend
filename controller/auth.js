const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const redis = require("../utils/redis");

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY_SEC = parseInt(process.env.REFRESH_TOKEN_EXPIRY_SEC || 604800); // 7 days

// 🔹 Step 1: Called after successful Google OAuth login
module.exports.getGoogleAuth = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "No authenticated user found" });
        }

        const tokenPayload = {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            profilePictureURL: req.user.profilePictureURL,
        };

        // 🔐 Step 2: Generate access token (short-lived)
        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_EXPIRY,
        });

        // 🔑 Step 3: Generate refresh token (secure random string)
        const refreshToken = crypto.randomBytes(64).toString("hex");

        // 💾 Step 4: Store refresh token in Redis with user info
        await redis.setex(`refresh:${refreshToken}`, REFRESH_TOKEN_EXPIRY_SEC, JSON.stringify(tokenPayload));

        // 🍪 Step 5: Set refresh token as HTTP-only cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
            maxAge: REFRESH_TOKEN_EXPIRY_SEC * 1000,
        });

        // 🔄 Step 6: Create short-lived auth code for frontend
        const authCode = crypto.randomBytes(32).toString("hex");
        await redis.setex(authCode, 300, accessToken); // 5 min expiry

        // ↩️ Step 7: Redirect to frontend with code
        const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?code=${authCode}`;
        res.redirect(redirectUrl);
    } catch (err) {
        console.error("❌ Google Auth Error:", err);
        res.status(500).json({ error: "Authentication failed" });
    }
};

// 🔹 Step 2: Frontend exchanges short-lived code for access token
module.exports.exchangeToken = async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Authorization code is required" });
    }

    const token = await redis.get(code);

    if (!token) {
        return res.status(400).json({ error: "Invalid or expired authorization code" });
    }

    // ✅ Remove code after use (one-time use)
    await redis.del(code);

    res.json({ token });
};

// 🔹 Step 3: Refresh access token using refresh token
module.exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token missing" });
    }

    const storedPayload = await redis.get(`refresh:${refreshToken}`);

    if (!storedPayload) {
        return res.status(403).json({ error: "Invalid or expired refresh token" });
    }

    const userData = JSON.parse(storedPayload);

    const newAccessToken = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    res.json({ token: newAccessToken });
};

// 🔹 Step 4: Logout and revoke refresh token
module.exports.logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).json({ error: "No refresh token cookie found" });
    }

    const deleted = await redis.del(`refresh:${refreshToken}`);

    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        path: "/",
    });

    if (deleted === 0) {
        return res.status(400).json({ error: "Refresh token not found or already expired" });
    }

    res.json({ message: "Logged out successfully" });
};
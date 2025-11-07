const CommunityDrive = require("../models/CommunityDrive");
const CommunityChat = require("../models/communityDriveChat");
const User = require("../models/User");
const ExpressError = require("../utils/ExpressError");
let redis = require("../utils/redis");



const { communityDriveSchemaJoi } = require("../joiSchema");
const { use } = require("passport");

module.exports.createCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log(userId) // from JWT middleware

    // ✅ Validate request body with Joi
    const { error, value } = communityDriveSchemaJoi.validate(req.body);
    if (error) {
      throw new ExpressError(error.details[0].message, 400);
    }

    // ✅ Ensure user exists (optional safety check)
    const user = await User.findById(userId);
    if (!user) {
      throw new ExpressError("User not found.", 404);
    }

    // ✅ Create new drive
    const drive = new CommunityDrive({
      createdBy: user._id,
      heading: value.heading,
      description: value.description,
      eventDate: value.eventDate,
      timeFrom: value.timeFrom,
      timeTo: value.timeTo,
      upperLimit: value.upperLimit,
    });
    drive.participants.push(user._id); // Creator joins by default

    await drive.save();

    // Populate creator info before emitting
    await drive.populate("createdBy", "name email");

    // Emit socket event for new drive created
    const io = req.app.get('io');
    if (io) {
      io.emit("driveCreated", drive);
    }

    return res.status(201).json({
      success: true,
      message: "Community drive created successfully.",
      drive,
    });
  } catch (err) {
    console.error("❌ Error creating community drive:", err);
    next(err);
  }
};

module.exports.getUserCommunityDrives = async (req, res, next) => {
  try {
    const userId = req.user.id; // from JWT middleware
    const filter = req.query.filter; // can be "active", "completed", "cancelled"

    // 🎯 Base query — all drives created by this user
    let query = { createdBy: userId };

    // 🧩 Apply filter only if provided
    if (filter && ["active", "completed", "cancelled"].includes(filter)) {
      query.status = filter;
    }

    // 📦 Fetch drives
    let drives = await CommunityDrive.find(query).sort({ eventDate: -1 });

    // 🕒 Current time
    const now = new Date();

    // ⚙️ Update drives whose time has passed
    const updatePromises = drives.map(async (drive) => {
      if (drive.status === "active" && drive.timeTo < now) {
        drive.status = "completed";
        await drive.save(); // persist the change
      }
      return drive;
    });

    // Wait for all updates
    drives = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      count: drives.length,
      drives,
    });

  } catch (err) {
    console.error("❌ Error fetching user community drives:", err);
    next(err);
  }
};



module.exports.joinCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { driveId } = req.params; // from URL param
    const now = new Date();

    // ✅ Find the drive
    const drive = await CommunityDrive.findById(driveId);
    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // ✅ Check drive status
    if (drive.status !== "active") {
      throw new ExpressError("You can only join active drives.", 400);
    }

    // ✅ Check event timing
    if (now >= drive.timeFrom) {
      throw new ExpressError("You cannot join after the event has started.", 400);
    }

    // ✅ Check if user already joined
    if (drive.participants.includes(userId)) {
      throw new ExpressError("You have already joined this drive.", 400);
    }

    // ✅ Check upper limit
    if (drive.participants.length >= drive.upperLimit) {
      throw new ExpressError("This drive has reached its participant limit.", 400);
    }

    // ✅ Add participant
    drive.participants.push(userId);
    await drive.save();

    // Emit socket event for drive update
    const io = req.app.get('io');
    if (io) {
      io.emit("driveUpdated", {
        driveId: drive._id,
        participantsCount: drive.participants.length,
        action: "joined"
      });
    }

    res.status(200).json({
      success: true,
      message: "Successfully joined the drive.",
      participantsCount: drive.participants.length,
    });
  } catch (err) {
    console.error("❌ Error joining community drive:", err);
    next(err);
  }
};


module.exports.cancelCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { driveId } = req.params;
    const { cancellationReason } = req.body;
    const now = new Date();

    // ✅ Find the drive
    const drive = await CommunityDrive.findById(driveId);
    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // ✅ Check if the logged-in user is the creator
    if (drive.createdBy.toString() !== userId) {
      throw new ExpressError("You are not authorized to cancel this drive.", 403);
    }

    // ✅ Check if the event has already started
    if (now >= drive.timeFrom) {
      throw new ExpressError("You cannot cancel a drive that has already started.", 400);
    }

    // ✅ Check if it's already cancelled or completed
    if (drive.status !== "active") {
      throw new ExpressError(`Drive is already ${drive.status}.`, 400);
    }

    // ✅ Update drive status and reason
    drive.status = "cancelled";
    if (cancellationReason) {
      drive.cancellationReason = cancellationReason;
    }

    await drive.save();

    // Populate creator info before emitting
    await drive.populate("createdBy", "name email");

    // Emit socket event for drive cancellation
    const io = req.app.get('io');
    if (io) {
      io.emit("driveCancelled", drive);
    }

    res.status(200).json({
      success: true,
      message: "Drive cancelled successfully.",
      drive,
    });
  } catch (err) {
    console.error("❌ Error cancelling community drive:", err);
    next(err);
  }
};

module.exports.getAllCommunityDrives = async (req, res, next) => {
  try {
    const { status } = req.query; // e.g., ?status=active
    const validStatuses = ["active", "completed", "cancelled"];

    let query = {};

    // ✅ Validate and apply status filter (optional)
    if (status) {
      if (!validStatuses.includes(status)) {
        throw new ExpressError("Invalid status filter. Use active, completed, or cancelled.", 400);
      }
      query.status = status;
    }

    // ✅ Fetch all drives
    let drives = await CommunityDrive.find(query)
      .populate("createdBy", "name email")
      .sort({ eventDate: -1 });

    // 🕒 Current time
    const now = new Date();

    // ⚙️ Update expired active drives
    const updatePromises = drives
      .filter(drive => drive.status === "active" && drive.timeTo < now)
      .map(async (drive) => {
        drive.status = "completed";
        await drive.save();
        return drive;
      });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      count: drives.length,
      drives,
    });
  } catch (err) {
    console.error("❌ Error fetching all community drives:", err);
    next(err);
  }
};
module.exports.leaveCommunityDrive = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { driveId } = req.params;

    const drive = await CommunityDrive.findById(driveId);
    if (!drive) throw new ExpressError("Community Drive not found", 404);

    const now = new Date();

    // ❌ If drive is already completed or cancelled
    if (drive.status === "cancelled" || drive.timeTo < now) {
      throw new ExpressError("Cannot leave a cancelled or completed drive", 400);
    }

    // ❌ If the drive has already started (now >= timeFrom)
    if (now >= drive.timeFrom) {
      throw new ExpressError("You cannot leave a drive that has already started", 400);
    }

    // ❌ If user not in participants list
    const isParticipant = drive.participants.some(
      (id) => id.toString() === userId.toString()
    );
    if (!isParticipant) {
      throw new ExpressError("You are not a participant in this drive", 400);
    }

    // ✅ Remove user from participants
    drive.participants = drive.participants.filter(
      (id) => id.toString() !== userId.toString()
    );

    await drive.save();

    // Emit socket event for drive update
    const io = req.app.get('io');
    if (io) {
      io.emit("driveUpdated", {
        driveId: drive._id,
        participantsCount: drive.participants.length,
        action: "left"
      });
    }

    res.status(200).json({
      success: true,
      message: "You have successfully left the community drive",
      participantsCount: drive.participants.length,
    });
  } catch (err) {
    console.error("❌ Error leaving community drive:", err);
    next(err);
  }
};

module.exports.getCommunityDriveDetails = async (req, res, next) => {
  try {
    const { driveId } = req.params;

    // 🔍 Fetch the drive with participant + creator details
    const drive = await CommunityDrive.findById(driveId)
      .populate("createdBy", "name email")
      .populate("participants", "name email");

    if (!drive) throw new ExpressError("Community Drive not found", 404);

    res.status(200).json({
      success: true,
      drive,
      participantsCount: drive.participants.length,
      participants: drive.participants, // optional explicit field
    });
  } catch (err) {
    console.error("❌ Error fetching community drive details:", err);
    next(err);
  }
};

// ---------------- GET CHAT MESSAGES ----------------
module.exports.getDriveMessages = async (req, res, next) => {
  try {
    const { driveId } = req.params;
    const userId = req.user.id;

    console.log(`📩 Fetching chat messages for drive: ${driveId} by user: ${userId}`);

    // 1️⃣ Check if drive exists
    const drive = await CommunityDrive.findById(driveId);
    if (!drive) throw new ExpressError("Community Drive not found", 404);

    // 2️⃣ Verify membership
    const isOrganizer = drive.createdBy.toString() === userId;
    const isParticipant = drive.participants.includes(userId);
    if (!isOrganizer && !isParticipant)
      throw new ExpressError("You must be part of this drive to access the chat", 403);

    // 3️⃣ Try to get cached messages from Redis
    const cachedMessages = await redis.get(`drive:${driveId}:messages`);
    if (cachedMessages) {
      console.log(`✅ [CACHE HIT] Messages fetched from Redis for drive ${driveId}`);
      const messages = JSON.parse(cachedMessages);

      const allParticipants = await User.find({
        _id: { $in: [drive.createdBy, ...drive.participants] },
      }).select("name email");

      return res.status(200).json({
        success: true,
        messages,
        participants: allParticipants,
        currentUserId: userId,
        cached: true,
      });
    }

    // 4️⃣ Cache miss → fetch from MongoDB
    console.log(`⚠️ [CACHE MISS] Fetching messages from MongoDB for drive ${driveId}`);
    const messages = await CommunityChat.find({ communityDrive: driveId })
      .populate("sender", "name email")
      .sort({ timestamp: 1 });

    // 5️⃣ Cache the messages in Redis
    await redis.set(
      `drive:${driveId}:messages`,
      JSON.stringify(
        messages.map((msg) => ({
          _id: msg._id,
          message: msg.message,
          timestamp: msg.timestamp,
          sender: {
            _id: msg.sender._id,
            name: msg.sender.name,
            email: msg.sender.email,
          },
        }))
      ),
      "EX",
      60 * 5
    );
    console.log(`🧠 [CACHE SET] Stored ${messages.length} messages in Redis for drive ${driveId}`);

    // 6️⃣ Get participants
    const allParticipants = await User.find({
      _id: { $in: [drive.createdBy, ...drive.participants] },
    }).select("name email");

    res.status(200).json({
      success: true,
      messages,
      participants: allParticipants,
      currentUserId: userId,
    });
  } catch (err) {
    console.error("❌ Error fetching drive messages:", err);
    next(err);
  }
};

// ---------------- SEND CHAT MESSAGE ----------------
module.exports.sendDriveMessage = async (req, res, next) => {
  try {
    const { driveId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    console.log(`💬 Sending message in drive ${driveId} by user ${userId}: "${message}"`);

    if (!message?.trim()) throw new ExpressError("Message cannot be empty", 400);

    const drive = await CommunityDrive.findById(driveId);
    if (!drive) throw new ExpressError("Community Drive not found", 404);

    const isOrganizer = drive.createdBy.toString() === userId;
    const isParticipant = drive.participants.includes(userId);
    if (!isOrganizer && !isParticipant)
      throw new ExpressError("You must be part of this drive to send messages", 403);

    // Create and save message
    const chatMessage = new CommunityChat({
      communityDrive: driveId,
      sender: userId,
      message: message.trim(),
      timestamp: new Date(),
    });

    await chatMessage.save();
    await chatMessage.populate("sender", "name email");

    // Emit via socket.io
    const io = req.app.get("io");
    if (io) {
      console.log(`📢 [SOCKET EMIT] Broadcasting new message to room drive-${driveId}`);
      io.to(`drive-${driveId}`).emit("newMessage", {
        _id: chatMessage._id,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
        sender: {
          _id: chatMessage.sender._id,
          name: chatMessage.sender.name,
          email: chatMessage.sender.email,
        },
        driveId,
      });
    }

    // ✅ Update Redis cache instantly
    const cachedMessages = await redis.get(`drive:${driveId}:messages`);
    if (cachedMessages) {
      const updatedMessages = JSON.parse(cachedMessages);
      updatedMessages.push({
        _id: chatMessage._id,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
        sender: {
          _id: chatMessage.sender._id,
          name: chatMessage.sender.name,
          email: chatMessage.sender.email,
        },
      });
      await redis.set(
        `drive:${driveId}:messages`,
        JSON.stringify(updatedMessages),
        "EX",
        60 * 5
      );
      console.log(`🧩 [CACHE UPDATE] Message appended to Redis cache for drive ${driveId}`);
    } else {
      console.log(`⚠️ [CACHE EMPTY] Creating new cache for drive ${driveId}`);
      await redis.set(
        `drive:${driveId}:messages`,
        JSON.stringify([
          {
            _id: chatMessage._id,
            message: chatMessage.message,
            timestamp: chatMessage.timestamp,
            sender: {
              _id: chatMessage.sender._id,
              name: chatMessage.sender.name,
              email: chatMessage.sender.email,
            },
          },
        ]),
        "EX",
        60 * 5
      );
    }

    // ✅ Publish event (for multi-server scaling)
    await redis.publish(
      "chatMessages",
      JSON.stringify({
        driveId,
        message: chatMessage.message,
        sender: chatMessage.sender.name,
      })
    );
    console.log(`📡 [REDIS PUBLISH] Message published on 'chatMessages' channel for drive ${driveId}`);

    res.status(201).json({
      success: true,
      message: {
        _id: chatMessage._id,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
        sender: {
          _id: chatMessage.sender._id,
          name: chatMessage.sender.name,
          email: chatMessage.sender.email,
        },
      },
    });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    next(err);
  }
};

// ============================================
// Impact Board Methods
// ============================================

module.exports.getImpactBoardData = async (req, res, next) => {
  try {
    const { driveId } = req.params;
    const userId = req.user.id;

    // Find the drive
    const drive = await CommunityDrive.findById(driveId)
      .populate("createdBy", "name email")
      .populate("participants", "name email");

    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // Check if user is organizer or participant
    const isOrganizer = drive.createdBy._id.toString() === userId;
    const isParticipant = drive.participants.some(
      (p) => p._id.toString() === userId
    );

    if (!isOrganizer && !isParticipant) {
      throw new ExpressError("You are not authorized to access this impact board.", 403);
    }

    // Return drive data with impact board info
    res.status(200).json({
      success: true,
      drive: {
        _id: drive._id,
        heading: drive.heading,
        description: drive.description,
        eventDate: drive.eventDate,
        status: drive.status,
        createdBy: drive.createdBy,
        participants: drive.participants,
        impactData: drive.impactData || {
          summary: "",
        },
        isFinalized: !!drive.result, // Whether impact board has been finalized
      },
    });
  } catch (err) {
    console.error("❌ Error fetching impact board data:", err);
    next(err);
  }
};

module.exports.updateImpactBoardData = async (req, res, next) => {
  try {
    const { driveId } = req.params;
    const userId = req.user.id;
    const { field, value, cursorPosition } = req.body;

    // Find the drive
    const drive = await CommunityDrive.findById(driveId);

    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // Check if user is organizer or participant
    const isOrganizer = drive.createdBy.toString() === userId;
    const isParticipant = drive.participants.some(
      (p) => p.toString() === userId
    );

    if (!isOrganizer && !isParticipant) {
      throw new ExpressError("You are not authorized to edit this impact board.", 403);
    }

    // Update the specific field
    if (!drive.impactData) {
      drive.impactData = {
        wasteCollected: "",
        carbonOffset: "",
        impactScore: "",
        achievements: "",
        summary: "",
        photos: [],
      };
    }

    if (field === "photos") {
      // Handle photo array
      drive.impactData.photos = value;
    } else {
      // Update text field
      drive.impactData[field] = value;
    }

    await drive.save();

    // Get user info for socket broadcast
    const user = await User.findById(userId);

    // Emit socket event to all users in the impact board room
    const io = req.app.get('io');
    if (io) {
      io.to(`impact-${driveId}`).emit("impactBoardUpdate", {
        driveId,
        field,
        value,
        cursorPosition,
        userId,
        userName: user.name,
      });
    }

    res.status(200).json({
      success: true,
      impactData: drive.impactData,
    });
  } catch (err) {
    console.error("❌ Error updating impact board:", err);
    next(err);
  }
};

module.exports.finishImpactBoard = async (req, res, next) => {
  try {
    const { driveId } = req.params;
    const userId = req.user.id;

    // Find the drive
    const drive = await CommunityDrive.findById(driveId);

    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // Only creator can finish the impact board
    const isOrganizer = drive.createdBy.toString() === userId;
    if (!isOrganizer) {
      throw new ExpressError("Only the organizer can finish the impact board.", 403);
    }

    // Check if already finished
    if (drive.result) {
      throw new ExpressError("Impact board already finalized.", 400);
    }

    // Get the summary from impactData
    const summaryText = drive.impactData?.summary || "";
    
    if (!summaryText.trim()) {
      throw new ExpressError("Cannot finalize an empty impact summary.", 400);
    }

    // Call Gemini API to generate meaningful summary
    const axios = require('axios');
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new ExpressError("Gemini API key not configured.", 500);
    }

    const systemPrompt = `You are an expert summarizer for environmental and community initiatives. 
    
    Below is a collaborative impact summary written by multiple participants of a community initiative titled "${drive.heading}":
    
    "${summaryText}"
    
    Please analyze this summary and create a well-structured, professional final report that includes:
    - Key achievements and impact
    - Challenges faced and how they were overcome
    - Community participation and engagement
    - Environmental benefits
    - Lessons learned
    - Future recommendations
    
    Make it concise, inspiring, and professional. Use clear sections with headers. Keep it under 500 words.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: systemPrompt }],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const geminiResult = response.data.candidates[0].content.parts[0].text.replace(/\*\*/g, "");

    // Store the result in the drive
    drive.result = geminiResult;
    await drive.save();

    // Emit socket event to notify all users in the impact board room
    const io = req.app.get('io');
    if (io) {
      io.to(`impact-${driveId}`).emit("impactBoardFinished", {
        driveId,
        result: geminiResult,
      });
    }

    res.status(200).json({
      success: true,
      message: "Impact board finalized successfully!",
      result: geminiResult,
    });
  } catch (err) {
    console.error("❌ Error finishing impact board:", err);
    next(err);
  }
};

module.exports.getViewSummary = async (req, res, next) => {
  try {
    const { driveId } = req.params;

    // Find the drive
    const drive = await CommunityDrive.findById(driveId)
      .populate("createdBy", "name email")
      .populate("participants", "name email");

    if (!drive) {
      throw new ExpressError("Drive not found.", 404);
    }

    // Check if drive is completed
    if (drive.status !== "completed") {
      throw new ExpressError("This drive is not completed yet.", 400);
    }

    // Check if impact board has been finalized
    if (!drive.result) {
      throw new ExpressError("Impact board summary is not available yet.", 404);
    }

    res.status(200).json({
      success: true,
      drive: {
        _id: drive._id,
        heading: drive.heading,
        description: drive.description,
        eventDate: drive.eventDate,
        createdBy: drive.createdBy,
        participants: drive.participants,
        result: drive.result,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching summary:", err);
    next(err);
  }
};
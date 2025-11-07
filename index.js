if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
let express = require("express");
let cors = require("cors");
require("./auth/passport");
let methodOverride = require("method-override");
const compression = require("compression");
let ExpressError = require("./utils/ExpressError");
let mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

let app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(methodOverride("_method"));

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["x-updated-token"]
}));

mongoose.connect(process.env.MONGODB_URI);
let db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});

const port = process.env.BACKEND_PORT || 5000;

let userRoutes = require("./routes/user");
let authRoutes = require("./routes/auth");
let notLoggedRoutes = require("./routes/notLogged");

app.use("/notLogged", notLoggedRoutes);

app.use("/auth", authRoutes);

app.use("/user", userRoutes);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a drive chat room
  socket.on("joinDriveRoom", (driveId) => {
    socket.join(`drive-${driveId}`);
    console.log(`Socket ${socket.id} joined drive room: drive-${driveId}`);
  });

  // Leave a drive chat room
  socket.on("leaveDriveRoom", (driveId) => {
    socket.leave(`drive-${driveId}`);
    console.log(`Socket ${socket.id} left drive room: drive-${driveId}`);
  });

  // Handle typing indicator
  socket.on("typing", ({ driveId, userName }) => {
    socket.to(`drive-${driveId}`).emit("userTyping", { userName });
  });

  socket.on("stopTyping", ({ driveId }) => {
    socket.to(`drive-${driveId}`).emit("userStoppedTyping");
  });

  // Impact Board room management
  socket.on("joinImpactBoard", ({ driveId, userId, userName }) => {
    socket.join(`impact-${driveId}`);
    socket.userId = userId;
    socket.userName = userName;
    console.log(`Socket ${socket.id} (${userName}) joined impact board: impact-${driveId}`);
    
    // Notify others that a user joined
    socket.to(`impact-${driveId}`).emit("userJoinedImpactBoard", {
      userId,
      userName,
      socketId: socket.id,
    });

    // Send list of active users in the room
    const room = io.sockets.adapter.rooms.get(`impact-${driveId}`);
    const activeUsers = [];
    if (room) {
      room.forEach(socketId => {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket && clientSocket.userId && clientSocket.userName) {
          activeUsers.push({
            userId: clientSocket.userId,
            userName: clientSocket.userName,
            socketId: socketId,
          });
        }
      });
    }
    socket.emit("activeImpactUsers", activeUsers);
  });

  socket.on("leaveImpactBoard", ({ driveId, userId }) => {
    socket.leave(`impact-${driveId}`);
    console.log(`Socket ${socket.id} left impact board: impact-${driveId}`);
    
    // Notify others that a user left
    socket.to(`impact-${driveId}`).emit("userLeftImpactBoard", {
      userId,
      socketId: socket.id,
    });
  });

  // Impact Board field focus/blur for cursor tracking
  socket.on("impactFieldFocus", ({ driveId, field, userId, userName, cursorPosition }) => {
    socket.to(`impact-${driveId}`).emit("userFocusedField", {
      field,
      userId,
      userName,
      socketId: socket.id,
      cursorPosition,
    });
  });

  socket.on("impactFieldBlur", ({ driveId, field, userId }) => {
    socket.to(`impact-${driveId}`).emit("userBlurredField", {
      field,
      userId,
      socketId: socket.id,
    });
  });

  // Real-time cursor position updates
  socket.on("cursorPositionUpdate", ({ driveId, field, userId, userName, cursorPosition }) => {
    socket.to(`impact-${driveId}`).emit("remoteCursorUpdate", {
      field,
      userId,
      userName,
      socketId: socket.id,
      cursorPosition,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    // Notify impact board rooms about disconnection
    if (socket.userId) {
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith("impact-")) {
          socket.to(room).emit("userLeftImpactBoard", {
            userId: socket.userId,
            socketId: socket.id,
          });
        }
      });
    }
  });
});

app.all("*", (req, res, next) => {
  // print the requested URL
  console.log("Requested URL:", req.originalUrl);
  next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
  console.log("in error route");
  // let {status=500,message="something went wrong"}=err;
  let { status = 500 } = err;
  if (!err.message) {
    err.message = "Something went Wrong";
  }
  // res.status(status).render("error",{err})
  console.log(err.message);
  res.status(status).json({ error: err.message });
});

server.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
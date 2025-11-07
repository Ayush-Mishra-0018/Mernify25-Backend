if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
let express = require("express");
let cors = require("cors");
let methodOverride = require("method-override");
const compression = require("compression");
let ExpressError = require("./utils/ExpressError");
let mongoose = require("mongoose");
let app = express();
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

app.use("/user", userRoutes);


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

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
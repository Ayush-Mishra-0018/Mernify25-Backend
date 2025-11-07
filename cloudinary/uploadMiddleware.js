let { cloudinary, storage } = require("./index")
let multer = require("multer")
let upload = multer({ storage ,limits: { fileSize: 1024*1024*50 } })
module.exports = upload.single("file")
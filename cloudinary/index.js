let cloudinary=require("cloudinary").v2
let {CloudinaryStorage}=require("multer-storage-cloudinary")
cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_KEY,
    api_secret:process.env.CLOUDINARY_SECRET
})

let storage=new CloudinaryStorage({
    cloudinary:cloudinary,
    params:{
        folder:"Test",
        // allowedFormats:["xlsx"]
        // resource raw
        resource_type:"raw"
    }
})

module.exports={
    cloudinary,
    storage
}
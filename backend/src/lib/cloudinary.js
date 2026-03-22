import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env.js";

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

export const uploadBufferToCloudinary = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });

export const destroyCloudinaryAsset = (publicId, options = {}) =>
  cloudinary.uploader.destroy(publicId, {
    invalidate: true,
    ...options,
  });

export default cloudinary;
// This code initializes and configures the Cloudinary SDK for use in the application.
// 1. It imports the Cloudinary SDK and the environment variables.
// 2. It configures Cloudinary with the necessary credentials (cloud name, API key, and API secret) obtained from environment variables.
// 3. Finally, it exports the configured Cloudinary instance for use in other parts of the application, such as uploading and managing media files.

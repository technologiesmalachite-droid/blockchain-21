import multer from "multer";
import { env } from "../config/env.js";

const allowedMimes = new Set(env.kycAllowedMimeTypes);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.kycDocumentMaxSizeBytes,
    files: 6,
  },
  fileFilter(_req, file, callback) {
    if (!allowedMimes.has(file.mimetype)) {
      callback(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }

    callback(null, true);
  },
});

export const kycDocumentUpload = upload.fields([
  { name: "govIdFront", maxCount: 1 },
  { name: "govIdBack", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]);

export const kycDocumentUploadSafe = (req, res, next) => {
  kycDocumentUpload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    error.statusCode = 400;
    error.message = error.message || "Invalid KYC upload payload.";
    next(error);
  });
};

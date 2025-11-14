import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multipart form data --> not json data receive, we also recieve image
// Multer Setup (Where file store, what is the name of file , what is the path of file)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// get special method from multer
const handleMultipartData = multer({
  storage,
  limits: { fileSize: 1000000 * 100 }, // 100mb
}).fields([
  { name: "image", maxCount: 1 }, // "image" is the field name for the image file.
]);


export default handleMultipartData;
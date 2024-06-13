import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import indexRouter from "./routes/index.mjs";

const app = express();
let port = 3000;

// Set up Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(path.resolve(), "public")));

// Use routes from the index router
app.use("/", upload.array("obrFiles"), indexRouter);

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Function to start the server with port retry logic
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(
        `Port ${port} is already in use, trying port ${port + 1}...`
      );
      startServer(port + 1);
    } else {
      console.error(`Server error: ${err}`);
    }
  });
}

// Start the server
startServer(port);

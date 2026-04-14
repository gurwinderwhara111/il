const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = 3000;

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload video
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    console.error('Upload failed: no file received');
    return res.status(400).send('No file uploaded.');
  }
  console.log(`Upload success: ${req.file.originalname} -> ${req.file.filename}`);
  res.json({ filename: req.file.filename });
});

// Get video duration
app.get('/duration/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  console.log(`Duration request for ${req.params.filename}`);
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err) {
      console.error('Error getting video duration:', err.message);
      return res.status(500).send('Error getting video duration.');
    }
    const duration = metadata.format.duration;
    res.json({ duration });
  });
});

// Cut video
app.post('/cut', express.json(), (req, res) => {
  const { filename, start, end, output } = req.body;
  console.log(`Cut request: ${filename}, ${start}-${end}, output=${output}`);
  const inputPath = path.join(__dirname, 'uploads', filename);
  const outputPath = path.join(__dirname, 'uploads', output);

  ffmpeg(inputPath)
    .setStartTime(start)
    .setDuration(end - start)
    .output(outputPath)
    .on('end', () => {
      console.log(`Cut complete: ${output}`);
      res.json({ success: true, output });
    })
    .on('error', (err) => {
      console.error('Error cutting video:', err.message);
      res.status(500).send('Error cutting video.');
    })
    .run();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
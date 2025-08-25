const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { checkSubscription, trackGuideUsage } = require('../middleware/security');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow PDF, TXT, DOC, DOCX files
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, TXT, DOC, and DOCX files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// POST /api/upload/script - Upload script file
router.post(
  '/script',
  [
    auth,
    checkSubscription('free'),
    trackGuideUsage,
    upload.single('script'),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('characterName').trim().isLength({ min: 1, max: 100 }),
    body('productionTitle').trim().isLength({ min: 1, max: 200 }),
    body('productionType').trim().isLength({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { title, characterName, productionTitle, productionType } = req.body;
      const userId = req.userId;

      // Extract text content from file
      let scriptContent = '';
      
      if (req.file.mimetype === 'text/plain') {
        scriptContent = fs.readFileSync(req.file.path, 'utf8');
      } else if (req.file.mimetype === 'application/pdf') {
        // For PDF files, you would use pdf-parse or similar
        // For now, we'll store the file path and process later
        scriptContent = `PDF file uploaded: ${req.file.filename}`;
      } else {
        // For DOC/DOCX files, you would use mammoth or similar
        scriptContent = `Document file uploaded: ${req.file.filename}`;
      }

      // Create guide record
      const Guide = require('../models/Guide');
      const guide = await Guide.create({
        userId,
        title,
        characterName,
        productionTitle,
        productionType,
        scriptContent,
        scriptFilePath: req.file.path,
        scriptFileName: req.file.originalname,
        status: 'pending'
      });

      res.status(201).json({
        message: 'Script uploaded successfully',
        guide: {
          id: guide.id,
          title: guide.title,
          characterName: guide.characterName,
          productionTitle: guide.productionTitle,
          productionType: guide.productionType,
          status: guide.status,
          scriptFileName: guide.scriptFileName,
          createdAt: guide.createdAt
        }
      });

    } catch (error) {
      console.error('Script upload error:', error);
      
      // Clean up uploaded file if there was an error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      if (error.message.includes('Invalid file type')) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: 'Failed to upload script' });
    }
  }
);

// POST /api/upload/pdf - Upload PDF script (legacy endpoint)
router.post(
  '/pdf',
  [
    auth,
    checkSubscription('free'),
    trackGuideUsage,
    upload.single('pdf')
  ],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No PDF file uploaded' });
      }

      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: 'Only PDF files are allowed' });
      }

      const userId = req.userId;
      const uploadId = 'upl_' + Date.now();

      // Store file info in memory (for backward compatibility)
      if (!global.uploadedTexts) {
        global.uploadedTexts = new Map();
      }

      // For now, just store the file path
      // In a real implementation, you'd extract text using pdf-parse
      global.uploadedTexts.set(uploadId, {
        filePath: req.file.path,
        fileName: req.file.originalname,
        userId: userId
      });

      res.json({
        ok: true,
        uploadId,
        filename: req.file.originalname,
        message: 'PDF uploaded successfully'
      });

    } catch (error) {
      console.error('PDF upload error:', error);
      
      // Clean up uploaded file if there was an error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({ 
        ok: false, 
        message: 'Failed to upload PDF' 
      });
    }
  }
);

// GET /api/upload/files - Get user's uploaded files
router.get('/files', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const Guide = require('../models/Guide');
    
    const guides = await Guide.findAll({
      where: { userId },
      attributes: ['id', 'title', 'scriptFileName', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      files: guides.map(guide => ({
        id: guide.id,
        title: guide.title,
        fileName: guide.scriptFileName,
        uploadedAt: guide.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching uploaded files:', error);
    res.status(500).json({ message: 'Failed to fetch uploaded files' });
  }
});

// DELETE /api/upload/files/:id - Delete uploaded file
router.delete('/files/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const Guide = require('../models/Guide');
    const guide = await Guide.findOne({ where: { id, userId } });

    if (!guide) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete physical file if it exists
    if (guide.scriptFilePath && fs.existsSync(guide.scriptFilePath)) {
      try {
        fs.unlinkSync(guide.scriptFilePath);
      } catch (unlinkError) {
        console.error('Error deleting physical file:', unlinkError);
      }
    }

    // Delete guide record
    await guide.destroy();

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Only one file allowed.' });
    }
    return res.status(400).json({ message: 'File upload error' });
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ message: error.message });
  }

  next(error);
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 配置：只接受图片，限制5MB
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: function (req, file, cb) {
    cb(null, 'hero-bg-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/GIF/WebP/SVG 格式'));
    }
  }
});

// POST /api/upload/hero - 上传 Hero 背景图片（管理员）
router.post('/hero', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '请选择图片文件' });
  }
  const url = '/uploads/' + req.file.filename;
  res.json({ success: true, data: { url: url }, message: '图片上传成功' });
});

module.exports = router;

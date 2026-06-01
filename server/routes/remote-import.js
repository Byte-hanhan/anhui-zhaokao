const express = require('express');
const router = express.Router();
const { db } = require('../db');

// POST /api/remote/import
// 接收爬虫工具推送的数据，写入 posts 表（含去重）
router.post('/import', (req, res) => {
  const { posts, apiKey } = req.body;

  // 简单的 API Key 验证
  const VALID_KEY = process.env.IMPORT_API_KEY || 'anhui-crawler-2024';
  if (apiKey !== VALID_KEY) {
    return res.status(401).json({ success: false, message: 'API Key 无效' });
  }

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return res.json({ success: false, message: 'posts 为空' });
  }

  let pushed = 0, skipped = 0, processed = 0;

  posts.forEach(post => {
    db.get('SELECT id FROM posts WHERE title = ?', [post.title], (err, row) => {
      if (row) {
        skipped++;
      } else {
        db.run(
          `INSERT INTO posts (title, category, category_name, date, content, link, source, views, is_top, recruitment_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
          [
            post.title || '',
            post.category || 'sydw',
            post.category_name || '事业单位',
            post.date || '',
            post.content || '',
            post.link || '',
            post.source || '爬虫',
            post.recruitment_type || null
          ],
          (e) => { if (!e) pushed++; }
        );
      }
      processed++;
      if (processed >= posts.length) {
        res.json({ success: true, pushed, skipped, total: posts.length });
      }
    });
  });
});

module.exports = router;

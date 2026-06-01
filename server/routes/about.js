const express = require('express');
const { db } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

const router = express.Router();

// GET /api/about - 获取关于我们页面内容（公开）
router.get('/', (req, res) => {
  db.all('SELECT * FROM about_page ORDER BY id ASC', (err, rows) => {
    if (err) return res.json({ success: false, message: '查询失败' });
    
    // 转换为键值对格式
    const data = {};
    rows.forEach(row => {
      data[row.section_key] = {
        title: row.title,
        content: row.content
      };
    });
    
    res.json({ success: true, data });
  });
});

// PUT /api/about/:key - 更新关于我们页面某章节内容（管理员）
router.put('/:key', authMiddleware, adminMiddleware, (req, res) => {
  const sectionKey = req.params.key;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.json({ success: false, message: '标题和内容为必填项' });
  }

  db.run(
    `UPDATE about_page SET title=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE section_key=?`,
    [title, content, sectionKey],
    function (err) {
      if (err) return res.json({ success: false, message: '更新失败' });
      if (this.changes === 0) return res.json({ success: false, message: '章节不存在' });
      
      db.get('SELECT * FROM about_page WHERE section_key = ?', [sectionKey], (err, section) => {
        res.json({ success: true, data: section, message: '更新成功' });
      });
    }
  );
});

module.exports = router;

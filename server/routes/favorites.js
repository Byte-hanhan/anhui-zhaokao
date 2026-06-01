const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// GET /api/favorites - 获取我的收藏列表
router.get('/', authMiddleware, (req, res) => {
  db.all(
    `SELECT p.id, p.title, p.category, p.category_name, p.date, p.link, p.views, p.is_top, p.top_order, p.source, p.recruitment_type,
            datetime(p.created_at, '+8 hours') as created_at,
            datetime(p.updated_at, '+8 hours') as updated_at
     FROM favorites f JOIN posts p ON f.post_id = p.id WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    [req.user.id],
    (err, posts) => {
      if (err) return res.json({ success: false, message: '查询失败' });
      res.json({ success: true, data: posts });
    }
  );
});

// POST /api/favorites/:postId - 添加/取消收藏（toggle）
router.post('/:postId', authMiddleware, (req, res) => {
  const postId = parseInt(req.params.postId);
  const userId = req.user.id;

  // 检查公告是否存在
  db.get('SELECT id FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err || !post) {
      return res.json({ success: false, message: '公告不存在' });
    }

    // 检查是否已收藏
    db.get('SELECT id FROM favorites WHERE user_id = ? AND post_id = ?', [userId, postId], (err, fav) => {
      if (err) return res.json({ success: false, message: '操作失败' });

      if (fav) {
        // 已收藏，取消收藏
        db.run('DELETE FROM favorites WHERE id = ?', [fav.id], (err) => {
          if (err) return res.json({ success: false, message: '取消收藏失败' });
          res.json({ success: true, message: '已取消收藏', data: { favorited: false } });
        });
      } else {
        // 未收藏，添加收藏
        db.run('INSERT INTO favorites (user_id, post_id) VALUES (?, ?)', [userId, postId], (err) => {
          if (err) return res.json({ success: false, message: '收藏失败' });
          res.json({ success: true, message: '已收藏', data: { favorited: true } });
        });
      }
    });
  });
});

module.exports = router;

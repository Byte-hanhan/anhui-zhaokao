const express = require('express');
const { db } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

const router = express.Router();

// GET /api/users - 获取用户列表（管理员）
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  db.all('SELECT id, username, nickname, role, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) return res.json({ success: false, message: '查询失败' });
    res.json({ success: true, data: users });
  });
});

// DELETE /api/users/:id - 删除用户（管理员）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);

  // 不允许删除自己
  if (id === req.user.id) {
    return res.json({ success: false, message: '不能删除自己' });
  }

  db.run('DELETE FROM users WHERE id = ? AND role != ?', [id, 'admin'], function (err) {
    if (err) return res.json({ success: false, message: '删除失败' });
    if (this.changes === 0) return res.json({ success: false, message: '用户不存在或不能删除管理员' });
    res.json({ success: true, message: '删除成功' });
  });
});

module.exports = router;

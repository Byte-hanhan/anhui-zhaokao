const express = require('express');
const { db } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

const router = express.Router();

// GET /api/site-config/hero - 获取 Hero 背景配置（公开）
router.get('/hero', (req, res) => {
  db.get('SELECT value FROM site_config WHERE key = ?', ['hero_background'], (err, row) => {
    if (err) return res.json({ success: false, message: '查询失败' });
    res.json({
      success: true,
      data: {
        background: row ? row.value : 'default'
      }
    });
  });
});

// PUT /api/site-config/hero - 设置 Hero 背景（管理员）
router.put('/hero', authMiddleware, adminMiddleware, (req, res) => {
  const { background } = req.body;
  if (!background) {
    return res.json({ success: false, message: '请选择背景样式' });
  }

  db.run(
    'INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
    ['hero_background', background, background],
    function (err) {
      if (err) return res.json({ success: false, message: '保存失败: ' + err.message });
      res.json({ success: true, data: { background }, message: '背景更新成功' });
    }
  );
});

// GET /api/site-config/donation - 获取打赏图片及开关状态（公开）
router.get('/donation', (req, res) => {
  db.all('SELECT key, value FROM site_config WHERE key IN (?, ?, ?)', ['donation_image_1', 'donation_image_2', 'donation_enabled'], (err, rows) => {
    if (err) return res.json({ success: false, message: '查询失败' });
    const data = { image_1: '', image_2: '', enabled: true };
    rows.forEach(r => {
      if (r.key === 'donation_image_1') data.image_1 = r.value;
      if (r.key === 'donation_image_2') data.image_2 = r.value;
      if (r.key === 'donation_enabled') data.enabled = r.value !== 'false';
    });
    res.json({ success: true, data });
  });
});

// PUT /api/site-config/donation - 保存打赏图片（管理员）
router.put('/donation', authMiddleware, adminMiddleware, (req, res) => {
  const { image_1, image_2 } = req.body;
  db.serialize(() => {
    db.run('INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
      ['donation_image_1', image_1 || '', image_1 || '']);
    db.run('INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
      ['donation_image_2', image_2 || '', image_2 || ''], function (err) {
        if (err) return res.json({ success: false, message: '保存失败' });
        res.json({ success: true, message: '打赏设置已保存' });
    });
  });
});

// PUT /api/site-config/donation/toggle - 开关打赏功能（管理员）
router.put('/donation/toggle', authMiddleware, adminMiddleware, (req, res) => {
  const { enabled } = req.body;
  const value = enabled ? 'true' : 'false';
  db.run(
    'INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
    ['donation_enabled', value, value],
    function (err) {
      if (err) return res.json({ success: false, message: '保存失败: ' + err.message });
      res.json({ success: true, data: { enabled: enabled }, message: enabled ? '打赏功能已开启' : '打赏功能已关闭' });
    }
  );
});

module.exports = router;

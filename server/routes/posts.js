const express = require('express');
const { db } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

const router = express.Router();

// GET /api/posts/recruitment-counts - 获取校招和社招公告数量（公开）
// 优化：合并为一次查询，both 类型同时计入校招和社招
router.get('/recruitment-counts', (req, res) => {
  db.get(
    `SELECT 
      SUM(CASE WHEN recruitment_type IN ('xiaozhao','both') THEN 1 ELSE 0 END) as xiaozhao,
      SUM(CASE WHEN recruitment_type IN ('shezhao','both') THEN 1 ELSE 0 END) as shezhao
    FROM posts`,
    (err, row) => {
      if (err) return res.json({ success: false, message: '查询失败' });
      res.json({
        success: true,
        data: {
          xiaozhao: row.xiaozhao || 0,
          shezhao: row.shezhao || 0
        }
      });
    }
  );
});

// GET /api/posts/feed.xml - RSS 订阅源（公开）
router.get('/feed.xml', (req, res) => {
  db.all('SELECT id, title, category_name, date, created_at FROM posts ORDER BY created_at DESC LIMIT 50', (err, posts) => {
    if (err) { res.status(500).end(); return; }
    const baseUrl = 'https://www.anhuizhaokao.cn';
    let rss = '<?xml version="1.0" encoding="UTF-8"?>\n';
    rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n';
    rss += '  <title>安徽招考网</title>\n';
    rss += '  <link>' + baseUrl + '</link>\n';
    rss += '  <description>安徽地区公务员、事业单位、教师、国企等招考信息聚合</description>\n';
    rss += '  <language>zh-CN</language>\n';
    rss += '  <atom:link href="' + baseUrl + '/api/posts/feed.xml" rel="self" type="application/rss+xml"/>\n';
    posts.forEach(p => {
      const pubDate = new Date(p.created_at).toUTCString();
      rss += '  <item>\n';
      rss += '    <title>' + escapeXml(p.title) + '</title>\n';
      rss += '    <link>' + baseUrl + '/detail.html?id=' + p.id + '</link>\n';
      rss += '    <pubDate>' + pubDate + '</pubDate>\n';
      rss += '    <category>' + escapeXml(p.category_name || '') + '</category>\n';
      rss += '    <guid isPermaLink="true">' + baseUrl + '/detail.html?id=' + p.id + '</guid>\n';
      rss += '    <description>' + escapeXml(p.title) + '</description>\n';
      rss += '  </item>\n';
    });
    rss += '</channel>\n</rss>';
    res.header('Content-Type', 'application/xml').send(rss);
  });
});

function escapeXml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// GET /api/posts - 获取公告列表（公开）
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  let perPage = parseInt(req.query.perPage) || 10;
if (perPage > 100) perPage = 100; // 限制最大每页数量
  const category = req.query.category || 'all';
  const recruitmentType = req.query.recruitmentType || 'all';
  const search = req.query.q || '';
  const sort = req.query.sort || 'latest';
  const city = req.query.city || 'all';

  let whereClause = '1=1';
  let params = [];

  if (city !== 'all') {
    whereClause += ' AND city = ?';
    params.push(city);
  }

  if (category !== 'all') {
    whereClause += ' AND category = ?';
    params.push(category);
  }

  if (recruitmentType !== 'all') {
    // 筛选校招时也包含 both 类型的公告；筛选社招同理
    whereClause += ' AND (recruitment_type = ? OR recruitment_type = ?)';
    params.push(recruitmentType, 'both');
  }

  if (search.trim()) {
    whereClause += ' AND (title LIKE ? OR category_name LIKE ?)';
    const like = '%' + search.trim() + '%';
    params.push(like, like);
  }

  // 排序
  let orderBy = '';
  if (sort === 'popular') {
    orderBy = 'ORDER BY views DESC';
  } else {
    // 默认：置顶优先（top_order DESC），然后按创建时间 DESC
    orderBy = 'ORDER BY is_top DESC, top_order DESC, created_at DESC';
  }

  // 先查总数
  db.get('SELECT COUNT(*) as total FROM posts WHERE ' + whereClause, params, (err, row) => {
    if (err) return res.json({ success: false, message: '查询失败' });

    const total = row.total;
    const offset = (page - 1) * perPage;

    // 查数据（列表排除 content 字段以减少传输量，时区转换为本地时间）
    const queryParams = [...params, perPage, offset];
    db.all(
      `SELECT id, title, category, category_name, date, link, views, is_top, top_order, source, recruitment_type, city,
              datetime(created_at, '+8 hours') as created_at,
              datetime(updated_at, '+8 hours') as updated_at
       FROM posts WHERE ` + whereClause + ' ' + orderBy + ' LIMIT ? OFFSET ?',
      queryParams,
      (err, posts) => {
        if (err) return res.json({ success: false, message: '查询失败' });
        res.json({
          success: true,
          data: posts,
          total,
          page,
          perPage
        });
      }
    );
  });
});

// GET /api/posts/today - 获取今日新增公告（公开）
router.get('/today', (req, res) => {
  db.all(
    `SELECT id, title, category_name, date
     FROM posts 
     WHERE date(created_at, '+8 hours') = date('now', '+8 hours') 
     ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.json({ success: false, message: '查询失败' });
      const now = new Date();
      const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '号';
      const shareText = rows.length > 0
        ? dateStr + ' 今日招考：\n' + rows.map((r, i) => (i + 1) + '、' + r.title + ' https://www.anhuizhaokao.cn/detail.html?id=' + r.id).join('\n')
        : '';
      res.json({ success: true, data: rows, count: rows.length, date: dateStr, shareText });
    }
  );
});

// GET /api/posts/:id - 获取单条公告详情（公开）
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);

  db.get(
    `SELECT id, title, category, category_name, date, content, link, views, is_top, top_order, source, recruitment_type, city,
            datetime(created_at, '+8 hours') as created_at,
            datetime(updated_at, '+8 hours') as updated_at
     FROM posts WHERE id = ?`, [id], (err, post) => {
    if (err) return res.json({ success: false, message: '查询失败' });
    if (!post) return res.json({ success: false, message: '公告不存在' });

    // 增加浏览量
    db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: post });
  });
});

// POST /api/posts - 新增公告（管理员）
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { title, category, categoryName, date, content, link, source, recruitmentType, city } = req.body;

  console.log('[新增公告] 收到请求:', JSON.stringify({ title, category, categoryName, date, contentLen: (content||'').length, link, recruitmentType }));

  if (!title || !category || !categoryName || !date) {
    console.log('[新增公告] 缺少必填字段:', { title: !!title, category: !!category, categoryName: !!categoryName, date: !!date });
    return res.json({ success: false, message: '标题、分类、日期为必填项' });
  }

  db.run(
    'INSERT INTO posts (title, category, category_name, date, content, link, source, views, is_top, top_order, recruitment_type, city) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)',
    [title, category, categoryName, date, content || '', link || '', source || 'admin', recruitmentType || null, city || null],
    function (err) {
      if (err) {
        console.error('[新增公告] INSERT失败:', err.message);
        return res.json({ success: false, message: '创建失败: ' + err.message });
      }
      console.log('[新增公告] 创建成功, ID:', this.lastID);

      db.get(
        `SELECT id, title, category, category_name, date, content, link, views, is_top, top_order, source, recruitment_type, city,
                datetime(created_at, '+8 hours') as created_at,
                datetime(updated_at, '+8 hours') as updated_at
         FROM posts WHERE id = ?`, [this.lastID], (err, post) => {
        res.json({ success: true, data: post, message: '公告创建成功' });
      });
    }
  );
});

// PUT /api/posts/:id - 修改公告（管理员）
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const { title, category, categoryName, date, content, link, recruitmentType, city } = req.body;

  db.run(
    `UPDATE posts SET title=?, category=?, category_name=?, date=?, content=?, link=?, recruitment_type=?, city=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [title, category, categoryName, date, content, link, recruitmentType || null, city || null, id],
    function (err) {
      if (err) return res.json({ success: false, message: '修改失败' });
      if (this.changes === 0) return res.json({ success: false, message: '公告不存在' });


      db.get(
        `SELECT id, title, category, category_name, date, content, link, views, is_top, top_order, source, recruitment_type, city,
                datetime(created_at, '+8 hours') as created_at,
                datetime(updated_at, '+8 hours') as updated_at
         FROM posts WHERE id = ?`, [id], (err, post) => {
        res.json({ success: true, data: post, message: '修改成功' });
      });
    }
  );
});

// DELETE /api/posts/:id - 删除公告（管理员）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);

  db.run('DELETE FROM posts WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false, message: '删除失败' });
    if (this.changes === 0) return res.json({ success: false, message: '公告不存在' });
    res.json({ success: true, message: '删除成功' });
  });
});

// PATCH /api/posts/:id/top - 置顶/取消置顶（管理员）
router.patch('/:id/top', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);

  // 先查看当前状态
  db.get('SELECT is_top, top_order FROM posts WHERE id = ?', [id], (err, post) => {
    if (err) return res.json({ success: false, message: '查询失败' });
    if (!post) return res.json({ success: false, message: '公告不存在' });

    if (post.is_top) {
      // 取消置顶
      db.run('UPDATE posts SET is_top=0, top_order=0 WHERE id=?', [id], (err) => {
        if (err) return res.json({ success: false, message: '操作失败' });
        res.json({ success: true, message: '已取消置顶', data: { isTop: false, topOrder: 0 } });
      });
    } else {
      // 置顶：获取当前最大 top_order
      db.get('SELECT MAX(top_order) as max_order FROM posts WHERE is_top=1', (err, row) => {
        const newOrder = (row.max_order || 0) + 1;
        db.run('UPDATE posts SET is_top=1, top_order=? WHERE id=?', [newOrder, id], (err) => {
          if (err) return res.json({ success: false, message: '操作失败' });
          res.json({ success: true, message: '已置顶', data: { isTop: true, topOrder: newOrder } });
        });
      });
    }
  });
});

// POST /api/posts/import - 批量导入（管理员）
router.post('/import', authMiddleware, adminMiddleware, (req, res) => {
  const { posts } = req.body;

  if (!Array.isArray(posts) || posts.length === 0) {
    return res.json({ success: false, message: '导入数据格式错误' });
  }

  const catMap = {
    gwy: '公务员', sydw: '事业单位', js: '教师招聘',
    gq: '国企招聘', ylws: '医疗卫生', szyf: '三支一扶', bw: '编外'
  };

  let successCount = 0;
  let failCount = 0;

  // 使用事务批量插入
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    posts.forEach(item => {
      if (!item.title) { failCount++; return; }

      const category = item.category || 'sydw';
      const categoryName = item.categoryName || catMap[category] || '事业单位';
      const date = item.date || new Date().toISOString().split('T')[0];
      const recruitmentType = item.recruitmentType || null;

      db.run(
        'INSERT INTO posts (title, category, category_name, date, content, link, source, views, is_top, top_order, recruitment_type) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)',
        [item.title, category, categoryName, date, item.content || '', item.link || '', 'import', recruitmentType],
        function (err) {
          if (err) { failCount++; } else { successCount++; }
        }
      );
    });

    db.run('COMMIT', (err) => {
      if (err) return res.json({ success: false, message: '导入失败' });
      res.json({
        success: true,
        message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`
      });
    });
  });
});

module.exports = router;

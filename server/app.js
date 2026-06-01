const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const { db, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
const isProduction = process.env.NODE_ENV === 'production';
// 压缩中间件必须放在最前面
app.use(compression({ threshold: 0, filter: (req, res) => {
  if (req.headers['x-no-compression']) {
    return false;
  }
  return compression.filter(req, res);
} }));
app.use(cors(isProduction ? {
  origin: process.env.CORS_ORIGIN || false, // 生产环境默认禁止跨域（同域部署无需CORS）
  credentials: true
} : {
  origin: true, // 开发环境允许所有来源
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件：上传目录
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// API 路由专用：确保 JSON 响应使用 UTF-8 编码
// 注释掉Content-Type设置，让压缩中间件自由处理响应头
app.use('/api', (req, res, next) => {
  // res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 安全头（生产环境）
if (isProduction) {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// 静态文件服务（前端页面）
const staticDir = path.join(__dirname, '..');
app.use(express.static(staticDir));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, time: new Date().toLocaleString('zh-CN'), uptime: process.uptime() });
});

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/about', require('./routes/about'));
app.use('/api/remote', require('./routes/remote-import'));
app.use('/api/site-config', require('./routes/site-config'));
app.use('/api/upload', require('./routes/upload'));

// 404 页面
const fs = require('fs');
app.use((req, res) => {
  const notFoundPath = path.join(staticDir, '404.html');
  try {
    res.status(404).type('html').send(fs.readFileSync(notFoundPath, 'utf8'));
  } catch (e) {
    res.status(404).send('404 Not Found');
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.message);
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误: ' + err.message });
});

// 启动
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log('================================');
      console.log('  安徽招考网 API 服务已启动');
      console.log('  地址: http://localhost:' + PORT);
      console.log('  环境: ' + (process.env.NODE_ENV || 'development'));
      console.log('================================');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();

module.exports = app;

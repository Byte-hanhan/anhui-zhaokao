const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authMiddleware, generateToken } = require('../middlewares/auth');

const router = express.Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: '请输入用户名和密码' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.json({ success: false, message: '数据库错误' });
    if (!user) return res.json({ success: false, message: '用户名或密码错误' });
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.json({ success: false, message: '用户名或密码错误' });
    }
    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role
      }
    });
  });
});

// 注册
router.post('/register', (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: '请输入用户名和密码' });
  }
  if (password.length < 6) {
    return res.json({ success: false, message: '密码至少6位' });
  }
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, existing) => {
    if (err) return res.json({ success: false, message: '数据库错误' });
    if (existing) return res.json({ success: false, message: '用户名已存在' });
    const passwordHash = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (username, nickname, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, nickname || username, passwordHash, 'user'],
      function (err) {
        if (err) return res.json({ success: false, message: '注册失败' });
        const user = { id: this.lastID, username, nickname: nickname || username, role: 'user' };
        const token = generateToken(user);
        res.json({ success: true, token, user });
      }
    );
  });
});

// 获取当前用户信息（第76行附近）
router.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, username, nickname, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, user });
  });
});

// 微信小程序登录
router.post('/wechat-login', (req, res) => {
  const { code, nickName, avatarUrl } = req.body;
  if (!code) return res.json({ success: false, message: '缺少登录凭证' });

  const APPID = 'wxa23ab3640e9a18ac';
  const SECRET = process.env.WX_APP_SECRET || 'b693a0e5c69286e4d2a3b9653db4b913';
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`;

  const https = require('https');
  https.get(url, (wxRes) => {
    let data = '';
    wxRes.on('data', chunk => data += chunk);
    wxRes.on('end', () => {
      try {
        const session = JSON.parse(data);
        if (session.errcode) {
          return res.json({ success: false, message: '微信登录失败: ' + session.errmsg });
        }

        const openid = session.openid;
        // 查找或创建用户（统一 users 表）
        db.get('SELECT * FROM users WHERE openid = ?', [openid], (err, user) => {
          if (err) return res.json({ success: false, message: '数据库错误' });
          if (user) {
            // 已存在，更新登录时间
            db.run('UPDATE users SET nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url), last_login = CURRENT_TIMESTAMP WHERE openid = ?',
              [nickName || null, avatarUrl || null, openid]);
            const token = generateToken({ id: user.id, username: user.username, openid, role: user.role || 'wx_user' });
            res.json({ success: true, token, user: { id: user.id, nickname: nickName || user.nickname, avatarUrl: avatarUrl || user.avatar_url, isNew: false } });
          } else {
            // 新用户
            db.run('INSERT INTO users (username, nickname, avatar_url, openid, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
              ['wx_' + openid.substring(0, 12), nickName || '微信用户', avatarUrl || '', openid, 'wx_user', ''],
              function (err) {
              if (err) return res.json({ success: false, message: '注册失败' });
              const token = generateToken({ id: this.lastID, username: 'wx_' + openid.substring(0, 12), openid, role: 'wx_user' });
              res.json({ success: true, token, user: { id: this.lastID, nickname: nickName || '微信用户', avatarUrl: avatarUrl || '', isNew: true } });
            });
          }
        });
      } catch (e) {
        res.json({ success: false, message: '登录异常' });
      }
    });
  }).on('error', () => {
    res.json({ success: false, message: '微信服务不可达' });
  });
});

// ========== 扫码登录系统 ==========
const qrSessions = new Map(); // code → { status:'pending'|'confirmed', user, token, expires }

// 生成扫码登录会话
router.get('/qrcode-login/generate', (req, res) => {
  const crypto = require('crypto');
  const code = crypto.randomBytes(16).toString('hex');
  qrSessions.set(code, { status: 'pending', user: null, token: null, expires: Date.now() + 300000 });
  // 清理过期
  for (const [k, v] of qrSessions) { if (Date.now() > v.expires) qrSessions.delete(k); }
  res.json({ success: true, code });
});

// 轮询登录状态
router.get('/qrcode-login/check', (req, res) => {
  const { code } = req.query;
  if (!code) return res.json({ success: false, message: '缺少code' });
  const session = qrSessions.get(code);
  if (!session) return res.json({ success: false, message: '会话过期' });
  if (Date.now() > session.expires) { qrSessions.delete(code); return res.json({ success: false, message: '会话过期' }); }
  if (session.status === 'confirmed') {
    const result = { success: true, token: session.token, user: session.user };
    qrSessions.delete(code);
    return res.json(result);
  }
  res.json({ success: false, message: '等待扫码' });
});

// 小程序确认登录
router.post('/qrcode-login/confirm', (req, res) => {
  const { code, userId } = req.body;
  if (!code) return res.json({ success: false, message: '缺少code' });
  const session = qrSessions.get(code);
  if (!session) return res.json({ success: false, message: '会话过期' });
  if (Date.now() > session.expires) { qrSessions.delete(code); return res.json({ success: false, message: '会话过期' }); }

  db.get('SELECT id, username, nickname, avatar_url, openid, role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.json({ success: false, message: '用户不存在' });
    const token = generateToken(user);
    session.status = 'confirmed';
    session.user = { id: user.id, nickname: user.nickname || '微信用户', avatar_url: user.avatar_url };
    session.token = token;
    res.json({ success: true, message: '已确认' });
  });
});

// 生成微信小程序码（官方API）
let _accessToken = null;
let _accessTokenExpires = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _accessTokenExpires) return _accessToken;
  const APPID = 'wxa23ab3640e9a18ac';
  const SECRET = process.env.WX_APP_SECRET || 'b693a0e5c69286e4d2a3b9653db4b913';
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.access_token) {
            _accessToken = j.access_token;
            _accessTokenExpires = Date.now() + (j.expires_in - 300) * 1000;
            resolve(_accessToken);
          } else reject(new Error(j.errmsg));
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

router.get('/qrcode-login/qr', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).end();
  getAccessToken().then(token => {
    const https = require('https');
    const postData = JSON.stringify({ path: 'pages/login/login?code=' + code, width: 280 });
    const options = {
      hostname: 'api.weixin.qq.com',
      path: '/wxa/getwxacode?access_token=' + token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const wxReq = https.request(options, wxRes => {
      const chunks = [];
      wxRes.on('data', chunk => chunks.push(chunk));
      wxRes.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf[0] === 0x7b) {
          try {
            const err = JSON.parse(buf.toString());
            return res.status(500).json({ error: 'wxacode_error', detail: err });
          } catch(e) {}
        }
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(buf);
      });
    });
    wxReq.on('error', () => res.status(500).end());
    wxReq.write(postData);
    wxReq.end();
  }).catch(err => {
    res.status(500).json({ error: 'token_error', detail: err.message });
  });
});

module.exports = router;

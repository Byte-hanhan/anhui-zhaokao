const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'anhui-zhaokao-secret-key-2026';

const DB_PATH = path.join(__dirname, '..', 'data', 'db.sqlite');

// 确保 data 目录存在
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功:', DB_PATH);
  }
});

// 初始化表结构
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          nickname TEXT,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建 users 表失败:', err);
      });

      // 公告表
      db.run(`
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          category_name TEXT NOT NULL,
          date TEXT NOT NULL,
          content TEXT,
          link TEXT,
          views INTEGER DEFAULT 0,
          is_top INTEGER DEFAULT 0,
          top_order INTEGER DEFAULT 0,
          source TEXT DEFAULT 'admin',
          recruitment_type TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建 posts 表失败:', err);
      });

      // 收藏表
      db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          post_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          UNIQUE(user_id, post_id)
        )
      `, (err) => {
        if (err) console.error('创建 favorites 表失败:', err);
      });

      // 数据库迁移：检查并添加 recruitment_type 字段
      db.all(`PRAGMA table_info(posts)`, (err, columns) => {
        if (err) {
          console.error('检查 posts 表结构失败:', err);
          return;
        }
        
        const hasRecruitmentType = columns.some(col => col.name === 'recruitment_type');
        if (!hasRecruitmentType) {
          console.log('正在迁移数据库：添加 recruitment_type 字段...');
          db.run(`ALTER TABLE posts ADD COLUMN recruitment_type TEXT DEFAULT NULL`, (err) => {
            if (err) {
              console.error('添加 recruitment_type 字段失败:', err);
            } else {
              console.log('✓ recruitment_type 字段添加成功');
            }
          });
        }

        const hasCity = columns.some(col => col.name === 'city');
        if (!hasCity) {
          console.log('正在迁移数据库：添加 city 字段...');
          db.run(`ALTER TABLE posts ADD COLUMN city TEXT DEFAULT NULL`, (err) => {
            if (err) {
              console.error('添加 city 字段失败:', err);
            } else {
              console.log('✓ city 字段添加成功');
              // 迁移成功后创建索引
              db.run(`CREATE INDEX IF NOT EXISTS idx_posts_city ON posts(city)`, (e) => { if (e) console.error(e); });
            }
          });
        }
      });

      // 创建索引（加速查询，忽略已存在的错误）
      db.run(`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)`, (e) => { if (e) console.error(e); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_posts_recruitment_type ON posts(recruitment_type)`, (e) => { if (e) console.error(e); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_posts_is_top ON posts(is_top)`, (e) => { if (e) console.error(e); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)`, (e) => { if (e) console.error(e); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_posts_sort ON posts(is_top, top_order, created_at)`, (e) => { if (e) console.error(e); });

      // 网站配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS site_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建 site_config 表失败:', err);
      });

      // 关于我们表
      db.run(`
        CREATE TABLE IF NOT EXISTS about_page (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          section_key TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('创建 about_page 表失败:', err);
        } else {
          // 插入默认数据
          db.get('SELECT id FROM about_page WHERE section_key = ?', ['platform_intro'], (err, row) => {
            if (!row) {
              db.run(`
                INSERT INTO about_page (section_key, title, content) VALUES 
                (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)
              `, [
                'platform_intro', '平台介绍', '安徽招考网（www.anhuizhaokao.cn）是一个专注于安徽地区公职类招聘信息聚合的平台。我们汇集公务员、事业单位、教师招聘、国有企业、医疗卫生、三支一扶等各类招考公告，为安徽地区的求职者提供一站式信息查询服务。\n\n本平台所有信息均免费开放浏览，不设置任何VIP收费功能。我们坚持公益性原则，致力于打破信息壁垒，让每一位求职者都能平等地获取招考信息。',
                'service_mission', '服务宗旨', '本平台坚持公益性质，目前所有信息免费开放浏览，不设 VIP 功能。站主我也是通过考试，成功上岸国企，淋过雨所以才撑起伞，大家共同努力！\n\n希望每一位有志者都能借助这个平台，找到属于自己的那扇门。',
                'coverage', '信息覆盖范围', '本平台招考信息涵盖以下类别：\n- 公务员考试\n- 事业单位招聘\n- 教师招聘\n- 国有企业招聘\n- 医疗卫生招聘\n- 三支一扶计划\n\n地域覆盖安徽省全部16个地级市，并持续扩展信息采集范围，力求做到全省招考信息零遗漏。',
                'disclaimer', '免责声明', '1. 本平台所发布的招考信息均来源于各地官方渠道（如安徽省人事考试网、各市人社局网站等），仅做信息聚合展示之用。\n\n2. 如需了解招考详情及进行报名，请以官方发布的正式公告为准，本平台不对信息的完整性和时效性做绝对保证。\n\n3. 本平台不收取任何费用，不组织任何形式的培训或辅导，提醒广大考生注意甄别，谨防诈骗。\n\n4. 如有侵权或信息错误，请联系我们及时处理。',
                'contact', '联系我们', '电子邮箱：1771329858@qq.com\n官方网站：www.anhuizhaokao.cn\n合作联系：微信账号 iTechNice'
              ], (err) => {
                if (err) {
                  console.error('插入 about_page 默认数据失败:', err);
                } else {
                  console.log('✓ about_page 默认数据插入成功');
                }
              });
            }
          });
        }
      });

      // 创建管理员账号（如果不存在）
      const bcrypt = require('bcryptjs');
      const adminPassword = process.env.ADMIN_PASSWORD || 'ZY203841487';
      const passwordHash = bcrypt.hashSync(adminPassword, 10);

      db.get('SELECT id FROM users WHERE username = ?', ['1771329858'], (err, row) => {
        if (!row) {
          db.run(
            'INSERT INTO users (username, nickname, password_hash, role) VALUES (?, ?, ?, ?)',
            ['1771329858', '管理员', passwordHash, 'admin'],
            (err) => {
              if (err) {
                console.error('创建管理员账号失败:', err);
              } else {
                console.log('管理员账号创建成功 (用户名: 1771329858)');
              }
              resolve();
            }
          );
        } else {
          resolve();
        }
      });
    });
  });
}

module.exports = {
  db,
  jwt,
  JWT_SECRET,
  initDatabase
};

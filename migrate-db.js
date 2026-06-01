const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'data', 'database.db');

console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('连接数据库失败:', err);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 检查 recruitment_type 字段是否存在
db.all("PRAGMA table_info(posts)", (err, rows) => {
  if (err) {
    console.error('查询表结构失败:', err);
    db.close();
    return;
  }

  const hasRecruitmentType = rows.some(row => row.name === 'recruitment_type');
  
  if (hasRecruitmentType) {
    console.log('✅ recruitment_type 字段已存在，无需修改');
    db.close();
    return;
  }

  console.log('⚠️ 缺少 recruitment_type 字段，正在添加...');

  // 添加字段
  db.run('ALTER TABLE posts ADD COLUMN recruitment_type VARCHAR(20) DEFAULT NULL', (err) => {
    if (err) {
      console.error('添加字段失败:', err);
      db.close();
      return;
    }

    console.log('✅ recruitment_type 字段添加成功！');
    
    // 验证
    db.all("PRAGMA table_info(posts)", (err, rows) => {
      if (err) {
        console.error('验证失败:', err);
      } else {
        const field = rows.find(row => row.name === 'recruitment_type');
        if (field) {
          console.log('✅ 验证成功！字段信息:', field);
        }
      }
      db.close();
    });
  });
});

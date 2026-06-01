// 一键修复数据库 - 添加 recruitment_type 字段
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 自动查找数据库文件
function findDb() {
  const possiblePaths = [
    path.join(__dirname, 'data', 'database.db'),
    path.join(__dirname, 'database.db'),
    path.join(__dirname, 'db', 'database.db')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

const dbPath = findDb();

if (!dbPath) {
  console.error('❌ 找不到数据库文件！请手动指定路径。');
  process.exit(1);
}

console.log('✅ 找到数据库:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 连接数据库失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
});

// 检查字段是否存在
db.all("PRAGMA table_info(posts)", (err, rows) => {
  if (err) {
    console.error('❌ 查询表结构失败:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('📋 当前表结构:');
  rows.forEach(row => {
    console.log(`  ${row.cid}: ${row.name} (${row.type})`);
  });

  const hasField = rows.some(row => row.name === 'recruitment_type');
  
  if (hasField) {
    console.log('\n✅ recruitment_type 字段已存在，无需修复');
    db.close();
    return;
  }

  console.log('\n⚠️  缺少 recruitment_type 字段，正在添加...');

  // 添加字段
  db.run('ALTER TABLE posts ADD COLUMN recruitment_type TEXT DEFAULT NULL', (err) => {
    if (err) {
      console.error('❌ 添加字段失败:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('✅ recruitment_type 字段添加成功！\n');

    // 验证
    db.all("PRAGMA table_info(posts)", (err, newRows) => {
      if (err) {
        console.error('❌ 验证失败:', err.message);
      } else {
        const field = newRows.find(row => row.name === 'recruitment_type');
        if (field) {
          console.log('✅ 验证成功！字段信息:');
          console.log(`  ${field.cid}: ${field.name} (${field.type}, nullable: ${field.notnull === 0})`);
        }
      }

      console.log('\n🎉 修复完成！请执行以下操作:');
      console.log('  1. 重启服务: pm2 restart all');
      console.log('  2. 后台编辑公告，设置招聘类型');
      console.log('  3. 访问首页查看校招/社招板块\n');

      db.close();
    });
  });
});

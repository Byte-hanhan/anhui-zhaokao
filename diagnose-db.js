// 数据库诊断工具
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
  console.error('❌ 找不到数据库文件！');
  console.log('\n📁 正在查找目录结构...');
  
  function listDir(dir, depth = 0) {
    if (depth > 2) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    items.forEach(item => {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        console.log('  '.repeat(depth) + '📁 ' + item.name + '/');
        if (depth < 2) listDir(fullPath, depth + 1);
      } else if (item.name.endsWith('.db') || item.name.endsWith('.sqlite') || item.name.endsWith('.sqlite3')) {
        console.log('  '.repeat(depth) + '💾 ' + item.name + ' (' + fs.statSync(fullPath).size + ' bytes)');
      }
    });
  }
  
  listDir(__dirname);
  process.exit(1);
}

console.log('✅ 找到数据库:', dbPath);
console.log('📊 文件大小:', fs.statSync(dbPath).size, 'bytes\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 连接数据库失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
});

// 查找所有表名
db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('❌ 查询表名失败:', err.message);
    db.close();
    return;
  }

  console.log('📋 数据库中的所有表 (' + tables.length + ' 个):');
  if (tables.length === 0) {
    console.log('  (空 - 数据库中没有表)');
  } else {
    tables.forEach(t => {
      console.log('  - ' + t.name);
    });
  }

  // 查找所有索引、视图等
  db.all("SELECT type, name FROM sqlite_master WHERE type != 'table' ORDER BY type, name", (err, others) => {
    if (!err && others.length > 0) {
      console.log('\n📋 其他数据库对象:');
      others.forEach(o => {
        console.log('  - ' + o.type + ': ' + o.name);
      });
    }

    // 如果有表，检查每个表的结构
    if (tables.length > 0) {
      console.log('\n🔍 检查每个表的结构...\n');
      
      let checkCount = 0;
      tables.forEach(t => {
        db.all(`PRAGMA table_info(${t.name})`, (err, columns) => {
          if (!err) {
            console.log('表: ' + t.name);
            console.log('  字段数:', columns.length);
            columns.forEach(col => {
              console.log('    ' + col.cid + ': ' + col.name + ' (' + col.type + ')');
            });
            console.log('');
          }
          
          checkCount++;
          if (checkCount === tables.length) {
            console.log('\n✅ 诊断完成');
            db.close();
          }
        });
      });
    } else {
      console.log('\n⚠️  数据库为空，没有表！');
      console.log('💡 可能需要运行数据库初始化脚本');
      db.close();
    }
  });
});

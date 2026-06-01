#!/usr/bin/env python3
"""为服务器公告自动标注城市标签 - 精确版"""
import sqlite3
import re
import sys

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else "data/db.sqlite"

CITY_RULES = [
    # === 地级市+区县直接匹配 ===
    (r'合肥', 'hf'), (r'瑶海', 'hf'), (r'庐江', 'hf'), (r'肥东', 'hf'),
    (r'芜湖', 'wh'), (r'无为', 'wh'), (r'湾沚', 'wh'), (r'皖南医', 'wh'),
    (r'蚌埠', 'bb'), (r'固镇', 'bb'), (r'安徽电子信息', 'bb'),
    (r'淮南', 'hn'), (r'凤台', 'hn'), (r'安徽理工', 'hn'), (r'焦岗湖', 'hn'),
    (r'马鞍山', 'mas'),
    (r'淮北', 'hb'),
    (r'铜陵', 'tl'),
    (r'安庆', 'aq'), (r'望江', 'aq'), (r'岳西', 'aq'),
    (r'黄山', 'hs'), (r'徽城', 'hs'),
    (r'滁州', 'cz'), (r'凤阳', 'cz'), (r'琅琊', 'cz'),
    (r'阜阳', 'fy'),
    (r'宿州', 'sz'),
    (r'六安', 'la'),
    (r'亳州', 'bz'),
    (r'池州', 'chiz'), (r'东至', 'chiz'), (r'九华', 'chiz'),
    (r'宣城', 'xc'), (r'泾县', 'xc'),
    
    # === 高校定位（非地级市名的高校） ===
    (r'安徽大学', 'hf'), (r'中科大', 'hf'), (r'中国科学技术大学', 'hf'),
    (r'安徽中医药', 'hf'), (r'安徽医科', 'hf'), (r'安医大', 'hf'),
    (r'安徽文达', 'hf'), (r'安徽建筑', 'hf'), (r'安徽农业', 'hf'),
    (r'安徽东南医学', 'hf'),
    
    # === 省级单位（通常在省会合肥） ===
    (r'安徽省综合交通研究院', 'hf'),
    (r'安徽省能源集团', 'hf'),
    (r'安徽省农垦集团', 'hf'),
    (r'安徽省城乡规划设计研究院', 'hf'),
    (r'安徽省环境科学学会', 'hf'),
    (r'安徽省四宜控股', 'hn'),  # 四宜在淮南
    (r'安徽长江产权交易所', 'wh'),  # 长江产权交易所在芜湖
    (r'安徽兴石投资', 'chiz'),  # 石台=池州
    (r'安徽鑫昊', 'hf'),  # 合肥鑫昊
    (r'安徽辉隆', 'hf'),  # 辉隆在合肥
    (r'安徽善赢', 'hf'),  # 建筑公司默认省会
    (r'安徽德铭', 'hf'),  # 电力公司默认省会
    
    # === 省级范围公告 ===
    (r'三支一扶', 'all'),
    (r'火箭军', 'all'),
    (r'国务院', 'all'),
    (r'国家能源', 'all'),
    (r'中冶天工.*安徽', 'all'),
]

def classify_city(title):
    for pattern, code in CITY_RULES:
        if re.search(pattern, title):
            return code
    # 安徽省开头且无法定位的 → 全省
    if title.startswith('安徽省') or title.startswith('安徽'):
        return 'all'
    return 'all'

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # 先重置所有 all 和空标签（保留之前已精确标注的）
    cur.execute("UPDATE posts SET city = '' WHERE city = 'all'")
    
    cur.execute("SELECT id, title FROM posts WHERE city IS NULL OR city = ''")
    posts = cur.fetchall()
    
    for post_id, title in posts:
        city = classify_city(title)
        cur.execute("UPDATE posts SET city = ? WHERE id = ?", (city, post_id))
    
    conn.commit()
    
    # 统计
    cur.execute("SELECT city, COUNT(*) FROM posts GROUP BY city ORDER BY COUNT(*) DESC")
    city_names = {
        'all':'全省','hf':'合肥','wh':'芜湖','bb':'蚌埠','hn':'淮南',
        'mas':'马鞍山','hb':'淮北','tl':'铜陵','aq':'安庆','hs':'黄山',
        'cz':'滁州','fy':'阜阳','sz':'宿州','la':'六安','bz':'亳州',
        'chiz':'池州','xc':'宣城'
    }
    print(f"处理 {len(posts)} 条，分布：")
    for city, cnt in cur.fetchall():
        name = city_names.get(city, city)
        print(f"  {name}({city}): {cnt}")
    
    # 显示全省标签的
    print("\n全省标签：")
    cur.execute("SELECT id, title FROM posts WHERE city = 'all'")
    for pid, title in cur.fetchall():
        print(f"  [{pid}] {title[:60]}")
    
    conn.close()

if __name__ == '__main__':
    main()

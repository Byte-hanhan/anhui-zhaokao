#!/usr/bin/env python3
"""
公考100 (ah.gongkao100.cn) 爬虫 → 安徽招考网数据导入
用法: python scrape_gongkao100.py [--dry-run] [--hours 24]
"""

import requests
import re
import json
import sys
import time
from urllib.parse import urljoin

from urllib.parse import urljoin

BASE_URL = "https://ah.gongkao100.cn"
API_URL = "http://localhost:3001/api"
ADMIN_TOKEN = None

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# 分类映射: 公考100 slug → 安徽招考网 key
CAT_MAP = {
    'gongwuyuan': 'gwy',
    'shiyedanwei': 'sydw',
    'jiaoshizhaopin': 'js',
    'guoqizhaopin': 'gq',
    'yiliaoewisheng': 'ylws',
    'sanzhiyifu': 'szyf',
    'fujingxiaofang': 'bw',
    'shequcungan': 'bw',
    'yinhangzhaopin': 'bw',
    'gongxuanlinxuan': 'bw',
}

CAT_NAME_MAP = {
    'gwy': '公务员', 'sydw': '事业单位', 'js': '教师招聘',
    'gq': '国企招聘', 'ylws': '医疗卫生', 'szyf': '三支一扶', 'bw': '编外',
}

# 忽略的域名（商业/广告/社交/备案等）
IGNORE_DOMAINS = {
    'beian.miit.gov.cn', 'wpa.qq.com', 'mp.weixin.qq.com',
    'ritheme.com', 'gmpg.org', 'gongkao100.cn',
}


def login_admin():
    """登录获取 admin token"""
    global ADMIN_TOKEN
    r = requests.post(f"{API_URL}/auth/login", json={
        'username': '1771329858',
        'password': 'ZY203841487',
    }, headers={'Content-Type': 'application/json'})
    data = r.json()
    if data.get('success'):
        ADMIN_TOKEN = data['token']
        print(f"[✓] 管理员登录成功")
    else:
        print(f"[✗] 登录失败: {data.get('message')}")
        sys.exit(1)


def api_post(path, body=None):
    """调用 API"""
    h = {'Content-Type': 'application/json', 'Authorization': f'Bearer {ADMIN_TOKEN}'}
    if body:
        r = requests.post(f"{API_URL}{path}", json=body, headers=h)
    else:
        r = requests.get(f"{API_URL}{path}", headers=h)
    return r.json()


def fetch_list_page(page=1):
    """抓取列表页"""
    if page == 1:
        url = BASE_URL + '/'
    else:
        url = f"{BASE_URL}/page/{page}"
    r = requests.get(url, headers=HEADERS, timeout=20)
    if r.status_code != 200:
        print(f"  [✗] 列表页 {page} 请求失败: HTTP {r.status_code}")
        return []
    return parse_list_html(r.text)


def parse_list_html(html):
    """解析列表页 HTML，提取文章卡片"""
    posts = []

    # 匹配文章链接: href="https://ah.gongkao100.cn/{ID}.html"
    article_pattern = re.compile(
        r'<article[^>]*>.*?'
        r'href="(https://ah\.gongkao100\.cn/(\d+)\.html)"[^>]*>(.*?)</a>'
        r'(.*?)</article>',
        re.DOTALL
    )

    for match in article_pattern.finditer(html):
        url = match.group(1)
        post_id = int(match.group(2))
        title = re.sub(r'<[^>]+>', '', match.group(3)).strip()
        body_html = match.group(4)

        # 提取分类
        cat_match = re.search(r'/category/([^/\"]+)', body_html)
        cat_slug = cat_match.group(1) if cat_match else None
        category = CAT_MAP.get(cat_slug, 'bw')
        category_name = CAT_NAME_MAP.get(category, '编外')

        # 提取时间
        time_match = re.search(r'(\d+)\s*(秒|分钟|小时|天|周|月)\s*前', body_html)
        if time_match:
            num = int(time_match.group(1))
            unit = time_match.group(2)
            time_hours = estimate_hours(num, unit)
        else:
            time_hours = 999  # 未知时间，默认很旧

        # 提取日期（如果有 YYYY-MM-DD 格式）
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', body_html)
        date = date_match.group(1) if date_match else None

        posts.append({
            'id': post_id,
            'url': url,
            'title': title,
            'category': category,
            'category_name': category_name,
            'time_hours': time_hours,
            'date': date,
            'raw_time': time_match.group(0) if time_match else '未知',
        })

    return posts


def estimate_hours(num, unit):
    """估算相对时间为小时数"""
    if unit == '秒': return num / 3600
    if unit == '分钟': return num / 60
    if unit == '小时': return num
    if unit == '天': return num * 24
    if unit == '周': return num * 24 * 7
    if unit == '月': return num * 24 * 30
    return 999


def fetch_detail(post):
    """抓取 gongkao100 详情页，提取外部链接并跳转到原始官网抓取正文"""
    from bs4 import BeautifulSoup

    try:
        r = requests.get(post['url'], headers=HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"  [✗] 详情页 {post['id']} 请求失败")
            return None
        soup = BeautifulSoup(r.text, 'html.parser')

        # 提取所有外部链接
        all_links = []
        for a in soup.select('.entry-content a[href], article a[href]'):
            href = a.get('href', '')
            if href.startswith('http') and 'gongkao100.cn' not in href:
                all_links.append(href)

        # 过滤忽略域名
        external_links = []
        for link in all_links:
            link = link.replace('&amp;', '&')
            skip = False
            for d in IGNORE_DOMAINS:
                if d in link:
                    skip = True
                    break
            if not skip:
                external_links.append(link)

        # 去重
        seen = set()
        unique_links = []
        for l in external_links:
            if l not in seen:
                seen.add(l)
                unique_links.append(l)

        # 智能选择报名入口
        registration_link = ''
        gov_links = [l for l in unique_links if '.gov.cn' in l]
        edu_links = [l for l in unique_links if '.edu.cn' in l]
        org_links = [l for l in unique_links if '.org.cn' in l]

        if gov_links:
            registration_link = gov_links[0]
        elif edu_links:
            registration_link = edu_links[0]
        elif org_links:
            registration_link = org_links[0]
        elif unique_links:
            registration_link = unique_links[0]

        post['link'] = registration_link
        post['external_links'] = unique_links

        # 提取日期
        if not post.get('date'):
            soup_date = soup.select_one('.entry-date, time, .post-date')
            if soup_date:
                dm = re.search(r'(\d{4}-\d{2}-\d{2})', soup_date.get_text())
                if dm:
                    post['date'] = dm.group(1)

        # 🔑 直接从 gongkao100 详情页抓取公告正文
        # 定位 article.post-content 区域
        article = soup.select_one('article.post-content') or soup.select_one('.entry-content') or soup.select_one('.post-content')
        if article:
            # 移除干扰元素
            for tag in article.select('style, script, .entry-share, .related-posts, .author-bio, .nav-links, .post-navigation'):
                tag.decompose()
            # 清理图片属性
            for img in article.select('img'):
                for attr in ['srcset', 'sizes', 'data-src', 'loading']:
                    if attr in img.attrs:
                        del img[attr]
            post['content_html'] = str(article)
        else:
            post['content_html'] = None

        return post

    except Exception as e:
        print(f"  [✗] 详情页 {post['id']} 异常: {e}")
        return None


def fetch_original_content(url):
    """跳转到原始官网，抓取招考公告正文"""
    from bs4 import BeautifulSoup

    try:
        r = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
        if r.status_code != 200:
            # 某些 gov.cn 可能需要特殊的编码
            r.encoding = r.apparent_encoding
            if r.status_code != 200:
                return None

        # 处理编码
        r.encoding = r.apparent_encoding or 'utf-8'
        soup = BeautifulSoup(r.text, 'html.parser')

        # 移除干扰元素
        for tag in soup.select('script, style, nav, header, footer, .header, .footer, '
                               '.nav, .navbar, .sidebar, .side, .comment, .recommend, '
                               '.related, .share, .copyright, .pagination'):
            tag.decompose()

        # 尝试多种常见正文容器选择器（更精确的优先）
        content_selectors = [
            # 政府网站常见正文容器
            '.j-fontContent', '.article-con', '.article_content', '.article-body',
            '.ls-article-info', '.TRS_Editor', '.Custom_UnionStyle', '.bt_content',
            '#UCAP-CONTENT', '#zoom', '#article', '#content',
            # 通用正文选择器
            '.article-content', '.entry-content', '.post-content', '.post_body',
            '.news-content', '.text-content', '.detail-content', '.con_text',
            '.content', '.main-content',
            'article', '.main',
        ]

        content_div = None
        for sel in content_selectors:
            content_div = soup.select_one(sel)
            if content_div:
                break

        if not content_div:
            # 尝试找最大文本块
            candidates = soup.select('div, section, article')
            best = None
            best_len = 0
            for c in candidates:
                text_len = len(c.get_text(strip=True))
                if text_len > best_len and text_len > 500:
                    # 忽略纯导航/链接区域
                    link_count = len(c.select('a'))
                    if link_count < text_len / 50:  # 链接不要太多
                        best, best_len = c, text_len
            content_div = best

        if not content_div:
            return None

        # 清理图片
        for img in content_div.select('img'):
            src = img.get('src', '')
            if src and not src.startswith('http'):
                # 补全相对路径
                from urllib.parse import urljoin
                img['src'] = urljoin(url, src)
            # 移除无用属性
            for attr in ['srcset', 'sizes', 'data-src', 'onclick', 'onload']:
                if attr in img.attrs:
                    del img[attr]

        # 移除空段落
        for p in content_div.select('p'):
            if not p.get_text(strip=True) and not p.select('img'):
                p.decompose()

        return str(content_div)

    except Exception as e:
        print(f"    原始内容抓取失败 ({url[:50]}...): {e}")
        return None


def import_to_anhuizhaokao(posts):
    """通过 API 批量导入到安徽招考网"""
    if not posts:
        print("[!] 没有可导入的公告")
        return 0

    import_data = []
    for p in posts:
        # 构建正文
        if p.get('content_html'):
            content = p['content_html']
        else:
            content = (f'<p>原文链接：<a href="{p["url"]}" target="_blank">{p["url"]}</a></p>'
                       f'<p>（内容未能自动抓取，请点击链接查看完整公告）</p>')

        import_data.append({
            'title': p['title'],
            'category': p['category'],
            'categoryName': p['category_name'],
            'date': p.get('date') or '2026-05-26',
            'content': content,
            'link': p.get('link', ''),
            'source': 'auto',
            'recruitmentType': None,
        })

    result = api_post('/posts/import', {'posts': import_data})
    if result.get('success'):
        count = len(import_data)
        print(f"[✓] 成功导入 {count} 条公告")
        return count
    else:
        print(f"[✗] 导入失败: {result.get('message')}")
        return 0


def main():
    dry_run = '--dry-run' in sys.argv
    max_hours = 24
    for arg in sys.argv:
        if arg.startswith('--hours='):
            max_hours = float(arg.split('=')[1])

    print("=" * 50)
    print("  公考100 爬虫 → 安徽招考网")
    print(f"  模式: {'试运行(不导入)' if dry_run else '正式导入'}")
    print(f"  时间范围: {max_hours} 小时内")
    print(f"  目标: {BASE_URL}")
    print("=" * 50)

    if not dry_run:
        login_admin()

    # 第1步：抓取列表页
    print("\n[1/4] 抓取列表页...")
    all_posts = []
    for page in range(1, 4):  # 最多3页
        posts = fetch_list_page(page)
        if not posts:
            break
        # 筛选时间范围内的
        recent = [p for p in posts if p['time_hours'] <= max_hours]
        print(f"  第{page}页: {len(posts)} 条, 最新 {len(recent)} 条")
        all_posts.extend(recent)
        # 如果本页最早的文章已超出时间范围，不再翻页
        if posts and posts[-1]['time_hours'] > max_hours:
            break
        time.sleep(1)

    if not all_posts:
        print(f"\n[!] 未找到 {max_hours} 小时内的公告")
        return

    # 去重
    seen_ids = set()
    unique_posts = []
    for p in all_posts:
        if p['id'] not in seen_ids:
            seen_ids.add(p['id'])
            unique_posts.append(p)
    all_posts = unique_posts

    print(f"\n  共找到 {len(all_posts)} 条符合条件的公告")

    # 第2步：检查是否已存在
    print("\n[2/4] 检查重复...")
    if not dry_run:
        existing = api_post('/posts', {'perPage': 200})  # 先用 GET 参数方式
        # 实际上 api_post 不支持 GET 参数，让我们用另一种方式
        r = requests.get(f"{API_URL}/posts?perPage=200", headers={
            'Authorization': f'Bearer {ADMIN_TOKEN}' if ADMIN_TOKEN else ''
        })
        existing_data = r.json()
        existing_titles = set()
        if existing_data.get('success'):
            for ep in existing_data.get('data', []):
                existing_titles.add(ep['title'])

        new_posts = [p for p in all_posts if p['title'] not in existing_titles]
        print(f"  已有: {len(all_posts) - len(new_posts)} 条, 新增: {len(new_posts)} 条")
    else:
        new_posts = all_posts
        print(f"  试运行模式，全部视为新增")

    # 第3步：抓取详情页
    print(f"\n[3/4] 抓取 {len(new_posts)} 条详情页...")
    detailed_posts = []
    for i, post in enumerate(new_posts):
        print(f"  [{i+1}/{len(new_posts)}] {post['title'][:50]}...")
        detail = fetch_detail(post)
        if detail:
            detailed_posts.append(detail)
            print(f"    分类: {detail['category_name']}, "
                  f"报名入口: {detail.get('link', '无')[:60]}")
        time.sleep(1.5)  # 礼貌延迟，避免被反爬

    # 第4步：导入
    print(f"\n[4/4] 导入 {len(detailed_posts)} 条到安徽招考网...")
    if not detailed_posts:
        print("[!] 没有有效的公告数据")
        return

    if dry_run:
        print("\n--- 试运行结果 ---")
        for p in detailed_posts:
            print(f"  [{p['category_name']}] {p['title']}")
            print(f"    日期: {p.get('date', 'N/A')}")
            print(f"    报名入口: {p.get('link', '无')}")
            print()
        print(f"试运行完成，共计 {len(detailed_posts)} 条")
    else:
        count = import_to_anhuizhaokao(detailed_posts)
        print(f"\n导入完成: {count} 条")


if __name__ == '__main__':
    main()

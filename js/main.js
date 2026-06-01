/* ============================================
   安徽招考网 - JavaScript Interactions (API版)
   ============================================ */

(function () {
  'use strict';

  // ---- API 基础配置 ----
  const API_BASE = '/api';

  async function api(path, options) {
    options = options || {};
    const token = localStorage.getItem('ahzk_token');
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
      const resp = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
      return await resp.json();
    } catch (e) {
      console.error('API请求失败:', path, e);
      return { success: false, message: '网络请求失败' };
    }
  }

  // ---- Data Store ----
  const CATEGORIES = [
    { key: 'gwy',   name: '公务员',   count: 0, icon: '🏛️' },
    { key: 'sydw',  name: '事业单位', count: 0, icon: '🏢' },
    { key: 'js',    name: '教师招聘', count: 0, icon: '📚' },
    { key: 'gq',    name: '国企招聘', count: 0, icon: '🏭' },
    { key: 'ylws',  name: '医疗卫生', count: 0, icon: '🏥' },
    { key: 'szyf',  name: '三支一扶', count: 0, icon: '🌱' },
    { key: 'bw',    name: '编外',     count: 0, icon: '📋' },
  ];

  const CAT_MAP = {};
  CATEGORIES.forEach(function(c) { CAT_MAP[c.key] = c.name; });

  const TAG_CLASS = {
    gwy: 'tag-gwy', sydw: 'tag-sydw', js: 'tag-js',
    gq: 'tag-gq', ylws: 'tag-ylws', szyf: 'tag-szyf', bw: 'tag-bw',
  };

  const DOT_CLASS = {
    gwy: 'dot-gwy', sydw: 'dot-sydw', js: 'dot-js',
    gq: 'dot-gq', ylws: 'dot-ylws', szyf: 'dot-szyf', bw: 'dot-bw',
  };

  const CITY_MAP = {
    hf:'合肥', wh:'芜湖', bb:'蚌埠', hn:'淮南', mas:'马鞍山', hb:'淮北',
    tl:'铜陵', aq:'安庆', hs:'黄山', cz:'滁州', fy:'阜阳', sz:'宿州',
    la:'六安', bz:'亳州', chiz:'池州', xc:'宣城'
  };

  // ---- State ----
  let state = {
    currentPage: 1,
    perPage: 10,
    currentCategory: 'all',
    currentRecruitmentType: 'all',
    searchQuery: '',
    sortBy: 'latest',
    totalItems: 0,
    cachedPosts: [],
    favoritesSet: new Set(),
    isHomepage: false,
    currentCity: 'all',
  };

  // 展开/收起状态跟踪
  const expandedPosts = {};

  // ---- Utility: Get URL Params ----
  function getParams() {
    var p = new URLSearchParams(window.location.search);
    return {
      page: parseInt(p.get('page')) || 1,
      cat: p.get('cat') || 'all',
      recruitmentType: p.get('recruitmentType') || 'all',
      city: p.get('city') || 'all',
      q: p.get('q') || '',
      sort: p.get('sort') || 'latest',
    };
  }

  function buildURL(params) {
    var p = new URLSearchParams();
    if (params.page && params.page > 1) p.set('page', params.page);
    if (params.cat && params.cat !== 'all') p.set('cat', params.cat);
    if (params.recruitmentType && params.recruitmentType !== 'all') p.set('recruitmentType', params.recruitmentType);
    if (params.city && params.city !== 'all') p.set('city', params.city);
    if (params.q) p.set('q', params.q);
    if (params.sort && params.sort !== 'latest') p.set('sort', params.sort);
    var qs = p.toString();
    return qs ? '?' + qs : window.location.pathname;
  }

  // ---- Filter Data (from API cache) ----
  function getFilteredData() {
    var data = state.cachedPosts;

    if (state.currentCategory !== 'all') {
      data = data.filter(function(item) { return item.category === state.currentCategory; });
    }

    if (state.currentRecruitmentType !== 'all') {
      // 筛选校招时也包含 both；筛选社招同理
      data = data.filter(function(item) {
        return item.recruitmentType === state.currentRecruitmentType || item.recruitmentType === 'both';
      });
    }

    if (state.searchQuery.trim()) {
      var q = state.searchQuery.trim().toLowerCase();
      data = data.filter(function(item) {
        return (item.title || '').toLowerCase().indexOf(q) !== -1 ||
          (item.category_name || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    // 城市筛选
    if (state.currentCity !== 'all') {
      data = data.filter(function(item) {
        return item.city === state.currentCity;
      });
    }

    // 首页仅展示 48 小时内的公告（搜索时放宽为全部）
    if (state.isHomepage && !state.searchQuery.trim()) {
      var now = Date.now();
      var fortyEightHours = 48 * 60 * 60 * 1000;
      data = data.filter(function(item) {
        return item.timestamp && (now - item.timestamp) <= fortyEightHours;
      });
    }

    state.totalItems = data.length;
    var start = (state.currentPage - 1) * state.perPage;
    return data.slice(start, start + state.perPage);
  }

  // ---- 从API加载公告列表 ----
  async function loadAllPosts() {
    var result = await api('/posts?perPage=10000');
    if (result.success) {
      state.cachedPosts = result.data.map(function(post) {
        return {
          id: post.id,
          title: post.title,
          category: post.category,
          categoryName: post.category_name,
          date: post.date,
          content: post.content,
          link: post.link,
          views: post.views,
          timestamp: new Date(post.created_at).getTime(),
          source: post.source,
          isTop: !!post.is_top,
          topOrder: post.top_order,
          recruitmentType: post.recruitment_type || 'none',
          city: post.city || null,
        };
      });
    } else {
      state.cachedPosts = [];
    }
    return state.cachedPosts;
  }

  // ---- 加载收藏列表 ----
  async function loadFavorites() {
    var session = getSession();
    if (!session) { state.favoritesSet = new Set(); return; }

    var result = await api('/favorites');
    if (result.success) {
      state.favoritesSet = new Set(result.data.map(function(f) { return f.id; }));
    } else {
      state.favoritesSet = new Set();
    }
  }

  // ---- 获取session ----
  function getSession() {
    try { return JSON.parse(localStorage.getItem('ahzk_session')); } catch(e) { return null; }
  }

  // ---- 获取公告详情（单个） ----
  async function loadPostById(id) {
    var result = await api('/posts/' + id);
    if (result.success) {
      var post = result.data;
      return {
        id: post.id,
        title: post.title,
        category: post.category,
        categoryName: post.category_name,
        date: post.date,
        content: post.content,
        link: post.link,
        views: post.views,
        timestamp: new Date(post.created_at).getTime(),
        source: post.source,
        isTop: !!post.is_top,
        topOrder: post.top_order,
        recruitmentType: post.recruitment_type || 'none',
      };
    }
    return null;
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    var now = Date.now();
    var diff = now - timestamp;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return minutes + '分钟前';
    if (hours < 24) return hours + '小时前';
    if (days === 1) return '昨天';
    if (days === 2) return '前天';
    if (days < 30) return days + '天前';
    if (days < 365) return Math.floor(days / 30) + '个月前';
    return Math.floor(days / 365) + '年前';
  }

  // ---- 加载校招和社招公告数量 ----
  async function loadRecruitmentCounts() {
    try {
      const result = await api('/posts/recruitment-counts');
      if (result.success) {
        const xiaozhaoEl = document.getElementById('xiaozhao-count');
        const shezhaoEl = document.getElementById('shezhao-count');
        
        if (xiaozhaoEl) {
          xiaozhaoEl.textContent = result.data.xiaozhao + '+';
        }
        if (shezhaoEl) {
          shezhaoEl.textContent = result.data.shezhao + '+';
        }
      }
    } catch (e) {
      console.error('加载招聘类型数量失败:', e);
    }
  }

  // ---- Hero Background ----
  var HERO_BG_PRESETS = {
    'default':   { css: 'linear-gradient(180deg, #E0F0FF 0%, #C8E0FA 100%)', dark: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)' },
    'solid-blue':{ css: '#EBF8FF', dark: '#1E3A5F' },
    'solid-green':{ css: '#F0FFF4', dark: '#1B4332' },
    'solid-purple':{ css: '#FAF5FF', dark: '#322659' },
    'solid-amber':{ css: '#FFFBEB', dark: '#4A3F1D' },
    'gradient-indigo':{ css: 'linear-gradient(180deg, #E0E7FF 0%, #C7D2FE 100%)', dark: 'linear-gradient(180deg, #312E81 0%, #1E1B4B 100%)' },
    'gradient-emerald':{ css: 'linear-gradient(180deg, #D1FAE5 0%, #A7F3D0 100%)', dark: 'linear-gradient(180deg, #064E3B 0%, #022C22 100%)' },
    'gradient-rose':{ css: 'linear-gradient(180deg, #FCE7F3 0%, #F9A8D4 100%)', dark: 'linear-gradient(180deg, #4C1D3D 0%, #2D0A22 100%)' },
  };

  async function loadHeroBackground() {
    try {
      var result = await api('/site-config/hero');
      if (result.success) {
        var bgId = result.data.background || 'default';
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var hero = document.querySelector('.hero');
        if (hero) {
          if (bgId && bgId.startsWith('/uploads/')) {
            // 自定义图片
            hero.style.background = 'url(' + bgId + ') center/cover no-repeat';
            hero.style.backgroundAttachment = 'fixed';
            hero.setAttribute('data-hero-bg', 'custom');
          } else {
            var preset = HERO_BG_PRESETS[bgId] || HERO_BG_PRESETS['default'];
            var css = isDark && preset.dark ? preset.dark : preset.css;
            hero.style.background = css;
            hero.style.backgroundAttachment = 'scroll';
            hero.setAttribute('data-hero-bg', bgId);
          }
        }
      }
    } catch (e) {
      console.error('加载Hero背景失败:', e);
    }
  }

  window.AHZK = window.AHZK || {};
  window.AHZK.loadRecruitmentCounts = loadRecruitmentCounts;

  // ---- Donation Drawer ----
  function initDonateDrawer() {
    var trigger = document.getElementById('donate-trigger');
    var drawer = document.getElementById('donate-drawer');
    if (!trigger || !drawer) return;

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      drawer.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (drawer.classList.contains('open') && !drawer.contains(e.target)) {
        drawer.classList.remove('open');
      }
    });
  }

  async function loadDonationImages() {
    try {
      var result = await api('/site-config/donation');
      if (result.success) {
        var drawer = document.getElementById('donate-drawer');
        // 根据开关状态显示/隐藏整个打赏模块
        if (result.data.enabled === false) {
          if (drawer) drawer.style.display = 'none';
          return;
        }
        if (drawer) drawer.style.display = '';
        if (result.data.image_1) {
          var box1 = document.getElementById('donate-img-1');
          if (box1) box1.innerHTML = '<img src="' + result.data.image_1 + '" alt="收款码">';
        }
        if (result.data.image_2) {
          var box2 = document.getElementById('donate-img-2');
          if (box2) box2.innerHTML = '<img src="' + result.data.image_2 + '" alt="收款码">';
        }
      }
    } catch (e) {
      console.error('加载打赏图片失败:', e);
    }
  }

  window.AHZK.loadDonationImages = loadDonationImages;

  // ---- City Tag Delegation（事件委托，替代内联 onclick，更可靠） ----
  function initCityTagDelegation() {
    document.addEventListener('click', function(e) {
      var tag = e.target.closest('.city-tag');
      if (!tag) return;
      var city = tag.dataset.city;
      if (!city) return;
      e.preventDefault();
      window.AHZK.setCity(city);
    });
  }

  // ---- Recruitment Type Functions ----
  function loadPostsByRecruitmentType(type, limit) {
    return state.cachedPosts
      .filter(function(p) { return p.recruitmentType === type || p.recruitmentType === 'both'; })
      .sort(function(a, b) {
        var topA = a.isTop ? 1 : 0;
        var topB = b.isTop ? 1 : 0;
        if (topB !== topA) return topB - topA;
        return (b.timestamp || 0) - (a.timestamp || 0);
      })
      .slice(0, limit || 5);
  }

  function renderRecruitmentColumns() {
    var xiaozhaoList = document.getElementById('xiaozhao-list');
    var shezhaoList = document.getElementById('shezhao-list');

    if (xiaozhaoList) {
      var xiaozhaoPosts = loadPostsByRecruitmentType('xiaozhao', 5);
      if (xiaozhaoPosts.length > 0) {
        xiaozhaoList.innerHTML = xiaozhaoPosts.map(function(item) { return renderRecruitmentCard(item); }).join('');
      } else {
        xiaozhaoList.innerHTML = '<div class="recruitment-empty">暂无校招公告</div>';
      }
    }

    if (shezhaoList) {
      var shezhaoPosts = loadPostsByRecruitmentType('shezhao', 5);
      if (shezhaoPosts.length > 0) {
        shezhaoList.innerHTML = shezhaoPosts.map(function(item) { return renderRecruitmentCard(item); }).join('');
      } else {
        shezhaoList.innerHTML = '<div class="recruitment-empty">暂无社招公告</div>';
      }
    }
  }

  function renderRecruitmentCard(item) {
    var isExpanded = !!expandedPosts[item.id];
    var html = '';
    html += '<div class="recruitment-card" data-id="' + item.id + '">';
    html += '  <div class="recruitment-card__header" onclick="window.toggleRecruitmentCard(' + item.id + ')">';
    html += '    <span class="recruitment-card__title">' + escapeHtml(item.title) + '</span>';
    html += '    <span class="recruitment-card__toggle">' + (isExpanded ? '收起 ▲' : '展开 ▼') + '</span>';
    html += '  </div>';
    html += '  <div class="recruitment-card__meta">';
    html += '    <span style="display:inline-flex;align-items:center;gap:4px;"><span class="announcement-card__tag ' + (TAG_CLASS[item.category] || '') + '">' + escapeHtml(item.categoryName) + '</span>' + (item.city ? '<span class="announcement-card__city-tag">' + (CITY_MAP[item.city] || item.city) + '</span>' : '') + '</span>';
    html += '    <span>' + escapeHtml(item.date) + '</span>';
    html += '  </div>';
    html += '  <div class="recruitment-card__content' + (isExpanded ? ' expanded' : '') + '" id="recruitment-content-' + item.id + '">';
    if (isExpanded) {
      if (item.content) {
        html += item.content;
      } else {
        html += '<p>暂无详细内容，<a href="detail.html?id=' + item.id + '">点击查看完整公告 →</a></p>';
      }
    }
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderRecruitmentContent(item) {
    if (item.source === 'admin' && item.content) {
      return item.content;
    } else if (item.content) {
      return item.content;
    } else {
      return '<p>暂无详细内容，<a href="detail.html?id=' + item.id + '">点击查看完整公告 →</a></p>';
    }
  }

  // 展开/收起招聘卡片 - 全局函数
  window.toggleRecruitmentCard = function(id) {
    var contentEl = document.getElementById('recruitment-content-' + id);
    if (!contentEl) return;

    if (expandedPosts[id]) {
      // 收起
      expandedPosts[id] = false;
      contentEl.classList.remove('expanded');
    } else {
      // 展开
      expandedPosts[id] = true;
      contentEl.classList.add('expanded');
      
      // 如果内容为空，加载内容
      if (!contentEl.innerHTML || contentEl.innerHTML.trim() === '') {
        var item = null;
        for (var i = 0; i < state.cachedPosts.length; i++) {
          if (state.cachedPosts[i].id === id) {
            item = state.cachedPosts[i];
            break;
          }
        }
        if (item) {
          contentEl.innerHTML = renderRecruitmentContent(item);
        }
      }
    }

    // 更新toggle按钮文本
    var card = contentEl.closest('.recruitment-card');
    if (card) {
      var toggleSpan = card.querySelector('.recruitment-card__toggle');
      if (toggleSpan) {
        toggleSpan.innerHTML = (expandedPosts[id] ? '收起 ▲' : '展开 ▼');
      }
    }
  };

  // ---- 暴露公共API ----
  window.AHZK = window.AHZK || {};
  window.AHZK.toggleRecruitmentCard = window.toggleRecruitmentCard;
  window.AHZK.formatTimeAgo = formatTimeAgo;
  window.AHZK.loadPostsByRecruitmentType = loadPostsByRecruitmentType;
  window.AHZK.renderRecruitmentColumns = renderRecruitmentColumns;

  // ---- Favorites Logic ----
  function getFavorites() {
    return Array.from(state.favoritesSet);
  }

  async function toggleFavorite(itemId, btnEl) {
    var session = getSession();
    if (!session) {
      window.location.href = 'auth.html';
      return;
    }

    var result = await api('/favorites/' + itemId, { method: 'POST' });
    if (result.success) {
      if (result.data.favorited) {
        state.favoritesSet.add(itemId);
        if (btnEl) {
          btnEl.classList.add('active');
          btnEl.textContent = '★';
          btnEl.title = '取消收藏';
        }
      } else {
        state.favoritesSet.delete(itemId);
        if (btnEl) {
          btnEl.classList.remove('active');
          btnEl.textContent = '☆';
          btnEl.title = '收藏';
        }
      }
    }
  }

  window.AHZK.toggleFavorite = toggleFavorite;
  window.AHZK.getFavorites = getFavorites;

  // ---- Render Announcement Card ----
  function renderCard(item, compact) {
    var timeStr = formatTimeAgo(item.timestamp) || item.date;
    var isFav = state.favoritesSet.has(item.id);
    var favClass = isFav ? 'active' : '';
    var favSymbol = isFav ? '★' : '☆';
    var topBadge = item.isTop ? '<span class="card-top-badge">置顶</span>' : '';
    var linkHtml = item.link ? '<a href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener" class="card-link-btn" onclick="event.stopPropagation();" title="直达报名入口"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:middle;margin-right:2px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> 报名入口</a>' : '';

    if (compact) {
      // 首页风格与全部公告一致
      var html = '';
      html += '<div class="announcement-card announcement-card--full' + (item.isTop ? ' announcement-card--top' : '') + '" style="text-decoration:none;color:inherit;">';
      html += '  <div class="announcement-card__cat-dot ' + (DOT_CLASS[item.category] || '') + '"></div>';
      html += '  <div style="flex:1;min-width:0;">';
      html += '    <a href="detail.html?id=' + item.id + '" style="text-decoration:none;color:inherit;">';
      html += '      <h3 class="announcement-card__title">' + topBadge + escapeHtml(item.title) + '</h3>';
      html += '    </a>';
      html += '    <div class="announcement-card__meta">';
      html += '      <span style="display:inline-flex;align-items:center;gap:4px;"><span class="announcement-card__tag ' + (TAG_CLASS[item.category] || '') + '">' + escapeHtml(item.categoryName) + '</span>' + (item.city ? '<span class="announcement-card__city-tag">' + (CITY_MAP[item.city] || item.city) + '</span>' : '') + '</span>';
      html += '      <span class="announcement-card__meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + timeStr + '</span>';
      html += '      <span class="announcement-card__meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12C5 4 19 4 23 12C19 20 5 20 1 12z"/><circle cx="12" cy="12" r="3"/></svg> ' + (item.views || 0).toLocaleString() + '</span>';
      html += '    </div>';
      html += '  </div>';
      html += '  <button class="fav-star-btn ' + favClass + '" onclick="window.AHZK.toggleFavorite(' + item.id + ',this);event.stopPropagation();" title="' + (isFav ? '取消收藏' : '收藏') + '">' + favSymbol + '</button>';
      html += '</div>';
      return html;
    }

    var html = '';
    html += '<div class="announcement-card announcement-card--full' + (item.isTop ? ' announcement-card--top' : '') + '" style="text-decoration:none;color:inherit;">';
    html += '  <div class="announcement-card__cat-dot ' + (DOT_CLASS[item.category] || '') + '"></div>';
    html += '  <div style="flex:1;min-width:0;">';
    html += '    <a href="detail.html?id=' + item.id + '" style="text-decoration:none;color:inherit;">';
    html += '      <h3 class="announcement-card__title">' + topBadge + escapeHtml(item.title) + '</h3>';
    html += '    </a>';
    html += '    <div class="announcement-card__meta">';
    html += '      <span style="display:inline-flex;align-items:center;gap:4px;"><span class="announcement-card__tag ' + (TAG_CLASS[item.category] || '') + '">' + escapeHtml(item.categoryName) + '</span>' + (item.city ? '<span class="announcement-card__city-tag">' + (CITY_MAP[item.city] || item.city) + '</span>' : '') + '</span>';
    html += '      <span class="announcement-card__meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ' + escapeHtml(item.date) + '</span>';
    html += '      <span class="announcement-card__meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12C5 4 19 4 23 12C19 20 5 20 1 12z"/><circle cx="12" cy="12" r="3"/></svg> ' + (item.views || 0).toLocaleString() + '</span>';
    html += '      ' + linkHtml;
    html += '    </div>';
    html += '  </div>';
    html += '  <button class="fav-star-btn ' + favClass + '" onclick="window.AHZK.toggleFavorite(' + item.id + ',this);event.stopPropagation();" title="' + (isFav ? '取消收藏' : '收藏') + '">' + favSymbol + '</button>';
    html += '</div>';
    return html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Render List ----
  function renderList(compact) {
    var listEl = document.getElementById('announcement-list');
    if (!listEl) return;

    // 隐藏骨架屏
    var skeleton = document.getElementById('skeleton-list');
    if (skeleton) skeleton.classList.remove('active');

    var items = getFilteredData();

    if (items.length === 0) {
      var emptyTitle = state.isHomepage ? '暂无最新公告' : '未找到相关公告';
      var emptyDesc = state.isHomepage ? '近48小时内暂无新发布的招考公告，请查看全部公告' : '请尝试更换关键词或查看其他分类';
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h3 class="empty-state__title">' + emptyTitle + '</h3><p class="empty-state__desc">' + emptyDesc + '</p>' + (state.isHomepage ? '<a href="list.html" class="section-header__btn" style="display:inline-flex;margin-top:var(--space-4);">查看全部公告 →</a>' : '<div class="hot-keywords" style="justify-content:center;">' + ['公务员', '事业单位', '教师', '合肥'].map(function(k) { return '<span class="hot-keyword-tag" onclick="window.AHZK.search(\'' + k + '\')">' + k + '</span>'; }).join('') + '</div>') + '</div>';
      renderPagination();
      updateCount();
      return;
    }

    listEl.innerHTML = items.map(function(item) { return renderCard(item, compact); }).join('');
    renderPagination();
    updateCount();
  }

  function updateCount() {
    var countEl = document.getElementById('result-count');
    if (countEl) {
      countEl.textContent = '共 ' + state.totalItems + ' 条结果';
    }
  }

  // ---- Render Pagination ----
  function renderPagination() {
    var pagEl = document.getElementById('pagination');
    if (!pagEl) return;

    var totalPages = Math.ceil(state.totalItems / state.perPage);
    if (totalPages <= 1) {
      pagEl.innerHTML = '';
      return;
    }

    var html = '';
    html += '<button class="pagination__btn" ' + (state.currentPage <= 1 ? 'disabled' : '') + ' onclick="window.AHZK.goPage(' + (state.currentPage - 1) + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>';

    var pages = getPaginationRange(state.currentPage, totalPages);
    pages.forEach(function(p) {
      if (p === '...') {
        html += '<span class="pagination__ellipsis">...</span>';
      } else {
        html += '<button class="pagination__btn ' + (p === state.currentPage ? 'active' : '') + '" onclick="window.AHZK.goPage(' + p + ')">' + p + '</button>';
      }
    });

    html += '<button class="pagination__btn" ' + (state.currentPage >= totalPages ? 'disabled' : '') + ' onclick="window.AHZK.goPage(' + (state.currentPage + 1) + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';

    pagEl.innerHTML = html;
  }

  function getPaginationRange(current, total) {
    if (total <= 7) return Array.from({length: total}, function(_, i) { return i + 1; });
    var pages = [];
    if (current <= 3) {
      pages.push(1, 2, 3, 4, '...', total);
    } else if (current >= total - 2) {
      pages.push(1, '...', total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, '...', current - 1, current, current + 1, '...', total);
    }
    return pages;
  }

  // ---- Public API ----
  window.AHZK = window.AHZK || {};
  window.AHZK.CAT_MAP = CAT_MAP;
  window.AHZK.TAG_CLASS = TAG_CLASS;
  window.AHZK.DOT_CLASS = DOT_CLASS;
  window.AHZK.CATEGORIES = CATEGORIES;

  window.AHZK.goPage = function(page) {
    state.currentPage = page;
    window.history.pushState(null, '', buildURL({ page: page, cat: state.currentCategory, q: state.searchQuery, sort: state.sortBy }));
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.AHZK.setCategory = function(cat) {
    state.currentCategory = cat;
    state.currentPage = 1;
    var selectEl = document.getElementById('filter-cat');
    if (selectEl) selectEl.value = cat;
    window.history.pushState(null, '', buildURL({ page: 1, cat: cat, recruitmentType: state.currentRecruitmentType, city: state.currentCity, q: state.searchQuery, sort: state.sortBy }));
    renderList();
  };

  window.AHZK.setSort = function(sort) {
    state.sortBy = sort;
    state.currentPage = 1;
    document.querySelectorAll('.sort-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.sort === sort);
    });
    window.history.pushState(null, '', buildURL({ page: 1, cat: state.currentCategory, recruitmentType: state.currentRecruitmentType, city: state.currentCity, q: state.searchQuery, sort: sort }));
    renderList();
  };

  window.AHZK.handleFilterRecruitment = function(e) {
    state.currentRecruitmentType = e.target.value;
    state.currentPage = 1;
    var selectEl = document.getElementById('filter-recruitment');
    if (selectEl) selectEl.value = state.currentRecruitmentType;
    window.history.pushState(null, '', buildURL({ page: 1, cat: state.currentCategory, recruitmentType: state.currentRecruitmentType, city: state.currentCity, q: state.searchQuery, sort: state.sortBy }));
    renderList();
  };

  window.AHZK.setCity = function(city) {
    state.currentCity = city;
    state.currentPage = 1;
    // 更新标签激活状态
    document.querySelectorAll('.city-tag').forEach(function(tag) {
      tag.classList.toggle('active', tag.dataset.city === city);
    });
    window.history.pushState(null, '', buildURL({ page: 1, cat: state.currentCategory, recruitmentType: state.currentRecruitmentType, city: state.currentCity, q: state.searchQuery, sort: state.sortBy }));
    renderList();
  };

  window.AHZK.search = function(query) {
    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = query;

    // 跳转到 list.html 显示搜索结果
    if (!document.getElementById('announcement-list')) {
      window.location.href = 'list.html?q=' + encodeURIComponent(query);
      return;
    }

    // list.html 页面直接渲染
    state.searchQuery = query;
    state.currentPage = 1;
    window.history.pushState(null, '', buildURL({ page: 1, cat: state.currentCategory, q: query, sort: state.sortBy }));
    renderList();
  };

  window.AHZK.handleSearch = function(e) {
    if (e) e.preventDefault();
    var input = document.getElementById('search-input');
    var query = input ? input.value.trim() : '';
    var catSel = document.getElementById('search-cat');
    var cat = catSel ? catSel.value : 'all';

    var btn = document.getElementById('search-btn');
    if (btn) {
      btn.classList.add('loading');
      setTimeout(function() { btn.classList.remove('loading'); }, 600);
    }

    // 首页跳转到 list.html 显示搜索结果；list.html 本地渲染
    var isHomepage = !document.getElementById('pagination') && !document.getElementById('filter-cat');
    if (isHomepage) {
      var params = [];
      if (query) params.push('q=' + encodeURIComponent(query));
      if (cat && cat !== 'all') params.push('cat=' + encodeURIComponent(cat));
      var url = 'list.html' + (params.length ? '?' + params.join('&') : '');
      setTimeout(function() {
        window.location.href = url;
      }, 300);
      return;
    }

    setTimeout(function() {
      state.searchQuery = query;
      state.currentCategory = cat;
      state.currentPage = 1;
      window.history.pushState(null, '', buildURL({ page: 1, cat: cat, q: query, sort: state.sortBy }));
      var filterCat = document.getElementById('filter-cat');
      if (filterCat) filterCat.value = cat;
      renderList();
    }, 300);
  };

  window.AHZK.handleFilterCat = function(e) {
    state.currentCategory = e.target.value;
    state.currentPage = 1;
    window.history.pushState(null, '', buildURL({ page: 1, cat: state.currentCategory, recruitmentType: state.currentRecruitmentType, city: state.currentCity, q: state.searchQuery, sort: state.sortBy }));
    renderList();
  };

  // ---- Theme Toggle ----
  function initTheme() {
    var saved = localStorage.getItem('ahzk-theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var next = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ahzk-theme', next);
        // 切换主题时同步更新 Hero 背景
        loadHeroBackground();
      });
    });
  }

  // ---- Mobile Menu ----
  function initMobileMenu() {
    var openBtn = document.getElementById('mobile-menu-open');
    var closeBtn = document.getElementById('mobile-menu-close');
    var overlay = document.getElementById('mobile-nav-overlay');

    if (!openBtn || !overlay) return;

    function openMenu() {
      overlay.style.display = 'block';
      requestAnimationFrame(function() { overlay.classList.add('open'); });
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      overlay.classList.remove('open');
      setTimeout(function() {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      }, 400);
    }

    openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeMenu();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // ---- Detail Page ----
  async function initDetailPage() {
    var container = document.getElementById('detail-content');
    if (!container) return;

    var params = new URLSearchParams(window.location.search);
    var id = parseInt(params.get('id'));
    var item = await loadPostById(id);

    if (!item) {
      container.innerHTML = '<div class="empty-state"><h3 class="empty-state__title">公告不存在</h3><p class="empty-state__desc">该公告可能已被删除或链接无效</p></div>';
      return;
    }

    // Update header
    var titleEl = document.getElementById('detail-title');
    var tagEl = document.getElementById('detail-tag');
    var dateEl = document.getElementById('detail-date');
    var viewsEl = document.getElementById('detail-views');
    var breadcrumbCatEl = document.getElementById('breadcrumb-cat');
    var metaEl = document.querySelector('.detail-header__meta');

    if (titleEl) titleEl.textContent = item.title;
    if (tagEl) {
      tagEl.textContent = item.categoryName;
      tagEl.className = 'detail-header__tag ' + (TAG_CLASS[item.category] || '');
    }
    if (dateEl) dateEl.textContent = formatTimeAgo(item.timestamp) || item.date;
    if (viewsEl) viewsEl.textContent = (item.views || 0).toLocaleString() + ' 次浏览';
    if (breadcrumbCatEl) {
      breadcrumbCatEl.textContent = item.categoryName;
      breadcrumbCatEl.href = 'list.html?cat=' + item.category;
    }

    // Add direct link button to meta section
    if (metaEl && item.link) {
      var existingLink = metaEl.querySelector('.detail-link-btn');
      if (!existingLink) {
        var linkBtn = document.createElement('span');
        linkBtn.className = 'detail-header__meta-item detail-link-btn';
        linkBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> <a href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener" style="color:var(--color-accent);text-decoration:none;font-size:var(--font-size-sm);">报名入口</a>';
        metaEl.appendChild(linkBtn);
      }
    }

    // Generate content: 优先显示后台编辑的实际内容
    if (item.content) {
      container.innerHTML = item.content;
    } else {
      container.innerHTML = generateDetailContent(item);
    }

    // Add prominent link button above content if link exists
    if (item.link) {
      var linkBanner = document.createElement('div');
      linkBanner.className = 'detail-link-banner';
      linkBanner.innerHTML = '<a href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener" class="detail-link-banner__btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> 直达报名入口</a>';
      container.insertBefore(linkBanner, container.firstChild);
    }

    document.title = item.title + ' - 安徽招考网';

    // 更新 SEO 标签
    var ogTitle = document.getElementById('og-title');
    var ogDesc = document.getElementById('og-desc');
    var ogUrl = document.getElementById('og-url');
    var canonical = document.getElementById('canonical-url');
    var twitterTitle = document.getElementById('twitter-title');
    var twitterDesc = document.getElementById('twitter-desc');
    var pageUrl = window.location.origin + '/detail.html?id=' + item.id;
    var descContent = (item.title || '').substring(0, 120);
    if (ogTitle) ogTitle.setAttribute('content', item.title + ' - 安徽招考网');
    if (ogDesc) ogDesc.setAttribute('content', descContent);
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);
    if (canonical) canonical.setAttribute('href', pageUrl);
    if (twitterTitle) twitterTitle.setAttribute('content', item.title + ' - 安徽招考网');
    if (twitterDesc) twitterDesc.setAttribute('content', descContent);

    // 更新 meta description
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', descContent);

    // Related announcements
    renderRelated(item);
  }

  function generateDetailContent(item) {
    var catName = item.categoryName;
    var deadline = new Date(Date.now() + 15 * 86400000);
    var examDate = new Date(Date.now() + 45 * 86400000);

    function formatDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    return '<h2>一、招考概况</h2>'
      + '<p>为满足我省' + escapeHtml(catName) + '队伍建设的需要，根据国家和省有关招考（招聘）文件精神，现就' + escapeHtml(item.title) + '有关事项公告如下：</p>'
      + '<p>本次计划招录（招聘）工作人员 <strong>若干名</strong>，具体招考岗位及要求详见附件《岗位计划表》。</p>'
      + '<h2>二、报考条件</h2>'
      + '<h3>（一）基本条件</h3>'
      + '<ol><li>具有中华人民共和国国籍，拥护中华人民共和国宪法，拥护中国共产党领导和社会主义制度；</li>'
      + '<li>具有良好的政治素质和道德品行；</li>'
      + '<li>具有正常履行职责的身体条件和心理素质；</li>'
      + '<li>具有符合职位要求的工作能力；</li>'
      + '<li>具有大学本科及以上文化程度（部分岗位放宽至大专）；</li>'
      + '<li>年龄一般为18周岁以上、35周岁以下（' + new Date().getFullYear() + '年1月1日以后出生），应届毕业硕士研究生、博士研究生（非在职）年龄可放宽至40周岁以下；</li>'
      + '<li>具备拟任职位所要求的其他资格条件。</li></ol>'
      + '<h3>（二）不得报考的情形</h3>'
      + '<ul><li>因犯罪受过刑事处罚的人员；</li>'
      + '<li>被开除中国共产党党籍的人员；</li>'
      + '<li>被开除公职的人员；</li>'
      + '<li>被依法列为失信联合惩戒对象的人员；</li>'
      + '<li>在各级公务员招考中被认定有舞弊等严重违反录用纪律行为的人员；</li>'
      + '<li>现役军人、在读的非应届毕业生；</li>'
      + '<li>法律规定不得录用为公务员（事业单位工作人员）的其他情形人员。</li></ul>'
      + '<h2>三、报名方式与时间</h2>'
      + '<h3>（一）报名时间</h3>'
      + '<p><strong>' + formatDate(new Date()) + ' 至 ' + formatDate(deadline) + '</strong>（逾期不再补报）。</p>'
      + '<h3>（二）报名方式</h3>'
      + '<p>采用网上报名方式进行。报考人员登录安徽省人事考试网（www.apta.gov.cn），点击进入报名系统，按照要求填写个人信息、上传照片、选择报考岗位。</p>'
      + '<p>每位报考人员限报一个岗位，并须使用本人有效居民身份证进行报名和参加考试。</p>'
      + '<h3>（三）报名费用</h3>'
      + '<p>根据省物价局、省财政厅文件规定，笔试每人每科 <strong>45元</strong>，面试每人 <strong>70元</strong>。享受国家最低生活保障金城镇家庭和农村绝对贫困家庭的报考人员，可以享受减免笔试考试费用的政策。</p>'
      + '<h2>四、考试内容与时间</h2>'
      + '<h3>（一）笔试</h3>'
      + '<p>笔试时间：' + formatDate(examDate) + '</p>'
      + '<p>笔试科目：</p>'
      + '<table><thead><tr><th>科目</th><th>时间</th><th>满分</th></tr></thead>'
      + '<tbody><tr><td>职业能力倾向测验</td><td>上午 08:30-10:00</td><td>150分</td></tr>'
      + '<tr><td>综合应用能力</td><td>上午 10:00-12:00</td><td>150分</td></tr></tbody></table>'
      + '<p>笔试地点设在合肥市，具体地点见准考证。</p>'
      + '<h3>（二）面试</h3>'
      + '<p>根据笔试成绩从高分到低分按招录计划数1:3比例确定面试人选。面试采取结构化面试方式，主要考察应试者的综合素质、专业能力和岗位匹配度。</p>'
      + '<h2>五、体检与考察</h2>'
      + '<p>按考试总成绩从高分到低分等额确定体检、考察对象。体检标准参照公务员录用体检通用标准执行。考察内容主要包括政治思想、道德品质、能力素质、遵纪守法等方面情况。</p>'
      + '<h2>六、公示与录用</h2>'
      + '<p>对体检、考察合格的拟录用（聘用）人员，在相关网站进行公示，公示期为7个工作日。公示期满无异议的，按规定办理审批及录用（聘用）手续。</p>'
      + '<h2>七、注意事项</h2>'
      + '<ol><li>报考人员须对所提供的信息真实性负责，如有虚假，将取消报考及录用资格；</li>'
      + '<li>本次招考不指定考试辅导用书，不举办也不委托任何机构举办考试辅导培训班；</li>'
      + '<li>咨询电话：请参见岗位计划表中的联系电话；</li>'
      + '<li>公告未尽事宜，由招考单位负责解释。</li></ol>'
      + '<p style="margin-top:2rem;padding:1rem;background:var(--color-bg);border-radius:8px;color:var(--color-text-secondary);font-size:0.875rem;">'
      + '<strong>温馨提示：</strong>以上信息仅供参考，具体详情请以官方发布的正式公告为准。建议考生密切关注安徽省人事考试网（www.apta.gov.cn）获取最新招考动态。'
      + '</p>';
  }

  function renderRelated(item) {
    var container = document.getElementById('related-list');
    if (!container) return;

    var related = state.cachedPosts
      .filter(function(d) { return d.category === item.category && d.id !== item.id; })
      .slice(0, 5);

    if (related.length === 0) return;

    container.innerHTML = related.map(function(r) { return renderCard(r, false); }).join('');
  }

  // ---- Header Auth UI ----
  function initHeaderAuth() {
    var container = document.getElementById('header-auth-slot');
    if (!container) return;

    var token = localStorage.getItem('ahzk_token');
    if (token) {
      api('/auth/me').then(function(result) {
        if (result.success) {
          var session = result.user;
          localStorage.setItem('ahzk_session', JSON.stringify(session));
          renderHeaderUser(container, session);
        } else {
          localStorage.removeItem('ahzk_token');
          localStorage.removeItem('ahzk_session');
          renderHeaderLogin(container);
        }
      });
    } else {
      renderHeaderLogin(container);
    }
  }

  function renderHeaderUser(container, session) {
    var isAdmin = session.role === 'admin';
    container.innerHTML = '<div class="header-user-menu" id="header-user-menu">'
      + '  <button class="header-user-btn" id="header-user-btn" aria-haspopup="true">'
      + '    <span class="user-dot"></span>'
      + '    <span>' + escapeHtml(session.nickname || session.username) + '</span>'
      + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
      + '  </button>'
      + '  <div class="header-user-dropdown" id="header-user-dropdown">'
      + '    <div class="header-user-dropdown__name">👤 ' + escapeHtml(session.nickname || session.username) + '</div>'
      + '    <a href="favorites.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 我的收藏</a>'
      + (isAdmin ? '    <a href="admin.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> 管理后台</a>' : '')
      + '    <button onclick="window.AHZK.logout()" class="logout-item">'
      + '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
      + '      退出登录'
      + '    </button>'
      + '  </div>'
      + '</div>';

    var btn = document.getElementById('header-user-btn');
    var dropdown = document.getElementById('header-user-dropdown');
    if (btn && dropdown) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', function() { dropdown.classList.remove('open'); });
    }
  }

  // Initialize navigation dropdown
  function initNavDropdown() {
    var navToggle = document.querySelector('.nav-dropdown-toggle');
    var navMenu = document.querySelector('.nav-dropdown-menu');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = navMenu.classList.contains('open');
        if (isOpen) {
          navMenu.classList.remove('open');
          navToggle.setAttribute('aria-expanded', 'false');
        } else {
          navMenu.classList.add('open');
          navToggle.setAttribute('aria-expanded', 'true');
        }
      });
      document.addEventListener('click', function(e) {
        if (!navToggle.contains(e.target)) {
          navMenu.classList.remove('open');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  function renderHeaderLogin(container) {
    container.innerHTML = '<a href="auth.html" class="header-login-btn">'
      + '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>'
      + '  登录'
      + '</a>';
  }

  // ---- 微信扫码登录 ----
  var _wxPollTimer = null;
  window.AHZK.showWxLogin = async function() {
    // 动态创建弹窗
    var modal = document.getElementById('wx-login-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wx-login-modal';
      modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;';
      modal.innerHTML = '<div style="background:var(--color-surface,#fff);border-radius:12px;padding:24px;max-width:320px;width:90%;text-align:center;">' +
        '<h3 style="margin:0 0 16px;">微信扫码登录</h3>' +
        '<img id="wx-qr-img" src="" style="width:200px;height:200px;border:1px solid var(--color-border,#ddd);border-radius:8px;" alt="二维码">' +
        '<p style="font-size:13px;color:var(--color-text-muted,#718096);margin-top:12px;" id="wx-qr-msg">正在生成二维码...</p>' +
        '<button onclick="document.getElementById(\'wx-login-modal\').style.display=\'none\'" style="margin-top:12px;background:var(--color-bg,#EDF2F7);border:none;padding:8px 24px;border-radius:8px;cursor:pointer;">关闭</button></div>';
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.getElementById('wx-qr-msg').textContent = '正在生成二维码...';
    try {
      var genResp = await fetch('/api/auth/qrcode-login/generate');
      var gen = await genResp.json();
      if (!gen.success) { document.getElementById('wx-qr-msg').textContent = '生成失败'; return; }
      document.getElementById('wx-qr-img').src = '/api/auth/qrcode-login/qr?code=' + gen.code;
      document.getElementById('wx-qr-msg').textContent = '请使用微信扫描二维码';
      _wxPollTimer = setInterval(async function() {
        try {
          var checkResp = await fetch('/api/auth/qrcode-login/check?code=' + gen.code);
          var check = await checkResp.json();
          if (check.success) {
            clearInterval(_wxPollTimer);
            modal.style.display = 'none';
            localStorage.setItem('ahzk_token', check.token);
            localStorage.setItem('ahzk_session', JSON.stringify(check.user));
            location.reload();
          }
        } catch(e) {}
      }, 1500);
      setTimeout(function() { clearInterval(_wxPollTimer); }, 180000);
    } catch(e) {
      document.getElementById('wx-qr-msg').textContent = '网络错误';
    }
  };

  window.AHZK = window.AHZK || {};
  window.AHZK.logout = function() {
    localStorage.removeItem('ahzk_token');
    localStorage.removeItem('ahzk_session');
    window.location.href = 'auth.html';
  };

  // ---- Init ----
  async function init() {
    initTheme();
    initMobileMenu();
    initHeaderAuth();
    initNavDropdown();
    initCityTagDelegation();  // 事件委托：城市标签立即可点击
    initDonateDrawer();       // 打赏抽屉交互立即可用

    // 返回顶部按钮
    var backToTop = document.getElementById('back-to-top');
    if (backToTop) {
      window.addEventListener('scroll', function() {
        backToTop.classList.toggle('visible', window.scrollY > 400);
      }, { passive: true });
      backToTop.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 显示骨架屏（仅在首页）
    var skeleton = document.getElementById('skeleton-list');
    if (skeleton) skeleton.classList.add('active');

    // 加载数据（后台异步，不影响 UI 交互）
    try {
      await loadAllPosts();
      await loadFavorites();
    } catch (e) {
      console.error('数据加载失败:', e);
    }

    // 隐藏骨架屏
    if (skeleton) skeleton.classList.remove('active');

    // 加载 Hero 背景配置（首页）
    await loadHeroBackground();

    // 加载打赏图片
    await loadDonationImages();

    // 加载校招和社招公告数量（首页）
    await loadRecruitmentCounts();

    // 渲染招聘类型列（首页）
    renderRecruitmentColumns();

    // List page initialization
    if (document.getElementById('announcement-list')) {
      var params = getParams();
      state.currentPage = params.page;
      state.currentCategory = params.cat;
      state.currentRecruitmentType = params.recruitmentType;
      state.currentCity = params.city;
      state.searchQuery = params.q;
      state.sortBy = params.sort;

      var filterCat = document.getElementById('filter-cat');
      if (filterCat) filterCat.value = state.currentCategory;

      var filterRecruitment = document.getElementById('filter-recruitment');
      if (filterRecruitment) filterRecruitment.value = state.currentRecruitmentType;

      // 城市标签初始激活
      document.querySelectorAll('.city-tag').forEach(function(tag) {
        tag.classList.toggle('active', tag.dataset.city === state.currentCity);
      });

      document.querySelectorAll('.sort-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.sort === state.sortBy);
      });

      var searchInput = document.getElementById('search-input');
      if (searchInput && state.searchQuery) searchInput.value = state.searchQuery;

      // Check if we're on the homepage (no filters/pagination shown)
      var isHomepage = !document.getElementById('pagination') && !document.getElementById('filter-cat');
      state.isHomepage = isHomepage;
      if (isHomepage) {
        state.perPage = 50; // 首页展示48小时内全部公告
      }
      renderList(isHomepage);
    }

    // Detail page initialization
    initDetailPage();

    // Handle popstate
    window.addEventListener('popstate', function() {
      if (document.getElementById('announcement-list')) {
        var params = getParams();
        state.currentPage = params.page;
        state.currentCategory = params.cat;
        state.currentRecruitmentType = params.recruitmentType;
        state.currentCity = params.city;
        state.searchQuery = params.q;
        state.sortBy = params.sort;
        // 同步城市标签状态
        document.querySelectorAll('.city-tag').forEach(function(tag) {
          tag.classList.toggle('active', tag.dataset.city === state.currentCity);
        });
        renderList();
      }
    });

    // Search form submission
    document.querySelectorAll('.search-form').forEach(function(form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window.AHZK.handleSearch(e);
      });
    });

    // Category filter change
    var filterCatEl = document.getElementById('filter-cat');
    if (filterCatEl) {
      filterCatEl.addEventListener('change', window.AHZK.handleFilterCat);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

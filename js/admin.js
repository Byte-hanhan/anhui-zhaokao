  (function () {
    'use strict';

    // ---- API Helper ----
    const API_BASE = '/api';
    const SESSION_KEY = 'ahzk_session';

    function getToken() { return localStorage.getItem('ahzk_token'); }

    async function api(path, options = {}) {
      const token = getToken();
      const headers = { 'Content-Type': 'application/json; charset=utf-8', ...options.headers };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      try {
        const resp = await fetch(API_BASE + path, { ...options, headers });
        return await resp.json();
      } catch (e) {
        console.error('API请求失败:', path, e);
        return { success: false, message: '网络请求失败' };
      }
    }

    // ---- Auth Guard ----
    const session = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) { return null; } })();
    if (!session || session.role !== 'admin') {
      window.location.href = 'auth.html';
      return;
    }
    document.getElementById('admin-username-display').textContent = session.nickname || '管理员';

    // 验证 token 是否有效
    api('/auth/me').then(result => {
      if (!result.success) {
        localStorage.removeItem('ahzk_token');
        localStorage.removeItem(SESSION_KEY);
        window.location.href = 'auth.html';
      }
    });

    window.adminLogout = function () {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('ahzk_token');
      window.location.href = 'auth.html';
    };

    // ---- Data ----
    const CAT_MAP = { gwy:'公务员', sydw:'事业单位', js:'教师招聘', gq:'国企招聘', ylws:'医疗卫生', szyf:'三支一扶', bw:'编外' };
    const TAG_CLASS = { gwy:'tag-gwy', sydw:'tag-sydw', js:'tag-js', gq:'tag-gq', ylws:'tag-ylws', szyf:'tag-szyf', bw:'tag-bw' };
    const RECRUITMENT_MAP = { xiaozhao:'校招', shezhao:'社招', both:'校招+社招' };
    const RECRUITMENT_TAG = { xiaozhao:'tag-xiaozhao', shezhao:'tag-shezhao', both:'tag-both' };
    const CITY_MAP = { hf:'合肥', wh:'芜湖', bb:'蚌埠', hn:'淮南', mas:'马鞍山', hb:'淮北', tl:'铜陵', aq:'安庆', hs:'黄山', cz:'滁州', fy:'阜阳', sz:'宿州', la:'六安', bz:'亳州', chiz:'池州', xc:'宣城' };
    let cachedPosts = [];
    let cachedUsers = [];

    // ---- Toast ----
    function toast(msg, type = 'success') {
      const el = document.getElementById('admin-toast');
      const msgEl = document.getElementById('admin-toast-msg');
      msgEl.textContent = msg;
      el.className = 'admin-toast ' + type;
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => el.classList.remove('show'), 2800);
    }

    // ---- Panel Switcher ----
    window.showPanel = function (panelId) {
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('panel-' + panelId).classList.add('active');
      document.querySelectorAll('.admin-nav-item').forEach(b => {
        if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(panelId)) b.classList.add('active');
      });

      if (panelId === 'dashboard') renderDashboard();
      if (panelId === 'posts') { adminPostPage = 1; renderPostsTable(); }
      if (panelId === 'users') renderUsersTable();
    };

    // ---- Load posts from API ----
    async function loadPosts() {
      const result = await api('/posts?perPage=10000');
      if (result.success) {
        cachedPosts = result.data.map(p => ({
          id: p.id,
          title: p.title,
          category: p.category,
          categoryName: p.category_name,
          date: p.date,
          content: p.content,
          link: p.link,
          views: p.views,
          timestamp: new Date(p.created_at.replace(' ', 'T') + '+08:00').getTime(),
          source: p.source,
          isTop: !!p.is_top,
          topOrder: p.top_order,
          recruitmentType: p.recruitment_type || null,
          city: p.city || null,
        }));
      }
      return cachedPosts;
    }

    // ---- Load users from API ----
    async function loadUsers() {
      const result = await api('/users');
      if (result.success) {
        cachedUsers = result.data.map(u => ({
          id: u.id,
          username: u.username,
          nickname: u.nickname,
          role: u.role,
          created_at: u.created_at,
        }));
      }
      return cachedUsers;
    }

    // ---- Dashboard ----
    async function renderDashboard() {
      const posts = await loadPosts();
      const users = await loadUsers();

      const statsEl = document.getElementById('admin-stats');
      const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
      statsEl.innerHTML = [
        { label:'公告总数', value: posts.length, color:'#3182CE', icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
        { label:'注册用户', value: users.length, color:'#38A169', icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
        { label:'总浏览量', value: totalViews.toLocaleString(), color:'#805AD5', icon:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
        { label:'分类数量', value: 7, color:'#DD6B20', icon:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
      ].map(s => `
        <div class="admin-stat-card">
          <div class="admin-stat-card__icon" style="background:${s.color}1a;color:${s.color};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
          </div>
          <div class="admin-stat-card__body">
            <div class="admin-stat-card__label">${s.label}</div>
            <div class="admin-stat-card__value">${s.value}</div>
          </div>
        </div>
      `).join('');

      const recent = [...posts].sort((a, b) => {
        const topA = a.isTop ? 1 : 0;
        const topB = b.isTop ? 1 : 0;
        if (topB !== topA) return topB - topA;
        return (b.timestamp || 0) - (a.timestamp || 0);
      }).slice(0, 5);
      const recentEl = document.getElementById('recent-posts-list');
      if (recent.length === 0) {
        recentEl.innerHTML = '<div class="admin-empty"><p>暂无公告，点击"招考公告"页面新增</p></div>';
        return;
      }
      recentEl.innerHTML = recent.map(p => `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light);">
          <span class="announcement-card__tag ${TAG_CLASS[p.category]||''}" style="flex-shrink:0;">${CAT_MAP[p.category]||p.category}</span>
          <span style="flex:1;font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);color:var(--color-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(p.title)}</span>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);flex-shrink:0;">${p.date}</span>
        </div>
      `).join('');
    }

    // ---- Posts Table ----
    let adminPostPage = 1;
    const ADMIN_PER_PAGE = 10;

    window.renderPostsTable = async function () {
      await loadPosts();
      const q = (document.getElementById('admin-search-input')?.value || '').toLowerCase();
      const cat = document.getElementById('admin-cat-filter')?.value || 'all';
      let posts = [...cachedPosts];

      if (cat !== 'all') posts = posts.filter(p => p.category === cat);
      if (q) posts = posts.filter(p => p.title.toLowerCase().includes(q));
      posts.sort((a, b) => {
        const topA = a.isTop ? 1 : 0;
        const topB = b.isTop ? 1 : 0;
        if (topB !== topA) return topB - topA;
        if (topA && topB) {
          if ((b.topOrder || 0) !== (a.topOrder || 0)) return (b.topOrder || 0) - (a.topOrder || 0);
        }
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      const total = posts.length;
      const totalPages = Math.max(1, Math.ceil(total / ADMIN_PER_PAGE));
      if (adminPostPage > totalPages) adminPostPage = totalPages;

      const paged = posts.slice((adminPostPage - 1) * ADMIN_PER_PAGE, adminPostPage * ADMIN_PER_PAGE);
      const tbody = document.getElementById('posts-table-body');
      document.getElementById('posts-count-text').textContent = `共 ${total} 条公告`;

      if (paged.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>暂无公告，点击「新增公告」添加</p></div></td></tr>`;
        document.getElementById('posts-pagination-btns').innerHTML = '';
        return;
      }

      tbody.innerHTML = paged.map((p, i) => `
        <tr${p.isTop ? ' style="background:rgba(237,137,54,0.04);"' : ''}>
          <td style="color:var(--color-text-muted);font-size:var(--font-size-xs);">${p.isTop ? '<span style="color:#E08A2B;font-weight:bold;" title="置顶">📌</span>' : ''}${(adminPostPage - 1) * ADMIN_PER_PAGE + i + 1}</td>
          <td><div class="admin-table__title" title="${escHtml(p.title)}">${p.isTop ? '<span style="color:#E08A2B;font-size:11px;font-weight:var(--font-weight-bold);margin-right:4px;">[置顶]</span>' : ''}${escHtml(p.title)}</div></td>
          <td><span class="announcement-card__tag ${TAG_CLASS[p.category]||''}">${CAT_MAP[p.category]||p.category}</span></td>
          <td><span class="announcement-card__tag ${RECRUITMENT_TAG[p.recruitmentType]||''}" style="font-size:11px;padding:2px 6px;border-radius:3px;${p.recruitmentType?'':'color:var(--color-text-muted);'}}">${RECRUITMENT_MAP[p.recruitmentType]||'-'}</span></td>
          <td style="color:var(--color-text-secondary);">${p.date}</td>
          <td style="color:var(--color-text-muted);">${(p.views||0).toLocaleString()}</td>
          <td>
            <div class="admin-table__actions">
              <button class="admin-btn admin-btn--sm ${p.isTop ? 'admin-btn--warning' : ''}" onclick="toggleTop(${p.id})" title="${p.isTop ? '取消置顶' : '置顶'}" style="${p.isTop ? 'color:#E08A2B;border-color:#E08A2B;background:rgba(237,137,54,0.08);' : 'color:var(--color-text-muted);border-color:var(--color-border);background:var(--color-surface);'}">
                ${p.isTop ? '✓置顶' : '置顶'}
              </button>
              <button class="admin-btn admin-btn--secondary admin-btn--sm" onclick="openPostModal(${p.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                编辑
              </button>
              <button class="admin-btn admin-btn--danger admin-btn--sm" onclick="confirmDelete(${p.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      const pagEl = document.getElementById('posts-pagination-btns');
      if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
      let pHtml = `<button class="pagination__btn" ${adminPostPage<=1?'disabled':''} onclick="goAdminPage(${adminPostPage-1})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>`;
      for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - adminPostPage) > 1) { if (i === 3 || i === totalPages-2) pHtml += `<span class="pagination__ellipsis">...</span>`; continue; }
        pHtml += `<button class="pagination__btn ${i===adminPostPage?'active':''}" onclick="goAdminPage(${i})">${i}</button>`;
      }
      pHtml += `<button class="pagination__btn" ${adminPostPage>=totalPages?'disabled':''} onclick="goAdminPage(${adminPostPage+1})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>`;
      pagEl.innerHTML = pHtml;
    };

    window.goAdminPage = function (p) { adminPostPage = p; renderPostsTable(); };

    // ---- Quill Editor ----
    let quillEditor = null;

    function initQuillEditor() {
      if (!quillEditor) {
        quillEditor = new Quill('#post-content-editor', {
          theme: 'snow',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              [{ 'header': [1, 2, 3, false] }],
              ['link'],
              ['clean']
            ]
          }
        });

        // 同步编辑器内容到隐藏textarea
        quillEditor.on('text-change', function() {
          const htmlContent = quillEditor.root.innerHTML;
          document.getElementById('post-content').value = htmlContent;
        });
      }
    }

    function setQuillEditorContent(content) {
      if (quillEditor) {
        quillEditor.root.innerHTML = content || '';
        document.getElementById('post-content').value = content || '';
      }
    }

    function resetQuillEditor() {
      if (quillEditor) {
        quillEditor.root.innerHTML = '';
        document.getElementById('post-content').value = '';
      }
    }

    // ---- Post Modal ----
    window.openPostModal = async function (id) {
      const modal = document.getElementById('post-modal-overlay');
      document.getElementById('post-modal-title').textContent = id ? '编辑公告' : '新增公告';
      document.getElementById('post-id').value = id || '';

      // 初始化Quill编辑器
      initQuillEditor();

      if (id) {
        // 通过详情接口获取完整数据（含 content 字段）
        const detailResult = await api('/posts/' + id);
        if (detailResult.success && detailResult.data) {
          const post = detailResult.data;
          document.getElementById('post-title').value = post.title;
          document.getElementById('post-cat').value = post.category;
          document.getElementById('post-date').value = post.date;
          setQuillEditorContent(post.content || '');
          document.getElementById('post-link').value = post.link || '';
          document.getElementById('post-recruitment-type').value = post.recruitment_type || '';
          document.getElementById('post-city').value = post.city || '';
        }
      } else {
        document.getElementById('post-modal-form').reset();
        resetQuillEditor();
        document.getElementById('post-link').value = '';
        document.getElementById('post-recruitment-type').value = '';
        document.getElementById('post-city').value = '';
        const today = new Date();
        document.getElementById('post-date').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      }

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closePostModal = function () {
      document.getElementById('post-modal-overlay').classList.remove('open');
      document.body.style.overflow = '';
      // 重置编辑器内容
      resetQuillEditor();
    };

    document.getElementById('post-modal-overlay').addEventListener('click', function(e) {
      if (e.target === this) closePostModal();
    });

    window.savePost = async function (e) {
      e.preventDefault();
      const id = parseInt(document.getElementById('post-id').value) || null;
      const title = document.getElementById('post-title').value.trim();
      const category = document.getElementById('post-cat').value;
      const date = document.getElementById('post-date').value;
      // 确保从Quill编辑器同步内容到隐藏textarea
      const content = document.getElementById('post-content').value;
      const link = document.getElementById('post-link').value.trim();
      const recruitmentType = document.getElementById('post-recruitment-type').value || null;
      const city = document.getElementById('post-city').value || null;

      if (!title || !category || !date) return;

      const categoryName = CAT_MAP[category] || category;

      if (id) {
        // Update
        const result = await api('/posts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ title, category, categoryName, date, content, link, recruitmentType, city })
        });
        if (result.success) {
          toast('公告已更新！');
        } else {
          toast(result.message || '更新失败', 'error');
          return;
        }
      } else {
        // Create
        const result = await api('/posts', {
          method: 'POST',
          body: JSON.stringify({ title, category, categoryName, date, content, link, recruitmentType, city })
        });
        if (result.success) {
          toast('公告已新增！');
        } else {
          toast(result.message || '创建失败', 'error');
          return;
        }
      }

      closePostModal();
      renderPostsTable();
      renderDashboard();
    };

    // ---- Delete ----
    let deleteTargetId = null;

    window.confirmDelete = function (id) {
      deleteTargetId = id;
      document.getElementById('confirm-overlay').classList.add('open');
    };

    window.closeConfirm = function () {
      document.getElementById('confirm-overlay').classList.remove('open');
      deleteTargetId = null;
    };

    window.doDelete = async function () {
      if (!deleteTargetId) return;
      const result = await api('/posts/' + deleteTargetId, { method: 'DELETE' });
      if (result.success) {
        closeConfirm();
        renderPostsTable();
        renderDashboard();
        toast('公告已删除', 'success');
      } else {
        toast(result.message || '删除失败', 'error');
      }
    };

    // ---- Toggle Pin (置顶) ----
    window.toggleTop = async function (id) {
      const result = await api('/posts/' + id + '/top', { method: 'PATCH' });
      if (result.success) {
        toast(result.message, 'success');
        renderPostsTable();
        renderDashboard();
      } else {
        toast(result.message || '操作失败', 'error');
      }
    };

    // ---- Import Data ----
    window.openImportModal = function () {
      document.getElementById('import-data').value = '';
      document.getElementById('import-preview').innerHTML = '';
      document.getElementById('import-modal-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closeImportModal = function () {
      document.getElementById('import-modal-overlay').classList.remove('open');
      document.body.style.overflow = '';
    };

    // Preview import data
    document.addEventListener('DOMContentLoaded', function() {
      const importTextarea = document.getElementById('import-data');
      if (importTextarea) {
        importTextarea.addEventListener('input', function() {
          const previewEl = document.getElementById('import-preview');
          try {
            const data = JSON.parse(this.value.trim());
            if (Array.isArray(data)) {
              previewEl.innerHTML = `<div style="padding:var(--space-3);background:var(--color-bg);border-radius:var(--radius-md);font-size:var(--font-size-xs);color:var(--color-text-secondary);">
                <strong style="color:var(--color-success);">✓ 有效的JSON数组</strong><br>
                共 ${data.length} 条公告。<br>
                分类统计：${countCategories(data)}
              </div>`;
            } else {
              previewEl.innerHTML = `<div style="padding:var(--space-3);background:rgba(229,62,62,0.08);border-radius:var(--radius-md);font-size:var(--font-size-xs);color:var(--color-error);">
                请输入JSON数组格式（用 [] 包裹）
              </div>`;
            }
          } catch (e) {
            previewEl.innerHTML = `<div style="padding:var(--space-3);background:rgba(229,62,62,0.08);border-radius:var(--radius-md);font-size:var(--font-size-xs);color:var(--color-error);">
              JSON格式错误：${e.message}
            </div>`;
          }
        });
      }

      const importOverlay = document.getElementById('import-modal-overlay');
      if (importOverlay) {
        importOverlay.addEventListener('click', function(e) {
          if (e.target === this) closeImportModal();
        });
      }
    });

    function countCategories(data) {
      const counts = {};
      data.forEach(item => {
        const cat = item.category || '未分类';
        counts[cat] = (counts[cat] || 0) + 1;
      });
      return Object.entries(counts).map(([k, v]) => `${CAT_MAP[k] || k}: ${v}条`).join('，');
    }

    window.doImport = async function () {
      const textarea = document.getElementById('import-data');

      try {
        const data = JSON.parse(textarea.value.trim());
        if (!Array.isArray(data) || data.length === 0) {
          toast('请输入有效的JSON数组', 'error');
          return;
        }

        const result = await api('/posts/import', {
          method: 'POST',
          body: JSON.stringify({ posts: data })
        });

        if (result.success) {
          closeImportModal();
          renderPostsTable();
          renderDashboard();
          toast(result.message, 'success');
        } else {
          toast(result.message || '导入失败', 'error');
        }
      } catch (e) {
        toast('JSON格式错误：' + e.message, 'error');
      }
    };

    // ---- Share Modal ----
    window.openShareModal = async function () {
      var overlay = document.getElementById('share-modal-overlay');
      var loading = document.getElementById('share-loading');
      var content = document.getElementById('share-content');
      var empty = document.getElementById('share-empty');
      var footer = document.getElementById('share-footer');
      var title = document.getElementById('share-modal-title');
      var textEl = document.getElementById('share-text');

      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      loading.style.display = 'block';
      content.style.display = 'none';
      empty.style.display = 'none';
      footer.style.display = 'none';

      try {
        var result = await api('/posts/today');
        if (result.success && result.count > 0) {
          title.textContent = '今日招考分享（' + result.date + '）';
          textEl.textContent = result.shareText;
          loading.style.display = 'none';
          content.style.display = 'block';
          footer.style.display = 'flex';
        } else {
          loading.style.display = 'none';
          empty.style.display = 'block';
          footer.style.display = 'flex';
          document.getElementById('share-copy-btn').style.display = 'none';
        }
      } catch (e) {
        loading.style.display = 'none';
        empty.querySelector('p').textContent = '加载失败，请重试';
        empty.style.display = 'block';
        footer.style.display = 'flex';
        document.getElementById('share-copy-btn').style.display = 'none';
      }

      // 点击遮罩关闭
      overlay.onclick = function(e) {
        if (e.target === overlay) closeShareModal();
      };
    };

    window.closeShareModal = function () {
      var overlay = document.getElementById('share-modal-overlay');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      document.getElementById('share-copy-btn').style.display = '';
    };

    window.copyShareText = async function () {
      var text = document.getElementById('share-text').textContent;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast('已复制到剪贴板，可直接粘贴转发！', 'success');
    };

    // ---- Users Table ----
    async function renderUsersTable() {
      await loadUsers();
      const tbody = document.getElementById('users-table-body');

      if (cachedUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-10);">暂无注册用户</td></tr>';
        return;
      }

      tbody.innerHTML = cachedUsers.map((u, i) => `
        <tr>
          <td style="color:var(--color-text-muted);">${i+1}</td>
          <td style="font-weight:var(--font-weight-medium);">${escHtml(u.nickname)}</td>
          <td style="color:var(--color-text-secondary);">${escHtml(u.username)}</td>
          <td style="color:var(--color-text-muted);font-size:var(--font-size-xs);">${u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
          <td><span class="announcement-card__tag ${u.role==='admin'?'tag-gwy':'tag-js'}">${u.role==='admin'?'管理员':'普通用户'}</span></td>
          <td>
            ${u.role !== 'admin' ? `<button class="admin-btn admin-btn--danger admin-btn--sm" onclick="deleteUser(${u.id})">删除账号</button>` : '<span style="color:var(--color-text-muted);font-size:var(--font-size-xs);">系统账号</span>'}
          </td>
        </tr>
      `).join('');
    }

    window.deleteUser = async function (userId) {
      const result = await api('/users/' + userId, { method: 'DELETE' });
      if (result.success) {
        renderUsersTable();
        toast('用户已删除');
      } else {
        toast(result.message || '删除失败', 'error');
      }
    };

    // ---- Escape HTML ----
    function escHtml(str) {
      const d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML;
    }

    // ---- About Page Management ----
    async function loadAboutData() {
      const result = await api('/about');
      if (result.success) {
        renderAboutEditor(result.data);
        toast('关于我们页面数据已加载', 'success');
      } else {
        toast(result.message || '加载失败', 'error');
      }
    }

    function renderAboutEditor(sections) {
      const container = document.getElementById('about-sections');
      if (!container) return;

      const sectionKeys = ['platform_intro', 'service_mission', 'coverage', 'disclaimer', 'contact'];
      const sectionNames = {
        'platform_intro': '平台介绍',
        'service_mission': '服务宗旨',
        'coverage': '信息覆盖范围',
        'disclaimer': '免责声明',
        'contact': '联系我们'
      };

      let html = '';
      sectionKeys.forEach(key => {
        const section = sections[key];
        if (!section) return;
        
        html += `
          <div class="admin-form-row" style="background:var(--color-bg);padding:var(--space-5);border-radius:var(--radius-lg);margin-bottom:var(--space-4);">
            <label for="about-${key}">${sectionNames[key] || section.title}</label>
            <input type="text" class="admin-form-input" id="about-title-${key}" value="${escHtml(section.title)}" placeholder="章节标题" style="margin-bottom:var(--space-3);">
            <textarea class="admin-form-textarea" id="about-content-${key}" placeholder="章节内容" style="min-height:120px;">${escHtml(section.content)}</textarea>
          </div>
        `;
      });

      html += '<div style="padding:var(--space-4);background:var(--color-accent-light);border-radius:var(--radius-md);font-size:var(--font-size-sm);color:var(--color-text-secondary);"><strong>提示：</strong>修改后点击"保存所有修改"按钮保存。修改会立即在前台页面生效。</div>';
      
      container.innerHTML = html;
    }

    async function saveAllAbout() {
      const sectionKeys = ['platform_intro', 'service_mission', 'coverage', 'disclaimer', 'contact'];
      let savedCount = 0;
      let errorCount = 0;

      for (const key of sectionKeys) {
        const titleEl = document.getElementById(`about-title-${key}`);
        const contentEl = document.getElementById(`about-content-${key}`);
        
        if (!titleEl || !contentEl) continue;

        const title = titleEl.value.trim();
        const content = contentEl.value.trim();

        if (!title || !content) {
          errorCount++;
          continue;
        }

        const result = await api(`/about/${key}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content })
        });

        if (result.success) {
          savedCount++;
        } else {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast(`成功保存 ${savedCount} 个章节`, 'success');
      } else {
        toast(`保存完成：成功 ${savedCount} 个，失败 ${errorCount} 个`, 'error');
      }
    }

    // 在 showPanel 中添加 about 面板处理
    const originalShowPanel = window.showPanel;
    window.showPanel = function (panelId) {
      originalShowPanel(panelId);
      
      if (panelId === 'about') {
        loadAboutData();
      }
    };

    // ---- Site Settings ----
    const HERO_PRESETS = [
      { id: 'default', label: '默认蓝', css: 'linear-gradient(180deg, #E0F0FF 0%, #C8E0FA 100%)', dark: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)' },
      { id: 'solid-blue', label: '纯蓝', css: '#EBF8FF', dark: '#1E3A5F' },
      { id: 'solid-green', label: '纯绿', css: '#F0FFF4', dark: '#1B4332' },
      { id: 'solid-purple', label: '纯紫', css: '#FAF5FF', dark: '#322659' },
      { id: 'solid-amber', label: '纯金', css: '#FFFBEB', dark: '#4A3F1D' },
      { id: 'gradient-indigo', label: '靛蓝渐变', css: 'linear-gradient(180deg, #E0E7FF 0%, #C7D2FE 100%)', dark: 'linear-gradient(180deg, #312E81 0%, #1E1B4B 100%)' },
      { id: 'gradient-emerald', label: '翠绿渐变', css: 'linear-gradient(180deg, #D1FAE5 0%, #A7F3D0 100%)', dark: 'linear-gradient(180deg, #064E3B 0%, #022C22 100%)' },
      { id: 'gradient-rose', label: '玫红渐变', css: 'linear-gradient(180deg, #FCE7F3 0%, #F9A8D4 100%)', dark: 'linear-gradient(180deg, #4C1D3D 0%, #2D0A22 100%)' },
      { id: 'custom', label: '自定义图片', css: '', dark: '', isUpload: true },
    ];

    let currentHeroBg = 'default';
    let customBgUrl = '';

    window.loadSiteSettings = async function () {
      const result = await api('/site-config/hero');
      if (result.success) {
        if (result.data.background && result.data.background.startsWith('/uploads/')) {
          currentHeroBg = 'custom';
          customBgUrl = result.data.background;
        } else {
          currentHeroBg = result.data.background || 'default';
        }
      }
      renderHeroPresets();
    };

    function renderHeroPresets() {
      const container = document.getElementById('hero-bg-presets');
      if (!container) return;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      container.innerHTML = HERO_PRESETS.map(p => {
        if (p.isUpload) {
          var isUploadActive = currentHeroBg === 'custom';
          return '<div class="hero-preset-item' + (isUploadActive ? ' active' : '') + '" onclick="selectHeroBg(\'custom\')" style="cursor:pointer;border-radius:var(--radius-md);overflow:hidden;border:3px solid ' + (isUploadActive ? 'var(--color-accent)' : 'var(--color-border-light)') + ';transition:all var(--transition-fast);">' +
            '<div style="height:60px;background:var(--color-bg);display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:var(--font-weight-medium);color:var(--color-text-secondary);border:1px dashed var(--color-border);margin:8px;border-radius:4px;">' +
              (isUploadActive && customBgUrl ? '<img src="' + customBgUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:2px;" onerror="this.style.display=\'none\'">' : '') +
              '<span style="position:absolute;">' + (isUploadActive ? '✓ ' : '📷 ') + '自定义图片</span>' +
            '</div>' +
          '</div>';
        }
        const bg = isDark && p.dark ? p.dark : p.css;
        const active = currentHeroBg === p.id;
        return '<div class="hero-preset-item' + (active ? ' active' : '') + '" onclick="selectHeroBg(\'' + p.id + '\')" style="cursor:pointer;border-radius:var(--radius-md);overflow:hidden;border:3px solid ' + (active ? 'var(--color-accent)' : 'transparent') + ';transition:all var(--transition-fast);">' +
          '<div style="height:60px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:var(--font-weight-medium);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.3);">' + (active ? '✓ ' : '') + p.label + '</div>' +
        '</div>';
      }).join('') +
      // Upload input (hidden)
      '<input type="file" id="hero-bg-upload" accept="image/*" style="display:none;" onchange="handleHeroBgUpload(this)">';
    }

    window.selectHeroBg = function (id) {
      if (id === 'custom') {
        document.getElementById('hero-bg-upload').click();
        return;
      }
      currentHeroBg = id;
      renderHeroPresets();
    };

    window.handleHeroBgUpload = async function (input) {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('image', file);
      const token = getToken();
      try {
        const resp = await fetch('/api/upload/hero', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData
        });
        const result = await resp.json();
        if (result.success) {
          customBgUrl = result.data.url;
          currentHeroBg = 'custom';
          renderHeroPresets();
          toast('图片上传成功！请点击保存按钮生效');
        } else {
          toast(result.message || '上传失败', 'error');
        }
      } catch (e) {
        toast('上传失败: ' + e.message, 'error');
      }
    };

    window.saveHeroBackground = async function () {
      const bgValue = currentHeroBg === 'custom' ? customBgUrl : currentHeroBg;
      const result = await api('/site-config/hero', {
        method: 'PUT',
        body: JSON.stringify({ background: bgValue })
      });
      if (result.success) {
        toast('背景设置已保存！刷新首页查看效果');
      } else {
        toast(result.message || '保存失败', 'error');
      }
    };

    // ---- Donation ----
    window.uploadDonationImage = async function (num, input) {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('image', file);
      const token = getToken();
      try {
        const resp = await fetch('/api/upload/hero', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData
        });
        const result = await resp.json();
        if (result.success) {
          const preview = document.getElementById('donation-preview-' + num);
          if (preview) preview.innerHTML = '<img src="' + result.data.url + '" style="width:100%;height:100%;object-fit:contain;">';
          // 保存到 site-config
          const configData = {};
          configData['image_' + num] = result.data.url;
          // 获取另一张图片
          const existing = await api('/site-config/donation');
          if (existing.success) {
            if (num === 1) configData.image_2 = existing.data.image_2;
            if (num === 2) configData.image_1 = existing.data.image_1;
          }
          await api('/site-config/donation', {
            method: 'PUT',
            body: JSON.stringify(configData)
          });
          toast('收款码' + num + '已上传并保存！');
        } else {
          toast(result.message || '上传失败', 'error');
        }
      } catch (e) {
        toast('上传失败', 'error');
      }
    };

    async function loadDonationSettings() {
      const result = await api('/site-config/donation');
      if (result.success) {
        if (result.data.image_1) {
          const p1 = document.getElementById('donation-preview-1');
          if (p1) p1.innerHTML = '<img src="' + result.data.image_1 + '" style="width:100%;height:100%;object-fit:contain;">';
        }
        if (result.data.image_2) {
          const p2 = document.getElementById('donation-preview-2');
          if (p2) p2.innerHTML = '<img src="' + result.data.image_2 + '" style="width:100%;height:100%;object-fit:contain;">';
        }
        // 加载开关状态
        const toggle = document.getElementById('donation-toggle');
        const bg = document.getElementById('donation-toggle-bg');
        const dot = document.getElementById('donation-toggle-dot');
        const label = document.getElementById('donation-toggle-label');
        if (toggle && bg && dot && label) {
          toggle.checked = result.data.enabled !== false;
          if (toggle.checked) {
            bg.style.background = '#10b981';
            dot.style.transform = 'translateX(20px)';
            label.textContent = '已开启';
            label.style.color = '#10b981';
          }
        }
      }
    }

    window.toggleDonation = async function (enabled) {
      const result = await api('/site-config/donation/toggle', {
        method: 'PUT',
        body: JSON.stringify({ enabled: enabled })
      });
      if (result.success) {
        const bg = document.getElementById('donation-toggle-bg');
        const dot = document.getElementById('donation-toggle-dot');
        const label = document.getElementById('donation-toggle-label');
        if (enabled) {
          bg.style.background = '#10b981';
          dot.style.transform = 'translateX(20px)';
          label.textContent = '已开启';
          label.style.color = '#10b981';
        } else {
          bg.style.background = 'var(--color-border)';
          dot.style.transform = 'translateX(0)';
          label.textContent = '已关闭';
          label.style.color = 'var(--color-text-muted)';
        }
        toast(result.message, 'success');
      } else {
        document.getElementById('donation-toggle').checked = !enabled;
        toast(result.message, 'error');
      }
    }

    // ---- Init ----
    renderDashboard();
    loadDonationSettings();
  })();

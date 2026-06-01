/* 简化的展开/收起功能 - 直接替换 main.js 中的相关函数 */

// 在 main.js 中添加/替换以下代码：

// 展开/收起状态跟踪
const expandedPosts = new Set();

// 渲染招聘卡片（简化版）
function renderRecruitmentCard(item) {
  const isExpanded = expandedPosts.has(item.id);
  return `
    <div class="recruitment-card" data-id="${item.id}">
      <div class="recruitment-card__header" onclick="toggleRecruitmentCard(${item.id})">
        <span class="recruitment-card__title">${escapeHtml(item.title)}</span>
        <span class="recruitment-card__toggle">
          ${isExpanded ? '收起 ▲' : '展开 ▼'}
        </span>
      </div>
      <div class="recruitment-card__meta">
        <span class="announcement-card__tag ${TAG_CLASS[item.category] || ''}">${escapeHtml(item.categoryName)}</span>
        <span>${escapeHtml(item.date)}</span>
      </div>
      <div class="recruitment-card__content" id="recruitment-content-${item.id}" style="display:none;">
        ${isExpanded ? (item.content || '<p>暂无详细内容，<a href="detail.html?id=${item.id}">点击查看完整公告 →</a></p>') : ''}
      </div>
    </div>
  `;
}

// 展开/收起函数（简化版）
window.toggleRecruitmentCard = function(id) {
  const contentEl = document.getElementById('recruitment-content-' + id);
  if (!contentEl) return;

  if (expandedPosts.has(id)) {
    // 收起
    expandedPosts.delete(id);
    contentEl.style.display = 'none';
  } else {
    // 展开
    expandedPosts.add(id);
    contentEl.style.display = 'block';
    
    // 如果内容为空，加载内容
    if (!contentEl.innerHTML || contentEl.innerHTML.trim() === '') {
      const item = state.cachedPosts.find(p => p.id === id);
      if (item && item.content) {
        contentEl.innerHTML = item.content;
      } else {
        contentEl.innerHTML = `<p>暂无详细内容，<a href="detail.html?id=${id}">点击查看完整公告 →</a></p>`;
      }
    }
  }

  // 更新toggle按钮文本
  const card = contentEl.closest('.recruitment-card');
  if (card) {
    const toggleSpan = card.querySelector('.recruitment-card__toggle');
    if (toggleSpan) {
      toggleSpan.innerHTML = (expandedPosts.has(id) ? '收起 ▲' : '展开 ▼');
    }
  }
};

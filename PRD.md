# 安徽招考网（AHZK）产品需求文档（PRD）

**版本：** v1.0  
**日期：** 2026-05-10  
**负责人：** kou（寇豆码）  
**项目代号：** ahzk-site / anhui-zhaokao

---

## 一、产品概述

### 1.1 产品定位
安徽招考网是一个面向安徽地区考生的招生考试信息公开平台，提供公务员、事业单位、教师招聘、国企招聘、医疗卫生、三支一扶等各类招考公告的发布、查询和收藏功能。

### 1.2 目标用户
- 安徽地区准备参加各类招考的考生
- 需要发布招考信息的 admin 管理员

### 1.3 核心价值
- 及时发布各类招考公告
- 便捷的分类检索和关键词搜索
- 用户收藏功能，方便跟踪关注岗位

---

## 二、用户角色定义

| 角色 | 标识 | 权限说明 |
|------|------|----------|
| 游客 | guest | 可浏览公告列表和详情，不可收藏 |
| 注册用户 | user | 可浏览、收藏/取消收藏公告 |
| 管理员 | admin | 拥有所有权限，可管理公告、导入数据、管理用户 |

---

## 三、功能需求

### 3.1 用户认证模块

#### 3.1.1 登录
- **路径：** `/auth.html`
- **功能：**
  - 支持用户名 + 密码登录
  - 登录成功后返回 token，存储在 localStorage
  - token 有效期 7 天
- **API：** `POST /api/auth/login`

#### 3.1.2 注册
- **功能：**
  - 支持用户名 + 密码 + 昵称注册
  - 密码至少 6 位
  - 用户名唯一性校验
- **API：** `POST /api/auth/register`

#### 3.1.3 获取当前用户信息
- **功能：** 通过 token 获取当前登录用户信息
- **API：** `GET /api/auth/me`

---

### 3.2 招考公告模块

#### 3.2.1 公告列表（公开）
- **路径：** `/index.html`、`/list.html`
- **功能：**
  - 支持按分类筛选（公务员、事业单位、教师招聘、国企招聘、医疗卫生、三支一扶）
  - 支持关键词搜索（标题、分类名称）
  - 支持排序（最新、最热）
  - 分页展示（默认每页 10 条）
  - 置顶公告优先展示
- **API：** `GET /api/posts?category=&q=&page=&perPage=&sort=`

#### 3.2.2 公告详情（公开）
- **路径：** `/detail.html?id=`
- **功能：**
  - 展示公告完整信息（标题、分类、日期、内容、来源链接）
  - 增加浏览量
  - 支持收藏/取消收藏
- **API：** `GET /api/posts/:id`

#### 3.2.3 新增公告（管理员）
- **路径：** `/admin.html`
- **功能：**
  - 填写标题、分类、分类名称、日期、内容、原文链接
  - 必填项校验（标题、分类、日期）
  - 成功后刷新列表
- **API：** `POST /api/posts`

#### 3.2.4 修改公告（管理员）
- **功能：**
  - 预填充原有内容
  - 修改后保存
- **API：** `PUT /api/posts/:id`

#### 3.2.5 删除公告（管理员）
- **功能：**
  - 二次确认后删除
  - 同步删除收藏表中的关联数据
- **API：** `DELETE /api/posts/:id`

#### 3.2.6 置顶/取消置顶（管理员）
- **功能：**
  - 切换置顶状态
  - 置顶公告按 `top_order` 排序
- **API：** `PATCH /api/posts/:id/top`

#### 3.2.7 批量导入公告（管理员）
- **功能：**
  - 支持 JSON 格式批量导入
  - 返回成功/失败数量
- **API：** `POST /api/posts/import`

---

### 3.3 收藏模块

#### 3.3.1 收藏列表
- **路径：** `/favorites.html`
- **功能：**
  - 展示当前用户收藏的所有公告
  - 按收藏时间倒序排列
- **API：** `GET /api/favorites`

#### 3.3.2 添加/取消收藏
- **功能：**
  - Toggle 模式：已收藏则取消，未收藏则添加
  - 需登录
- **API：** `POST /api/favorites/:postId`

---

### 3.4 用户管理模块（管理员）

#### 3.4.1 用户列表
- **路径：** `/admin.html`（用户 Tab）
- **功能：**
  - 查看所有注册用户
  - 显示用户名、昵称、角色、注册时间
- **API：** `GET /api/users`

#### 3.4.2 删除用户
- **功能：**
  - 不允许删除自己
  - 不允许删除其他 admin
- **API：** `DELETE /api/users/:id`

---

### 3.5 管理后台

#### 3.5.1 后台首页（Dashboard）
- **路径：** `/admin.html`
- **功能：**
  - 统计公告总数、用户总数、浏览总量
  - 快速入口：新增公告、导入数据

#### 3.5.2 权限守卫
- 未登录 → 跳转 `/auth.html`
- 非 admin 角色 → 跳转 `/auth.html`

---

## 四、非功能需求

### 4.1 性能要求
- 列表页加载时间 < 1s
- API 响应时间 < 500ms

### 4.2 安全要求
- 密码使用 bcrypt 加密存储（salt rounds = 10）
- JWT Secret 不硬编码（通过环境变量 `JWT_SECRET` 配置）
- 管理员操作需验证 `adminMiddleware`

### 4.3 兼容性
- 现代浏览器（Chrome、Edge、Firefox）
- 响应式布局，适配手机端

### 4.4 部署要求
- 部署至腾讯云轻量服务器（111.231.72.248）
- Nginx 反向代理 Express（端口 3000）
- PM2 进程守护

---

## 五、数据库设计

### 5.1 users 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| username | TEXT UNIQUE | 用户名（登录用） |
| nickname | TEXT | 昵称 |
| password_hash | TEXT | bcrypt 加密后的密码 |
| role | TEXT DEFAULT 'user' | 角色（user/admin） |
| created_at | DATETIME | 注册时间 |

### 5.2 posts 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| title | TEXT NOT NULL | 公告标题 |
| category | TEXT NOT NULL | 分类代号（gwy/sydw/js/gq/ylws/szyf） |
| category_name | TEXT NOT NULL | 分类中文名 |
| date | TEXT NOT NULL | 公告日期 |
| content | TEXT | 公告内容 |
| link | TEXT | 原文链接 |
| views | INTEGER DEFAULT 0 | 浏览量 |
| is_top | INTEGER DEFAULT 0 | 是否置顶（0/1） |
| top_order | INTEGER DEFAULT 0 | 置顶排序 |
| source | TEXT DEFAULT 'admin' | 来源（admin/import） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 5.3 favorites 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| user_id | INTEGER NOT NULL | 用户 ID（外键 → users.id） |
| post_id | INTEGER NOT NULL | 公告 ID（外键 → posts.id） |
| created_at | DATETIME | 收藏时间 |
| UNIQUE(user_id, post_id) | | 联合唯一 |

---

## 六、API 接口清单

### 认证接口
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | /api/auth/login | 公开 | 登录 |
| POST | /api/auth/register | 公开 | 注册 |
| GET | /api/auth/me | 登录 | 获取当前用户信息 |

### 公告接口
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/posts | 公开 | 公告列表 |
| GET | /api/posts/:id | 公开 | 公告详情 |
| POST | /api/posts | admin | 新增公告 |
| PUT | /api/posts/:id | admin | 修改公告 |
| DELETE | /api/posts/:id | admin | 删除公告 |
| PATCH | /api/posts/:id/top | admin | 置顶/取消置顶 |
| POST | /api/posts/import | admin | 批量导入 |

### 收藏接口
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/favorites | 登录 | 我的收藏列表 |
| POST | /api/favorites/:postId | 登录 | 收藏/取消收藏 |

### 用户接口
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/users | admin | 用户列表 |
| DELETE | /api/users/:id | admin | 删除用户 |

---

## 七、技术架构

### 7.1 技术栈
- **后端：** Node.js + Express
- **数据库：** SQLite（sql.js / better-sqlite3）
- **认证：** JWT（jsonwebtoken）
- **密码加密：** bcryptjs
- **进程管理：** PM2
- **反向代理：** Nginx

### 7.2 目录结构
```
anhui-zhaokao/
├── server/
│   ├── app.js           # Express 入口
│   ├── db.js            # 数据库初始化
│   ├── middlewares/
│   │   └── auth.js     # 认证中间件
│   └── routes/
│       ├── auth.js      # 认证路由
│       ├── posts.js     # 公告路由
│       ├── favorites.js # 收藏路由
│       └── users.js     # 用户管理路由
├── index.html           # 首页
├── list.html            # 列表页
├── detail.html          # 详情页
├── admin.html           # 管理后台
├── auth.html            # 登录/注册页
├── favorites.html       # 收藏页
└── about.html           # 关于页
```

---

## 八、附录

### 8.1 管理员账号
- **用户名：** 1771329858
- **密码：** ZY203841487
- **角色：** admin

### 8.2 分类映射
| 代号 | 中文名 |
|------|--------|
| gwy | 公务员 |
| sydw | 事业单位 |
| js | 教师招聘 |
| gq | 国企招聘 |
| ylws | 医疗卫生 |
| szyf | 三支一扶 |

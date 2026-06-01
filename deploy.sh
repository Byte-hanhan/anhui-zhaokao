#!/bin/bash
# 安徽招考网 - 服务器部署脚本 (Ubuntu)
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e

echo "================================"
echo "  安徽招考网 部署脚本"
echo "================================"

# 1. 安装 Node.js (如果未安装)
if ! command -v node &> /dev/null; then
    echo "[1/6] 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "[1/6] Node.js 已安装: $(node -v)"
fi

# 2. 安装 Nginx (如果未安装)
if ! command -v nginx &> /dev/null; then
    echo "[2/6] 安装 Nginx..."
    sudo apt install -y nginx
else
    echo "[2/6] Nginx 已安装"
fi

# 3. 安装 pm2 (进程守护)
if ! command -v pm2 &> /dev/null; then
    echo "[3/6] 安装 pm2..."
    sudo npm install -g pm2
else
    echo "[3/6] pm2 已安装"
fi

# 4. 安装项目依赖
echo "[4/6] 安装项目依赖..."
cd /var/www/anhui-zhaokao
npm install --production

# 5. 配置 Nginx
echo "[5/6] 配置 Nginx..."
sudo tee /etc/nginx/sites-available/anhui-zhaokao > /dev/null << 'EOF'
server {
    listen 80;
    server_name your_domain.com;  # 改成你的域名或IP

    root /var/www/anhui-zhaokao;
    index index.html;

    # 静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用站点配置
sudo ln -sf /etc/nginx/sites-available/anhui-zhaokao /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 6. 启动 Node.js 服务
echo "[6/6] 启动 Node.js 服务..."
pm2 delete anhui-zhaokao 2>/dev/null || true
cd /var/www/anhui-zhaokao
pm2 start server/app.js --name anhui-zhaokao
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "================================"
echo "  部署完成！"
echo "  网站: http://your_domain.com"
echo "  API:  http://your_domain.com/api"
echo "  管理后台: http://your_domain.com/admin.html"
echo "================================"
echo ""
echo "下一步:"
echo "1. 修改 /etc/nginx/sites-available/anhui-zhaokao 中的 server_name"
echo "2. 如需HTTPS，运行: sudo certbot --nginx -d your_domain.com"

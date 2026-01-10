# STAC Search Viewer

**[English](README.md)** | **[中文](README_ZH.md)**

一个基于 OpenLayers 的 Web 平台，可以搜索和可视化 STAC（时空资产目录）条目。该项目提供简洁的地图界面，帮助用户轻松搜索、浏览和分析各类卫星影像数据。

## 功能

- 🗺️ **交互式地图界面**：基于 OpenLayers，提供流畅的地图交互
- 🔍 **高级搜索**：可按集合、日期范围和边界框搜索 STAC 条目
- 📍 **地图上绘制**：可在地图上直接绘制边界框进行空间查询
- 📊 **详细信息**：在弹窗中查看条目的详细信息
- ⬇️ **资产下载**：直接从详情页下载条目资产（支持 Planetary Computer 签名和基本 S3 处理）
- 🛰️ **Sentinel-1 完整产品下载**：从 Copernicus Data Space 下载完整的 Sentinel-1 产品 ZIP 文件（在新标签页中打开，通过浏览器进行认证）
- 🌐 **多数据源支持**：支持 Microsoft Planetary Computer、AWS Earth Search 和 Copernicus Data Space

## 项目结构

```
stacsearch/
├── index.html                    # 入口 HTML 文件
├── package.json                  # 项目依赖
├── vite.config.mjs               # Vite 配置
├── .env.example                  # 环境变量模板
│
├── src/                          # 源代码目录
│   ├── main.js                   # 应用入口
│   │
│   ├── api/                      # API 客户端
│   │   ├── copernicus-client.js  # Copernicus 数据空间客户端
│   │   ├── download-clients.js   # 下载客户端
│   │   └── stac-service.js       # STAC API 服务
│   │
│   ├── basemaps/                 # 底图配置
│   │   ├── esri.js               # Esri 底图
│   │   ├── google.js             # Google 底图
│   │   ├── osm.js                # OpenStreetMap
│   │   └── tianditu.js           # 天地图
│   │
│   ├── config/                   # 配置文件
│   │   └── index.js              # 应用配置
│   │
│   ├── managers/                 # 功能管理器
│   │   ├── index.js              # 统一导出
│   │   ├── CollectionPicker.js   # 集合选择器 UI
│   │   ├── DrawingManager.js     # 地图绘制工具
│   │   ├── MapManager.js         # 地图初始化与图层
│   │   ├── SearchManager.js      # STAC 搜索逻辑
│   │   └── UIController.js       # UI 事件处理
│   │
│   ├── styles/                   # 样式文件
│   │   └── main.css              # 主样式
│   │
│   ├── types/                    # 类型定义
│   │   └── index.js              # JSDoc 类型定义
│   │
│   └── utils/                    # 工具函数
│       └── index.js              # 辅助函数
│
└── dist/                         # 构建输出
```

## 快速开始

### 前置要求

- Node.js（推荐 v16 或更高版本）
- npm 或 yarn

### 安装

1. 克隆仓库：
```bash
git clone https://github.com/Junhao2314/stac-search-viewer.git
cd stac-search-viewer
```

2. 安装依赖：
```bash
npm install
```

### 开发

启动开发服务器：
```bash
npm run dev
```

应用将在 `http://localhost:5173`（Vite 默认端口）上运行。

### 生产构建

构建项目：
```bash
npm run build
```

预览生产构建：
```bash
npm run preview
```

## 使用方法

1. **选择数据源**：从下拉菜单中选择 STAC 数据提供商（如 Microsoft Planetary Computer、AWS Earth Search、Copernicus Data Space）
2. **选择集合**：点击"选择集合"浏览并选择卫星影像集合
3. **设置日期范围**：指定搜索的时间段
4. **定义感兴趣区域**：
   - 使用绘图工具在地图上绘制矩形或多边形
   - 或手动输入边界框坐标
5. **搜索**：点击"搜索"按钮查找匹配的条目
6. **浏览结果**：在侧边栏查看搜索结果，悬停可在地图上高亮显示
7. **查看详情**：点击任意结果查看详细信息并下载资产

## 环境变量配置

要获得完整功能，可以配置以下环境变量。基于 `.env.example` 创建 `.env` 文件：

### Copernicus Data Space（Sentinel-1 完整产品下载）

Sentinel-1 完整产品下载需要 Copernicus Data Space 认证。下载前在浏览器控制台设置凭证：

```javascript
window.COPERNICUS_USERNAME = 'your_username';
window.COPERNICUS_PASSWORD = 'your_password';
```

要创建账号，请在 [https://dataspace.copernicus.eu/](https://dataspace.copernicus.eu/) 注册。

注意：出于安全考虑，Copernicus 凭证仅通过运行时注入方式接受，防止被打包进静态资源。

### 可选环境变量

- `VITE_PC_SUBSCRIPTION_KEY`：Microsoft Planetary Computer 订阅密钥，可获得更高的 API 速率限制
- `VITE_S3_REQUESTER_PAYS`：设为 `true` 以访问请求者付费的 S3 存储桶
- `VITE_GOOGLE_TILE_URL`：自定义 Google 地图瓦片 URL
- `VITE_GOOGLE_SUBDOMAINS`：Google 瓦片服务子域名（默认：`mt0,mt1,mt2,mt3`）

## 注意事项

- 本项目仅供研究与学习使用。
- 禁止用于任何商业用途。
- 禁止用于违反法律法规或侵犯他人合法权益的用途。
- 使用本项目产生的风险由使用者自行承担；作者/维护者不对任何直接或间接损失负责。
- 如需商业授权或其他用途，请与作者联系。

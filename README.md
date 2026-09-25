# JobBox - 招聘岗位助手

> 一键保存招聘岗位，自动整理薪资/地点/学历/经验，支持标签、状态、备注与搜索筛选。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 功能特性

- **一键采集**：在招聘详情页点击扩展图标，自动提取岗位标题、公司、薪资、地点、描述
- **智能标准化**：自动解析薪资范围（如"25-50K·14薪"）、省市拆分、学历与经验归一化
- **岗位库管理**：保存的岗位集中展示，支持关键词搜索与多维筛选（城市/薪资/学历/经验/状态/来源）
- **标签系统**：用户标签与系统自动标签分离存储，互不干扰
- **申请状态**：saved / applied / interview / rejected / offer 五态流转
- **备注记录**：每条岗位可添加面试反馈、薪资谈判等备注
- **数据导入导出**：支持 JSON 格式的全量备份与恢复
- **本地存储**：所有数据保存在浏览器本地，不上传服务器

## 安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/return054/jobbox.git
cd jobbox

# 安装依赖
npm install

# 构建
npm run build
```

构建产物在 `dist/` 目录。

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/` 目录

## 使用说明

### 保存岗位

1. 打开任意招聘详情页（如 BOSS 直聘、拉勾等）
2. 点击浏览器工具栏的 JobBox 图标
3. Popup 显示当前页面识别结果
4. 点击「打开岗位库」进入管理页面

### 管理岗位库

- **搜索**：在顶部搜索框输入关键词，匹配岗位标题、公司、描述、标签、备注
- **筛选**：通过筛选面板按城市、薪资、学历、经验、来源过滤
- **状态**：点击状态 chip 快速筛选申请状态
- **详情**：点击岗位卡片打开详情面板，可修改状态、增删标签、编辑备注、删除岗位
- **导入导出**：顶部按钮支持 JSON 格式的数据备份与恢复

### 申请状态说明

| 状态 | 含义 |
|-----|------|
| 已保存 | 刚收藏的岗位 |
| 已投递 | 已提交简历 |
| 面试中 | 正在面试流程 |
| 已拒绝 | 未通过或主动放弃 |
| 已录用 | 收到 offer |

## 支持的网站

| 平台 | 适配器 | 状态 |
|-----|--------|------|
| BOSS 直聘 | `site-zhipin` | ✅ 已支持 |
| 其他网站 | `generic`（JSON-LD + 语义） | ⚠️ 部分支持 |

Generic 适配器通过 schema.org 的 JobPosting JSON-LD 提取，支持大多数结构化招聘页面。

## 隐私

JobBox **不存储**任何密码、Cookie、Token 或登录信息。所有岗位数据仅保存在浏览器本地（`chrome.storage.local`），不上传服务器。详见 [隐私政策](./PRIVACY.md)。

## 反馈

遇到问题或有建议，请提交 [GitHub Issue](https://github.com/return054/jobbox/issues)。

## 开发

```bash
# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 单元测试
npm test

# 生产构建
npm run build
```

## 技术栈

- TypeScript + React 18
- Vite 构建
- Chrome Extension Manifest V3
- Vitest 测试框架

## 版本日志

见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

MIT

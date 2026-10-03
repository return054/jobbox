# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## \[1.1.0] - 2026-10-03

### 新增

- **Stage 2: Popup 接入 adapter 引擎,岗位字段提取+卡片渲染+保存入库**

  - `page-context.ts` 内联 zhipin + generic 选择器,在页面上下文直接提取岗位字段

  - `messages.ts` 协议扩展 `PageContextResult.job`,`message-router.ts` 透传 `ctx.job`

  - `popup/App.tsx` 重写:识别岗位时渲染卡片(title/company/薪资/地点/描述)+「保存岗位」按钮

  - 保存调用 `jobRepository.save`,自动生成潜台词解读(ensureInterpretation)

  - 导出 `hasJob` / `buildJobFromPartial` 纯函数,新增 14 个单测

### 变更

- 版本号 1.0.1 → 1.1.0

## \[1.0.1] - 2026-09-26

### 新增

- **Microsoft Edge 适配**：

  - `manifest.json` 添加 `browser_specific_settings.edge` 字段（最低版本 88）

  - README 补充 Edge 加载说明与商店分发入口

- 兼容性：Edge 基于 Chromium，原生支持 MV3，无需改动业务代码

### 变更

- 版本号 1.0.0 → 1.0.1

## \[1.0.0] - 2026-09-25

### 新增

- **岗位采集**：支持 BOSS 直聘详情页提取（title/company/salary/location/description）

- **Generic 适配器**：通过 schema.org JobPosting JSON-LD + 语义规则兜底提取

- **智能标准化**：

  - 薪资解析："25-50K·14薪" → {min:25000, max:50000, months:14}

  - 地点拆分："杭州余杭区" → {province:浙江, city:杭州, district:余杭区}

  - 学历归一：博士/硕士/本科/大专/高中/不限

  - 经验归一：1-3年 → {min:1, max:3}

- **质量评分**：100 分制（title20 + company20 + salary20 + location15 + description25）

- **验证机制**：≥90 自动通过，70-89 需人工确认，<70 拒绝

- **去重**：canonicalUrl + djb2 指纹（title+company+city+salary）两层判定

- **岗位数据库**：chrome.storage.local 持久化，1000 条搜索无卡顿

- **导入导出**：JSON 格式全量备份与恢复

- **岗位库 UI**：

  - 列表 + 关键词搜索 + 状态快筛

  - 多维筛选（城市/薪资/学历/经验/来源）

  - 详情面板：状态切换、标签增删、备注编辑、删除

  - 用户标签与自动标签分离存储

- **申请状态**：saved / applied / interview / rejected / offer 五态

- **错误处理**：7 种错误码（PAGE\_NOT\_SUPPORTED/JOB\_NOT\_FOUND 等）+ 结构化错误

- **日志系统**：INFO/WARN/OFF 三级，带时间戳与模块前缀

- **性能**：提取 ≤2s、保存 ≤500ms、1000 条搜索 ≤200ms

### 测试

- 170 个单元测试全部通过

- Adapter 回归测试（zhipin/generic 固定 HTML 夹具）

- 性能测试（提取/保存/搜索耗时断言）

### 文档

- README.md：产品介绍 + 安装使用说明

- PRIVACY.md：隐私政策（明确不存密码/Cookie/Token/登录信息）


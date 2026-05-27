# Implementation Plan: skills-sync

## Overview
构建一个 Node.js CLI 工具，在 40+ AI 工具间同步 skills。核心机制为 symlink 优先的 hub 模式。

## Architecture Decisions
- **Symlink 优先**: hub 修改即时生效，避免 copy 的延迟和冲突
- **Git 集成**: hub 是 git 仓库，版本控制天然支持
- **配置驱动**: `.skills-sync.toml` 声明工具目录和同步策略
- **交互式 CLI**: 关键操作（onboard, add 范围选择）交互式确认

## Task List

### Phase 1: Foundation

#### Task 1: 项目基础设施
- 初始化 package.json, tsconfig, vitest, eslint, prettier
- 配置 tsup 构建
- 目录结构: src/{types,config,utils,sync,commands,cli.ts}
- **AC**: `pnpm build` 成功，`pnpm test` 运行空测试套件
- **Files**: package.json, tsconfig.json, vitest.config.ts, tsup.config.ts, .eslintrc, .prettierrc

#### Task 2: 核心类型定义与配置系统
- 定义 `Skill`, `Tool`, `HubConfig`, `SyncMode` 等类型
- 实现 TOML 配置解析 (`.skills-sync.toml`)
- 路径展开 (`~` → home)
- **AC**: 能正确解析完整配置，类型守卫通过
- **Files**: src/types.ts, src/config/loader.ts, src/config/schema.ts
- **Deps**: Task 1

#### Task 3: 工具发现模块
- 扫描 `~` 下已知工具的 skills 目录
- 检测目录是否存在、是否已注册
- 返回 `ToolDiscoveryResult[]`
- **AC**: 在真实环境中能发现 claude, codex, gemini 等目录
- **Files**: src/discovery.ts
- **Deps**: Task 2

---
**Checkpoint 1**: Foundation 完成后，类型系统 + 配置 + 发现 都可用

### Phase 2: Core Sync 引擎

#### Task 4: Skill 元数据读取
- 解析 `SKILL.md` 的 YAML frontmatter
- 提取 name, description, metadata
- 计算目录内容哈希
- **AC**: 能正确读取真实 skill 的元数据
- **Files**: src/utils/skill-meta.ts
- **Deps**: Task 2

#### Task 5: Symlink 与 Copy 操作
- 创建/删除 symlink
- 创建/删除 copy
- 检测 symlink 是否断裂
- 路径解析和错误处理
- **AC**: 单元测试覆盖所有文件操作场景
- **Files**: src/sync/operations.ts
- **Deps**: Task 2

#### Task 6: 状态检查引擎
- 比较 hub 与各工具目录的差异
- 检测: symlink healthy, symlink broken, copy (独立副本), missing
- 生成 `SyncStatusReport`
- **AC**: `status` 能正确识别所有 4 种状态
- **Files**: src/sync/status.ts
- **Deps**: Task 4, Task 5

---
**Checkpoint 2**: Sync 引擎核心功能完成，能检测和诊断同步状态

### Phase 3: CLI Commands

#### Task 7: `init` 命令
- 创建 hub 目录结构
- 扫描并导入现有 skills（交互式确认）
- 生成 `.skills-sync.toml`
- 初始化 git
- **AC**: 在真实环境运行后，hub 创建成功且 skills 被正确导入
- **Files**: src/commands/init.ts
- **Deps**: Task 3, Task 5, Task 6

#### Task 8: `list` 命令
- 列出 hub 中所有 skills（通用 + 工具特有）
- 显示元数据摘要
- **AC**: 正确列出所有 skills
- **Files**: src/commands/list.ts
- **Deps**: Task 4

#### Task 9: `status` 命令
- 调用状态检查引擎
- 格式化输出（表格/列表）
- 标记问题并给出建议
- **AC**: 输出清晰，问题标记准确
- **Files**: src/commands/status.ts
- **Deps**: Task 6

#### Task 10: `add` 命令
- 接收路径参数
- 读取 skill 元数据
- 交互式选择范围（通用/特定工具）
- 创建 symlink/copy
- git commit
- **AC**: 添加后所有目标工具能访问新 skill
- **Files**: src/commands/add.ts
- **Deps**: Task 5, Task 7

#### Task 11: `sync` 命令
- 全量遍历注册工具
- 修复断裂 symlink
- 为新增工具创建 symlink
- 处理 prune
- **AC**: 运行后所有注册工具状态为 healthy
- **Files**: src/commands/sync.ts
- **Deps**: Task 5, Task 6, Task 9

#### Task 12: `onboard` 命令
- 扫描工具目录中的独立副本
- 交互式确认范围（通用/特定工具）
- 移入 hub，替换为 symlink
- 处理冲突（hub 已有同名 skill）
- **AC**: 收养后 skill 受 hub 管理，原工具 symlink 正确
- **Files**: src/commands/onboard.ts
- **Deps**: Task 5, Task 6, Task 10

#### Task 13: `remove` 命令
- 从 hub 删除
- 同步删除所有工具的 symlink/copy
- 确认交互
- **AC**: 删除后所有工具中无残留
- **Files**: src/commands/remove.ts
- **Deps**: Task 5, Task 10

---
**Checkpoint 3**: 所有 CLI 命令可用，能完成完整的增删查改同步流程

### Phase 4: 测试 + 完善

#### Task 14: 单元测试全覆盖
- 配置系统测试
- 发现模块测试
- Sync 操作测试（mock fs）
- 状态检查测试
- 各命令测试
- **AC**: 覆盖率 > 80%
- **Files**: tests/**/*.test.ts
- **Deps**: Task 1-13

#### Task 15: 集成测试
- 使用临时目录模拟完整工作流
- init → add → status → sync → onboard → remove
- **AC**: 端到端流程通过
- **Files**: tests/integration.test.ts
- **Deps**: Task 14

#### Task 16: CLI 入口与错误处理
- `src/cli.ts` 入口
- 全局错误处理
- 帮助文档
- `--version`
- **AC**: `node dist/cli.js --help` 输出完整
- **Files**: src/cli.ts
- **Deps**: Task 7-13

#### Task 17: README + 文档
- 使用说明
- 安装指南
- 示例
- **AC**: README 完整可发布
- **Files**: README.md
- **Deps**: Task 16

---
**Checkpoint 4**: 完整功能，测试通过，文档齐全，可发布

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 某些工具不支持 symlink | High | 配置 `mode = "copy"`，status 检测并提示 |
| 用户直接编辑工具目录 | Med | status 检测独立副本，onboard 回收 |
| 同名 skill 冲突 | Med | onboard 时交互式选择覆盖/合并/跳过 |
| 40+ 工具扫描性能 | Low | 只扫描已知工具目录，非递归 |

# 开发进度记录

## 版本 v0.1.1 (2026-03-31)

### Bug 修复

#### 设备信息获取
- ✅ 修复 `fetch_device_info` 未实际查询设备分辨率、型号、电量的问题
- ✅ 通过 `adb shell wm size` 获取真实屏幕分辨率（如 1080x2376）
- ✅ 通过 `adb shell getprop ro.product.model` 获取设备型号
- ✅ 通过 `adb shell dumpsys battery` 获取电池电量
- ✅ 之前 `screen_width`/`screen_height` 始终为 0，导致坐标缩放完全失效

#### 点击/滑动坐标映射
- ✅ 修复前端传递 `sourceWidth`/`sourceHeight` 为浮点数导致 Rust 后端 `u32` 类型校验失败的问题
- ✅ 对 `getImageLayout` 返回的 `displayWidth`/`displayHeight` 进行 `Math.round()` 取整
- ✅ 点击和滑动操作均已修复

### 影响范围
- **修复前**: 点击/滑动坐标全部集中在设备屏幕左上角（`scale(86, 162, 0)` → 返回 86）
- **修复后**: 坐标正确映射到设备全屏范围（`scale(86, 162, 1080)` → 返回 573）

### 文件变更
- `src-tauri/src/adb/server.rs`: `fetch_device_info` 实际查询设备分辨率、型号、电量
- `src/components/DeviceGrid/DeviceCard.tsx`: `sourceWidth`/`sourceHeight` 取整后传递给后端

---

## 版本 v0.1.0 (2026-03-25)

### 已完成功能

#### 设备管理优化
- ✅ 优化设备列表刷新逻辑，移除电量信息获取，减少 ADB 命令执行
- ✅ 设备列表只获取设备序列号和在线状态
- ✅ 解决多设备连接时的卡顿问题

#### 自动刷新机制
- ✅ 应用启动时自动刷新设备列表
- ✅ 切换 ADB 服务器启用/禁用状态时自动刷新设备列表

#### 设备禁用功能
- ✅ 左侧设备列表支持点击状态点禁用/启用设备
- ✅ 右侧设备卡片添加禁用按钮（红色 ✕）
- ✅ 禁用的设备不显示在右侧投屏列表中
- ✅ 禁用状态在左侧列表显示为半透明

#### 用户体验改进
- ✅ 设备 ID 点击复制到剪贴板功能
- ✅ 复制成功后显示 "✓ Copied" 提示（1.5秒）
- ✅ scrcpy 按钮优化为图标按钮，节省空间
- ✅ 默认每页显示设备数调整为 14 台
- ✅ 分页选项中添加 14 的选项

#### 文档更新
- ✅ 更新 README.md，添加最新功能说明
- ✅ 编写项目介绍文章 (docs/introduction.md)

### 技术优化

#### 性能优化
- 设备列表刷新时间大幅减少（移除了 model、battery、screen_width、screen_height 的获取）
- 每台设备减少 3 个 ADB shell 命令执行
- 支持更多设备同时连接而不卡顿

#### 状态管理
- 在 Zustand store 中添加 `disabledSerials` 状态
- 添加 `toggleDisableDevice` 方法管理设备禁用状态
- DeviceGrid 自动过滤禁用的设备

#### UI/UX
- 设备卡片 footer 重新布局，添加 `footerActions` 容器
- 禁用按钮样式：红色主题，与 scrcpy 按钮对称
- 左侧列表禁用设备样式：半透明 + 不可点击

### 构建信息
- 平台：macOS
- 构建产物：
  - `src-tauri/target/release/bundle/macos/phone-control.app`
  - `src-tauri/target/release/bundle/dmg/phone-control_0.1.0_x64.dmg`

### 已知问题
- 无

### 下一步计划
- [ ] 支持设备分组管理
- [ ] 添加设备备注功能
- [ ] 支持自定义快捷键
- [ ] 添加操作历史记录
- [ ] 支持批量文件传输

---

## 技术栈

- **前端**: React 19 + TypeScript + Zustand + Vite
- **后端**: Rust + Tauri 2 + Tokio
- **设备控制**: ADB (Android Debug Bridge)
- **投屏**: scrcpy 集成

## 项目结构

```
phone-control/
├── src/                          # React 前端
│   ├── components/
│   │   ├── Sidebar/             # 左侧边栏（服务器、设备列表）
│   │   ├── DeviceGrid/          # 右侧设备网格
│   │   └── Toolbar/             # 底部工具栏
│   ├── hooks/                   # React Hooks
│   ├── store/                   # Zustand 状态管理
│   └── types/                   # TypeScript 类型定义
├── src-tauri/                   # Rust 后端
│   └── src/
│       ├── adb/                 # ADB 相关功能
│       │   ├── server.rs        # 服务器管理和设备轮询
│       │   ├── device.rs        # 设备数据结构
│       │   ├── commands.rs      # ADB 命令执行
│       │   └── screenshot.rs    # 截屏功能
│       ├── config.rs            # 配置管理
│       └── lib.rs               # Tauri 命令定义
└── docs/                        # 文档
    └── introduction.md          # 项目介绍
```

## 开发团队

- 开发者：Claude (AI Assistant)
- 项目维护：0pen1

## 更新日志

### 2026-03-25
- 初始版本发布
- 实现核心群控功能
- 优化性能和用户体验

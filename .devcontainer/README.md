# 开发容器配置指南

本项目已配置了 VS Code 开发容器支持，方便开发和编译。

## 配置文件说明

### 核心文件
- **`.devcontainer/devcontainer.json`** - 开发容器主配置文件
- **`.devcontainer/Dockerfile`** - Docker 镜像构建文件
- **`.devcontainer/post-create.sh`** - 容器创建后的初始化脚本
- **`.devcontainer/post-start.sh`** - 容器启动后的脚本

## 快速开始

### 方法1：使用 VS Code 开发容器（推荐）

1. **安装依赖**
   - 安装 [VS Code Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack)
   - Docker Desktop 或其他 Docker 环境

2. **打开项目**
   ```bash
   git clone <repository-url>
   code <project-path>
   ```

3. **启动开发容器**
   - VS Code 会检测到 `.devcontainer` 文件夹
   - 点击右下角的 "Reopen in Container" 按钮
   - 或按 `Ctrl+Shift+P` 执行 "Dev Containers: Reopen in Container"

4. **开始开发**
   - 容器启动后，自动运行 `post-create.sh` 安装依赖
   - 所有命令在容器内执行

### 方法2：手动启动容器

```bash
# 构建容器镜像
docker build -f .devcontainer/Dockerfile -t phonecontrol-dev .

# 启动容器
docker run -it --rm \
  -v $(pwd):/workspaces/PhoneControl \
  -p 1420:1420 \
  -p 1421:1421 \
  -p 5173:5173 \
  phonecontrol-dev bash
```

## 可用命令

在开发容器内运行以下命令：

### 前端开发
```bash
npm run dev          # 启动开发服务器（Vite）
npm run build        # 构建前端项目
npm run preview      # 预览构建结果
npm run test         # 运行单元测试
npm run test:watch   # 监视模式下运行测试
```

### Tauri 应用开发
```bash
npm run tauri dev    # 启动 Tauri 开发模式
npm run tauri build  # 构建 Tauri 应用
npm run tauri info   # 显示 Tauri 环境信息
```

## 容器配置详情

### 安装的工具和库

**编程语言运行时：**
- Rust 1.75+ (通过 rust:1-1.75-bookworm 基础镜像)
- Node.js 20 LTS

**Tauri 依赖：**
- libwebkit2gtk-4.1-dev (WebKit 渲染引擎)
- libayatana-appindicator3-dev (系统托盘支持)
- librsvg2-dev (SVG 支持)

**开发工具：**
- Rust Analyzer (Rust LSP)
- Clippy (Rust 代码检查)
- Prettier (代码格式化)
- ESLint (JavaScript 代码检查)
- Git & GitHub CLI

**额外工具：**
- Android Debug Bridge (ADB)
- 图像处理库 (libpng, libjpeg)

### 端口映射

| 端口 | 用途 | 说明 |
|------|------|------|
| 1420 | Tauri Dev | 应用主端口 |
| 1421 | Tauri HMR | Hot Module Reload |
| 5173 | Vite | Vite 开发服务器 |
| 3000 | 应用服务 | 备用端口 |

### VS Code 扩展

自动安装的 VS Code 扩展：
- Rust Analyzer - Rust 支持
- Tauri - Tauri 开发支持
- Prettier - 代码格式化
- ESLint - JavaScript 代码检查
- GitLens - Git 增强功能

## 常见问题

### Q: 如何在容器中使用 ADB？
A: ADB 已预装在容器中。您可以直接在容器内使用：
```bash
adb devices
adb shell
```

### Q: 容器内的文件是否与主机共享？
A: 是的，工作目录已挂载为卷，容器内的更改会实时同步到主机。

### Q: 如何更新 Rust 工具链？
A: 在容器内运行：
```bash
rustup update
rustup component add rust-analyzer clippy
```

### Q: 在容器外也可以构建项目吗？
A: 可以，但建议使用开发容器以保证环境一致性。您需要在主机上安装相同的依赖。

## 故障排除

### 容器无法启动
- 检查 Docker 是否正常运行
- 查看 VS Code 的 "Dev Containers" 输出日志
- 尝试手动构建镜像：`docker build -f .devcontainer/Dockerfile -t phonecontrol-dev .`

### 依赖安装失败
- 清除容器重新开始：VS Code 命令 "Dev Containers: Rebuild Container"
- 检查网络连接
- 查看 `post-create.sh` 脚本输出

### 端口已被占用
- 修改 `devcontainer.json` 中的 `forwardPorts` 设置
- 或在主机上关闭占用端口的应用

## 进阶配置

### 添加更多 VS Code 扩展
修改 `.devcontainer/devcontainer.json` 的 `extensions` 数组：
```json
"extensions": [
  "existing-extension",
  "ms-publisher.new-extension"
]
```

### 增加系统包
修改 `.devcontainer/Dockerfile` 的 `apt-get install` 命令

### 自定义初始化脚本
编辑 `.devcontainer/post-create.sh` 和 `.devcontainer/post-start.sh`

## 参考资源

- [VS Code Dev Container 文档](https://code.visualstudio.com/docs/devcontainers/containers)
- [Tauri 官方文档](https://tauri.app/)
- [Rust 官方文档](https://www.rust-lang.org/learn)
- [Node.js 官方文档](https://nodejs.org/docs/)

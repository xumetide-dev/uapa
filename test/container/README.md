# 容器测试

在一次性容器中运行本仓库的检查与宿主实测，避免高危操作或沙盒逃逸损坏宿主机。入口为
[`run.sh`](run.sh)，机制在 [`lib.sh`](lib.sh)，镜像定义为 [`Dockerfile`](Dockerfile)。代理在
容器内外各自遵守的规则见仓库根目录的 [`AGENTS.md`](../../AGENTS.md)。

## 前提条件

- 宿主机上有 bash、git 与 Docker。已在 macOS 的 Docker Desktop 29.3.1（linux/arm64）上实测。
- 镜像只在本机构建与使用，不推送到任何镜像仓库：其中的 Claude Code 与 agy 是专有软件。

## 用法

命令在仓库内任意目录运行。

运行完整检查（等同 `pnpm check`，无网络、无凭据）：

```bash
test/container/run.sh check
```

运行单个测试或任意命令：

```bash
test/container/run.sh exec node --test test/runtime/subprocess.test.ts
```

进入带 claude、codex、agy 的交互容器（有网络），退出即删除：

```bash
test/container/run.sh shell
```

在同样的容器中运行一条命令后删除容器，不进入交互 shell（供代理做真实会话实测）：

```bash
test/container/run.sh shell claude -p "Reply with exactly the word OK"
```

查看正在运行的测试容器：

```bash
test/container/run.sh ps
```

删除依赖变更后遗留的旧镜像：

```bash
test/container/run.sh clean
```

## 认证

`check` 与 `exec` 不带任何凭据。`shell` 按下面的方式取得各家 CLI 的登录状态，登录由用户完成。

### Claude

使用 `claude setup-token` 生成的长期令牌（需要 Claude 订阅）。令牌独立于宿主上已有的登录：
不要把宿主的登录凭据复制进容器，容器刷新令牌后宿主上的登录会失效。

1. 在宿主终端生成令牌，按提示在浏览器中授权，复制输出的令牌：

   ```bash
   claude setup-token
   ```

2. 把令牌存入 macOS 钥匙串，在提示处粘贴：

   ```bash
   security add-generic-password -U -a "$USER" -s uapa-test-claude-oauth-token -w
   ```

`shell` 启动时先取环境变量 `CLAUDE_CODE_OAUTH_TOKEN`，没有时从钥匙串读取，经环境变量传入
容器，不出现在命令行参数中。非 macOS 宿主直接设置该环境变量。两处都没有时，容器内的 claude
处于未登录状态，脚本给出提示。

删除钥匙串中的令牌：

```bash
security delete-generic-password -a "$USER" -s uapa-test-claude-oauth-token
```

2026-10-14 实测：容器内的 Claude Code 2.1.296 以该令牌完成 `claude -p` 调用。

### codex

codex 使用 API key 的 model provider，不在容器内登录。provider 配置写在本机私有文件
`~/.config/uapa-test/codex.toml`（用环境变量 `UAPA_TEST_CODEX_CONFIG` 可指定其他路径），
不入库。`shell` 启动时把它追加到容器内的 `~/.codex/config.toml`，并按其中的 `env_key` 透传
同名环境变量；该变量须已在运行 `run.sh` 的 shell 中设置，未设置时脚本给出提示。

文件只写 provider 相关的键；镜像已设置 `approval_policy`、`sandbox_mode` 与工作目录信任，
重复定义会使 codex 报配置错误。格式如下：

```toml
model_provider = "<provider>"
model = "<模型>"

[model_providers.<provider>]
name = "<provider>"
base_url = "https://<接口地址>"
env_key = "<API key 所在的环境变量名>"
wire_api = "responses"
```

2026-10-14 实测：容器内的 codex-cli 0.162.1 以这种配置完成
`codex exec --skip-git-repo-check` 调用；工作目录 `/work` 不是 git 仓库，`codex exec` 需要
加 `--skip-git-repo-check`。

### agy

在容器中登录一次，凭据保存在命名卷 `uapa-test-auth` 中，之后的 `shell` 容器自动导入：

```bash
test/container/run.sh login agy
```

按提示登录 Google 账号，出现对话输入框后输入 `/exit` 退出。2026-10-14 实测：agy 1.3.5 的
令牌位于 `~/.gemini/antigravity-cli/antigravity-oauth-token`，导入后的容器中 `agy -p` 调用
成功。

认证卷只保存令牌文件，配置、插件与会话留在各自的容器内，随容器删除。因此一个容器中安装的
插件不会出现在其他容器中。

同步规则由镜像中的 `uapa-auth-sync`（源文件 [`image/auth-sync.sh`](image/auth-sync.sh)）执行：

- 容器启动后，把卷中的凭据复制到容器内，保留修改时间。
- 容器删除前，容器内的凭据比卷中的新（刷新过或刚登录）时写回卷；写入先落临时文件再改名。
- 多个容器都刷新过时，最后写回的为准。刷新令牌会轮换，多个容器同时刷新可能使其中一份失效，
  出现登录失效时重新执行 `login`。
- 脚本被 `kill -9` 时不写回；容器内刷新过的凭据随容器丢失。

退出 agy 的登录（先确认没有测试容器在运行）：

```bash
docker volume rm uapa-test-auth
```

## 容器内的权限

容器即隔离边界，各 CLI 在容器内不再弹出权限确认：

| CLI | 设置 | 来源 |
|---|---|---|
| claude | `~/.claude/settings.json` 默认 `bypassPermissions` | [`image/claude-settings.json`](image/claude-settings.json) |
| codex | `approval_policy = "never"`，`sandbox_mode = "danger-full-access"` | [`image/codex-config.toml`](image/codex-config.toml) |
| agy | 运行时加 `--dangerously-skip-permissions` | 无预置 |

容器以非 root 用户 `node` 运行：Claude Code 2.1.296 以 root 运行时拒绝
`--dangerously-skip-permissions`（2026-10-14 本地实测，设置 `IS_SANDBOX=1` 时放行）。需要 root
的操作用免密 `sudo`。

claude 的一次性确认也已预置。2026-10-14 以 Claude Code 2.1.296 本地实测：预置
[`image/claude-settings.json`](image/claude-settings.json) 与
[`image/claude-state.json`](image/claude-state.json) 后，交互模式不再出现首次引导、工作目录
`/work` 的信任确认与 bypass 模式确认，启动后直接显示 `bypass permissions on`。使用 API key
与订阅令牌时，每个新容器首次启动 claude 仍会出现一次 “Make auto mode your default permission
mode?”，选择 “No, keep bypass permissions”；抑制它的配置项待实测。`claude -p` 不出现该提示。

## 方案

### 隔离

宿主机的保护集中在容器启动参数上，容器内部不做额外限制。

| 项目 | 设置 | 原因 |
|---|---|---|
| 源码 | 每次运行生成工作区快照，以 tar 流送入容器的 `/work` | 不挂载宿主目录，容器内的删除不会波及宿主文件 |
| 特权 | 不加 `--privileged`，不挂载 `docker.sock`，保留 Docker 默认能力集 | 这些设置会让隔离失效 |
| 网络 | `check`、`exec` 无网络；`shell`、`login` 使用默认桥接网络 | 检查不需要网络；实测要访问模型服务 |
| 用户 | `node`（非 root），可免密 `sudo` | 测试依赖目录权限位，root 会绕过；见上节 |
| 凭据 | 只在 `shell`、`login` 中提供，见「认证」 | 检查与单元测试不需要凭据 |

快照在临时索引上执行 `git add --all` 与 `git write-tree` 得到树对象，再由 `git archive` 输出。
快照包含已跟踪文件、未被忽略的新文件与未提交的修改，不含 `node_modules/` 与 `dist/`；
真实索引与工作区不变，只会在对象库中新增松散对象（由 `git gc` 回收）。

### 并发

- 每次运行创建一个新容器，名为 `uapa-test-<模式>-<时间>-<进程号>`，带标签 `uapa.test`
  与 `uapa.test.source`（启动它的工作树路径）。
- 源码按次快照，多个工作树同时运行互不影响。
- 镜像标签取 Dockerfile、`package.json`、`pnpm-lock.yaml` 与 `image/` 下文件的内容哈希，形如
  `uapa-test:base-<哈希前 12 位>`。输入相同的工作树共用同一镜像，不同时各自构建，不互相覆盖。
- 清理只按本次创建的完整容器名执行，不使用 compose 项目与自定义网络，也不执行任何全局清理
  命令，因此不会删除其他服务或其数据卷。唯一的命名卷是认证卷，脚本不删除它。
- 同时运行的测试容器数有上限（软上限，检查与启动之间的竞争可能多出一两个），满额时等待空位。

### 生命周期

- 正常结束、Ctrl-C 或 SIGTERM：脚本写回凭据（`shell`、`login`）后按容器名删除容器。
- 脚本被 `kill -9`：容器主进程是有时长上限的 `sleep`（`check`、`exec` 为 30 分钟，`shell`、
  `login` 默认 4 小时），到期退出后由 `--rm` 自动删除。需要提前删除时，用 `ps` 查到完整容器名
  后执行 `docker rm -f <容器名>`。

### 资源

单个容器的上限与同时运行数可用环境变量调整：

| 环境变量 | 默认值 | 含义 |
|---|---|---|
| `UAPA_TEST_CPUS` | `2` | 单个容器的 CPU 上限 |
| `UAPA_TEST_MEMORY` | `2g` | 单个容器的内存上限 |
| `UAPA_TEST_PIDS` | `512` | 单个容器的进程数上限 |
| `UAPA_TEST_MAX` | `2` | 同时运行的测试容器数 |
| `UAPA_TEST_WAIT` | `600` | 等待空位的最长秒数 |
| `UAPA_TEST_SHELL_TTL` | `14400` | `shell`、`login` 容器的寿命上限（秒） |

2026-10-14 在 Docker Desktop（8 CPU、11.7 GiB）上实测：

| 项目 | 结果 |
|---|---|
| `check` 内存峰值（cgroup `memory.peak`） | 159 MiB |
| `check` 进程数峰值 | 43 |
| `check` 耗时（镜像已存在） | 约 5 秒 |
| base 镜像 | 454 MB，首次构建约 1.5 分钟 |
| agent 镜像 | 1.43 GB，在 base 之上增加约 1 GB（codex 390 MB、claude 245 MB、agy 196 MB）；只在首次 `shell` 或 `login` 时构建，耗时取决于下载速度 |

镜像层在容器之间共享，每个容器只增加自己的可写层。依赖变更后旧镜像不会自动删除，用 `clean`
删除；仍被容器使用的镜像会被 Docker 拒绝删除并保留。构建缓存由 Docker 自行回收，脚本不清理。

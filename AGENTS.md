# 代理工作约定

本文件约束在本仓库中工作的编码代理（coding agent）。

## 测试安全

宿主机上的沙盒（sandbox）可能失效或被绕过，测试不得依赖沙盒兜底；一旦逃逸，高危操作会对
宿主机造成不可逆损害。因此测试与实测在一次性容器中进行，宿主机上只做无害操作。

### 运行位置

- 检查与测试通过容器入口运行：完整检查用 `test/container/run.sh check`，单个测试或命令用
  `test/container/run.sh exec <命令>`。机制、并发与资源上限见
  [`test/container/README.md`](test/container/README.md)。
- 真实代理会话（如 `claude -p`）与需要执行高危命令的实测，只在 `test/container/run.sh shell`
  的容器中进行；代理用 `test/container/run.sh shell <命令>` 非交互地运行。
- 认证由用户准备：Claude 的 `claude setup-token`，agy 的 `test/container/run.sh login agy`，
  codex 的本机 provider 配置与 API key 环境变量（见容器测试说明的「认证」）。缺少时向用户说明，
  不代为登录。
- Docker 不可用时，先向用户说明，经同意后才在宿主机上运行，并遵守「宿主机上」一节。

### 容器内

容器内放宽权限：可以删除文件、修改系统文件、使用 `sudo`、安装软件包。claude 默认以 bypass
模式运行，codex 不弹审批，agy 加 `--dangerously-skip-permissions` 运行。容器损坏时删除重建
即可。以下仍然禁止：

- 对外写操作：`git push`、发布包、向外部服务发送数据。这些副作用发生在远端，容器管不到。
- 读取或外传凭据：不输出、不复制环境变量中的令牌与 API key，以及 agy 的令牌文件，它们只供
  CLI 自身使用。
- 削弱隔离：未经用户同意，不修改 `run.sh` 的启动参数，如挂载宿主目录、`--privileged`、
  挂载 `docker.sock`、`--network host`、`--pid host`。
- 影响其他容器：不执行 `docker system prune`、`docker volume prune`、
  `docker rm -f $(docker ps -aq)` 等全局清理命令，不操作其他项目的容器、卷与 compose 项目。
  清理只针对本次创建的容器，按完整容器名执行。不删除认证卷 `uapa-test-auth`（删除即退出
  agy 的登录），除非用户要求。

### 宿主机上

宿主机上运行的任何命令（含 Docker 不可用时的测试）都不执行高危命令或高危操作：

- 删除或覆盖测试临时目录以外的文件，如对 `/`、`~`、`$HOME`、仓库目录执行 `rm -rf`。
- 提权或修改系统：`sudo`、`mkfs`、`dd`，改动系统路径的权限或属主，修改系统与安全设置。
- 结束不是本测试启动的进程，或执行 `shutdown`、`reboot`。
- 对外写操作：`git push`（含 `--force`）、发布包、向外部服务发送数据。
- 读取或外传凭据：`~/.ssh`、`.env`、钥匙串、令牌。
- 下载并执行脚本，如 `curl ... | sh`。
- 关闭权限检查或沙盒，如 `--dangerously-skip-permissions`、`bypassPermissions`。

确需在宿主机上运行真实代理会话时，提示只要求运行无害命令（`echo`、`pwd`、读取测试目录内的
文件），工作目录设为临时目录，`--allowedTools` 只给用例需要的工具。

### 测试代码与夹具

提交进仓库的用例与夹具也会在宿主机上运行（如 `pnpm check`），因此无论在哪里运行都必须无害：

- 验证守卫的拒绝与改写路径时，让测试守卫匹配无副作用的标记命令（如
  `echo uapa-deny-probe`），不让守卫匹配真实高危命令再诱导模型执行它：守卫一旦失效，
  该命令就会真的运行。
- 文件操作限定在 `mkdtemp` 创建的临时目录内，结束时只清理该目录。
- 宿主命令、网络、推送、发布用桩（stub）替代，参见
  `test/targets/claude-code-hooks.test.ts` 中写入临时 `PATH` 的假 `claude`。
- 新增用例中，高危命令不以字符串形式出现，统一改用标记命令。

无法确认某个场景无害时，不运行，先向用户说明并确认。

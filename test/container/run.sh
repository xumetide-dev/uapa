#!/usr/bin/env bash
# 容器测试入口。每次运行使用独立的一次性容器：源码以快照形式送入，不挂载宿主目录；
# 结束时只删除本次创建的容器。方案与用法见 test/container/README.md，机制见 lib.sh。
# 兼容 macOS 自带的 bash 3.2：不使用关联数组、mapfile 等 bash 4 特性。
set -euo pipefail

readonly LABEL=uapa.test
readonly REPOSITORY=uapa-test
readonly WORKDIR=/work
# 单个容器的资源上限与同时运行的容器数，可用环境变量覆盖
readonly CPUS=${UAPA_TEST_CPUS:-2}
readonly MEMORY=${UAPA_TEST_MEMORY:-2g}
readonly PIDS=${UAPA_TEST_PIDS:-512}
readonly MAX_RUNNING=${UAPA_TEST_MAX:-2}
readonly SLOT_WAIT_SECONDS=${UAPA_TEST_WAIT:-600}
# 容器寿命上限（秒）：脚本被强杀、来不及清理时，容器到期自行退出并删除
readonly ONCE_TTL=1800
readonly SHELL_TTL=${UAPA_TEST_SHELL_TTL:-14400}
# agy 的登录凭据卷与容器内挂载点；Claude 令牌存放在 macOS 钥匙串的这个服务名下
readonly AUTH_VOLUME=uapa-test-auth
readonly AUTH_DIR=/uapa-auth
readonly KEYCHAIN_SERVICE=uapa-test-claude-oauth-token
# 本机私有的 codex model provider 配置（不入库），存在时追加到容器内的 codex 配置
readonly CODEX_CONFIG=${UAPA_TEST_CODEX_CONFIG:-$HOME/.config/uapa-test/codex.toml}
# 镜像的全部输入：内容哈希决定镜像标签，这些文件也是构建上下文的全部内容
readonly CONTEXT_FILES=(
  test/container/Dockerfile package.json pnpm-lock.yaml
  test/container/image/auth-sync.sh test/container/image/claude-settings.json
  test/container/image/claude-state.json test/container/image/codex-config.toml
)

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
readonly ROOT
IMAGE=''
CONTAINER=''
SYNC_AUTH=0

# shellcheck source=test/container/lib.sh
source "$ROOT/test/container/lib.sh"

usage() {
  cat >&2 <<'EOF'
用法：test/container/run.sh <命令> [参数...]
  check              在新容器中运行 pnpm check（无网络）
  exec <命令...>     在新容器中运行任意命令（无网络），如 exec node --test test/build
  shell [命令...]    进入带 claude、codex、agy 的实测容器（有网络），退出即删除；
                     给出命令时在其中运行该命令，不进入交互 shell
  login agy          在容器中登录 agy，凭据保存到认证卷
  ps                 列出正在运行的测试容器
  clean              删除本项目不再使用的旧测试镜像
EOF
  exit 2
}

# check 与 exec：无网络、无凭据的一次性容器，命令结束即删除
run_once() {
  ensure_image base
  wait_for_slot
  start_container run none "$ONCE_TTL"
  send_snapshot
  exec_in_container "$@"
}

# 无参数时进入交互 shell；有参数时运行该命令（供代理在容器内做真实会话实测）
run_shell() {
  load_claude_token
  start_agent_container shell
  send_snapshot
  if [ $# -gt 0 ]; then
    exec_in_container "$@"
    return
  fi
  echo "run.sh: 容器 $CONTAINER，退出 shell 后删除" >&2
  docker exec -it "$CONTAINER" bash
}

run_login() {
  if [ "${1:-}" != agy ]; then usage; fi
  start_agent_container login
  echo "run.sh: 登录完成后输入 /exit 退出，凭据写回认证卷 $AUTH_VOLUME" >&2
  docker exec -it "$CONTAINER" agy
}

list_containers() {
  docker ps --filter "label=$LABEL" \
    --format 'table {{.Names}}\t{{.Status}}\t{{.Label "uapa.test.source"}}'
}

# 不加 -f：仍被容器使用的镜像，Docker 会拒绝删除，予以保留。认证卷不在清理范围内
clean_images() {
  local current image
  image_tag base
  current=$IMAGE
  image_tag agent
  current="$current $IMAGE"
  for image in $(docker images "$REPOSITORY" --format '{{.Repository}}:{{.Tag}}'); do
    case " $current " in *" $image "*) continue ;; esac
    docker rmi "$image" >/dev/null || echo "run.sh: 保留 $image" >&2
  done
}

main() {
  [ $# -ge 1 ] || usage
  local command=$1
  shift
  cd "$ROOT"
  case $command in
    check) run_once pnpm check ;;
    exec) [ $# -ge 1 ] || usage; run_once "$@" ;;
    shell) run_shell "$@" ;;
    login) run_login "$@" ;;
    ps) list_containers ;;
    clean) clean_images ;;
    *) usage ;;
  esac
}

main "$@"

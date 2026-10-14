# run.sh 使用的机制：镜像构建、容器生命周期、源码快照与凭据导入。
# 由 run.sh 以 source 载入，依赖其中定义的常量；不单独执行。
# shellcheck shell=bash

die() {
  echo "run.sh: $*" >&2
  exit 2
}

# 设置 IMAGE。依赖与镜像文件相同的工作树共用同一镜像，不同时各用各的，并发时不互相覆盖
image_tag() {
  local hash
  hash=$(cat "${CONTEXT_FILES[@]}" | git hash-object --stdin)
  IMAGE="$REPOSITORY:$1-${hash:0:12}"
}

# 构建上下文只含 CONTEXT_FILES，不把工作区（含宿主平台的 node_modules）送进构建
ensure_image() {
  local context
  image_tag "$1"
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then return; fi
  echo "run.sh: 构建镜像 $IMAGE" >&2
  context=$(mktemp -d)
  cp "${CONTEXT_FILES[@]}" "$context/"
  if ! docker build --target "$1" --label "$LABEL=1" -t "$IMAGE" "$context" >&2; then
    rm -rf "$context"
    die "镜像构建失败"
  fi
  rm -rf "$context"
}

running_count() {
  docker ps --quiet --filter "label=$LABEL" | wc -l | tr -d ' '
}

# 软上限：检查与启动之间可能有其他运行插入，极端情况下会多出一两个容器
wait_for_slot() {
  local waited=0
  while [ "$(running_count)" -ge "$MAX_RUNNING" ]; do
    if [ "$waited" -ge "$SLOT_WAIT_SECONDS" ]; then
      die "等待 ${waited}s 后仍有 $MAX_RUNNING 个测试容器在运行"
    fi
    if [ "$waited" -eq 0 ]; then
      echo "run.sh: 已有 $MAX_RUNNING 个测试容器在运行，等待空位" >&2
    fi
    sleep 5
    waited=$((waited + 5))
  done
}

# 只删除本次创建的容器，按完整容器名定位；挂了认证卷的容器先把刷新过的凭据写回卷
cleanup() {
  if [ -z "$CONTAINER" ]; then return 0; fi
  if [ "$SYNC_AUTH" = 1 ]; then
    docker exec "$CONTAINER" uapa-auth-sync out >&2 || echo "run.sh: 凭据未能写回认证卷" >&2
  fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

# 参数：模式、网络、寿命，其后为附加的 docker run 参数
start_container() {
  local mode=$1 network=$2 ttl=$3
  shift 3
  CONTAINER="uapa-test-$mode-$(date +%Y%m%d%H%M%S)-$$"
  trap cleanup EXIT
  trap 'exit 130' INT TERM HUP
  docker run --detach --rm --init --name "$CONTAINER" \
    --label "$LABEL=$mode" --label "$LABEL.source=$ROOT" \
    --network "$network" --cpus "$CPUS" --memory "$MEMORY" --pids-limit "$PIDS" \
    "$@" "$IMAGE" sleep "$ttl" >/dev/null
}

# 带凭据的实测容器：有网络，挂载认证卷并导入 agy 凭据，追加本机的 codex 配置。
# 透传的环境变量只给名字、不给值，值取自调用 run.sh 的 shell，宿主未设置的不传入
start_agent_container() {
  local mode=$1 name
  set -- --env CLAUDE_CODE_OAUTH_TOKEN --mount "type=volume,src=$AUTH_VOLUME,dst=$AUTH_DIR"
  for name in $(codex_env_keys); do
    if [ -z "${!name:-}" ]; then echo "run.sh: 环境变量 $name 未设置，codex 无法调用模型" >&2; fi
    set -- "$@" --env "$name"
  done
  ensure_image agent
  wait_for_slot
  start_container "$mode" bridge "$SHELL_TTL" "$@"
  SYNC_AUTH=1
  docker exec "$CONTAINER" uapa-auth-sync in
  if [ -f "$CODEX_CONFIG" ]; then
    docker exec -i "$CONTAINER" sh -c 'cat >> ~/.codex/config.toml' < "$CODEX_CONFIG"
  fi
}

# 本机 codex 配置中各 model provider 的 env_key（API key 所在的环境变量名）
codex_env_keys() {
  if [ ! -f "$CODEX_CONFIG" ]; then return 0; fi
  sed -n 's/^[[:space:]]*env_key[[:space:]]*=[[:space:]]*"\([A-Za-z_][A-Za-z0-9_]*\)".*/\1/p' \
    "$CODEX_CONFIG"
}

# 把工作区快照（已跟踪文件与未被忽略的新文件，含未提交的修改）以 tar 流送入容器。
# 在临时索引上生成树对象，不改动真实索引与工作区。复制真实索引是为了复用文件状态缓存，
# 并保留已跟踪但匹配 .gitignore 的文件。
send_snapshot() {
  local temp index tree
  temp=$(mktemp -d)
  index=$(git rev-parse --git-path index)
  if [ -f "$index" ]; then cp "$index" "$temp/index"; fi
  GIT_INDEX_FILE="$temp/index" git add --all
  tree=$(GIT_INDEX_FILE="$temp/index" git write-tree)
  rm -rf "$temp"
  git archive --format=tar "$tree" | docker exec -i "$CONTAINER" tar -x -C "$WORKDIR"
}

# Claude 的长期令牌（claude setup-token 生成）：优先取环境变量，其次取 macOS 钥匙串。
# 令牌只经环境变量传给 docker，不出现在命令行参数中。
load_claude_token() {
  local token=''
  if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then return 0; fi
  if command -v security >/dev/null 2>&1; then
    token=$(security find-generic-password -a "${USER:-$(id -un)}" \
      -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)
  fi
  if [ -z "$token" ]; then
    echo "run.sh: 没有 Claude 令牌，容器内 claude 未登录（见 README「认证」）" >&2
    return 0
  fi
  export CLAUDE_CODE_OAUTH_TOKEN=$token
}

# 终端中运行时分配 tty，保留彩色输出；被其他程序调用时输出纯文本
exec_in_container() {
  if [ -t 1 ]; then
    docker exec -t "$CONTAINER" "$@"
  else
    docker exec "$CONTAINER" "$@"
  fi
}

#!/bin/bash
# 在认证卷与容器 home 之间同步 agy 的登录凭据（镜像内路径 /usr/local/bin/uapa-auth-sync）。
# 卷只保存凭据文件；配置、插件与会话留在容器内，随容器删除，不在容器之间共享。
# 用法：uapa-auth-sync in | out
#   in   容器启动后：把卷中的凭据复制到容器 home，保留修改时间
#   out  容器删除前：容器内的凭据比卷中的新（刷新过或刚登录）时写回卷
set -euo pipefail

readonly AUTH_DIR=/uapa-auth
# 每行一对：卷内相对路径、容器内路径
readonly FILES="agy/antigravity-oauth-token $HOME/.gemini/antigravity-cli/antigravity-oauth-token"

copy_in() {
  local stored=$AUTH_DIR/$1 local_file=$2
  if [ ! -f "$stored" ]; then return 0; fi
  mkdir -p "$(dirname "$local_file")"
  cp -p "$stored" "$local_file"
  chmod 600 "$local_file"
}

# 先写临时文件再改名，并发容器读到的总是完整文件；多个容器都刷新过时，最后写回的为准
copy_out() {
  local stored=$AUTH_DIR/$1 local_file=$2
  if [ ! -f "$local_file" ]; then return 0; fi
  if [ -f "$stored" ] && [ ! "$local_file" -nt "$stored" ]; then return 0; fi
  mkdir -p "$(dirname "$stored")"
  cp -p "$local_file" "$stored.tmp.$$"
  chmod 600 "$stored.tmp.$$"
  mv "$stored.tmp.$$" "$stored"
  echo "uapa-auth-sync: 已写回 $1"
}

main() {
  local direction=${1:-} stored local_file
  case $direction in
    in | out) ;;
    *) echo "用法：uapa-auth-sync in | out" >&2; exit 2 ;;
  esac
  while read -r stored local_file; do
    if [ "$direction" = in ]; then copy_in "$stored" "$local_file"; fi
    if [ "$direction" = out ]; then copy_out "$stored" "$local_file"; fi
  done <<< "$FILES"
}

main "$@"

# 容器测试镜像。只含工具链与依赖，源码在运行时由 run.sh 以快照形式送入。
# base：运行本地检查（pnpm check，发布脚本的测试需要 git）；agent：另装 claude、codex、agy 与
# sudo，供交互实测。
# 镜像只在本机构建与使用，不推送到任何镜像仓库（claude 与 agy 是专有软件，不再分发）。
FROM node:22-bookworm-slim AS base
ENV npm_config_update_notifier=false
RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /work
COPY package.json pnpm-lock.yaml ./
# pnpm 版本取自 packageManager，去掉可能附带的 +sha 后缀
RUN npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")" \
  && npm cache clean --force \
  && chown -R node:node /work
# 以非 root 运行：测试依赖目录权限位（root 会绕过 0o500 等限制）
USER node
RUN pnpm install --frozen-lockfile

FROM base AS agent
# claude 与 codex 钉版本，与实测记录一致；agy 的官方安装脚本只提供最新版
ARG CLAUDE_CODE_VERSION=2.1.296
ARG CODEX_VERSION=0.162.1
ENV DISABLE_AUTOUPDATER=1
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl sudo \
  && rm -rf /var/lib/apt/lists/* \
  && echo 'node ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/node \
  && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    "@openai/codex@${CODEX_VERSION}" \
  && npm cache clean --force
# 先下载再执行官方安装脚本（脚本按官方清单校验程序包的 sha512），不用 curl | bash
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/agy-install.sh \
    https://antigravity.google/cli/install.sh \
  && bash /tmp/agy-install.sh --dir /usr/local/bin \
  && rm /tmp/agy-install.sh \
  && agy --version
COPY --chmod=755 auth-sync.sh /usr/local/bin/uapa-auth-sync
# 预置一次性确认：首次引导、工作目录信任、bypass 模式与 codex 审批（容器即隔离边界）。
# ~node 为 node 用户的家目录；配置目录须属于 node，否则 CLI 无法写入。/uapa-auth 为认证卷挂载点，
# 命名卷首次挂载时沿用这里的属主与权限
COPY claude-settings.json claude-state.json codex-config.toml /tmp/uapa-image/
RUN install -d -o node -g node ~node/.claude ~node/.codex ~node/.gemini \
  && install -o node -g node -m 644 /tmp/uapa-image/claude-settings.json \
    ~node/.claude/settings.json \
  && install -o node -g node -m 644 /tmp/uapa-image/claude-state.json ~node/.claude.json \
  && install -o node -g node -m 644 /tmp/uapa-image/codex-config.toml ~node/.codex/config.toml \
  && install -d -o node -g node -m 700 /uapa-auth \
  && rm -r /tmp/uapa-image
USER node

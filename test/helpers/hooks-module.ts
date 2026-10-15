// hooks 模块入口的测试工具：以 node:module 的解析钩子把 'claude-code' 解析到
// test/runtime/stubs/claude-code.ts，记录 register 注册的处理函数，构造 $ 与 next。
// 引入本模块即登记解析钩子，供加载打包后的守卫文件。
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import type { StateRef } from '../runtime/stubs/claude-code.ts'

const STUB = new URL('../runtime/stubs/claude-code.ts', import.meta.url).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'claude-code') return { url: STUB, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})

export type Handler = (...args: unknown[]) => unknown

export interface Registered {
  readonly event: string
  readonly matcher: unknown
  readonly hook: Handler
  catchHandler: Handler | null
}

type Register = (on: (...args: unknown[]) => unknown, options?: unknown) => void

// 记录 register 注册的处理函数；on 的最后一个参数为处理函数，有三个参数时第二个为 matcher。
// options 为宿主传入的插件选项取值，省略时不传
export function record(register: Register, ...options: [unknown?]): Registered[] {
  const registered: Registered[] = []
  register(
    (event, ...rest) => {
      const hook = rest.at(-1) as Handler
      const entry: Registered = {
        event: String(event),
        matcher: rest.length > 1 ? rest[0] : null,
        hook,
        catchHandler: null,
      }
      registered.push(entry)
      const registration = {
        catch(handler: Handler) {
          entry.catchHandler = handler
          return registration
        },
      }
      return registration
    },
    ...options,
  )
  return registered
}

// 构造的 $：会话 id 固定，记录 $.env.set 的调用，$.state 存于 Map
export function api(sessionId: string) {
  const state = new Map<string, unknown>()
  const env: [string, string | undefined][] = []
  const key = (ref: StateRef) => `${ref.plugin}/${ref.key}`
  return {
    session: { id: async () => sessionId },
    env: {
      set: async (name: string, value: string | undefined) => {
        env.push([name, value])
      },
    },
    state: {
      get: async (ref: StateRef) =>
        state.has(key(ref)) ? { value: state.get(key(ref)), version: 1 } : undefined,
      set: async (ref: StateRef, value: unknown) => {
        state.set(key(ref), value)
      },
    },
    envCalls: env,
    stateValues: state,
  }
}

export const ENGINE_RESULT = { text: '引擎结果' }

// next 记录收到的事件并返回固定结果；called 为构造时给定的值
export function nextOf(called = false) {
  const calls: unknown[] = []
  const next = Object.assign(
    async (e: unknown) => {
      calls.push(e)
      return ENGINE_RESULT
    },
    { called },
  )
  return { next, calls }
}

export function only(registered: readonly Registered[], event: string): Registered {
  const found = registered.filter(r => r.event === event)
  assert.equal(found.length, 1, `${event} 应恰注册一次`)
  return found[0] as Registered
}

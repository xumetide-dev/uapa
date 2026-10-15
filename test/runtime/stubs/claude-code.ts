// TA-17 的 'claude-code' 桩：只模拟 Mods 指南记载的 atom、read、update。$.state.get 返回
// { value, version } 或 undefined，$ 由测试构造；宿主中的实际行为由 TA-12 验证。
export interface StateRef {
  readonly plugin: string
  readonly key: string
}

export interface StubAtom<T> {
  readonly ref: StateRef
  readonly initial: T
}

export interface StubState {
  get(ref: StateRef): Promise<{ value: unknown; version: number } | undefined>
  set(ref: StateRef, value: unknown): Promise<void>
}

export function atom<T>(ref: StateRef, initial: T): StubAtom<T> {
  return { ref, initial }
}

export async function read<T>(
  $: { readonly state: StubState },
  value: StubAtom<T>,
): Promise<T> {
  const current = await $.state.get(value.ref)
  return current === undefined ? value.initial : (current.value as T)
}

export async function update<T>(
  $: { readonly state: StubState },
  value: StubAtom<T>,
  change: (current: T) => T,
): Promise<void> {
  await $.state.set(value.ref, change(await read($, value)))
}

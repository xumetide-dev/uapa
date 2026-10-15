import type { Register } from 'claude-code'
import { register as guard } from './uapa-guard.mjs'

export const register: Register = (on, options) => guard(on, options)

// 潜台词引擎统一出口（Issue #10 + #11）
export { matchPhrases } from './matcher';
export type { InterpretationHit, HitPosition, MatcherOptions } from './matcher';
export { interpret, attachInterpretation } from './interpreter';
export {
  INTERPRETER_VERSION,
  emptyInterpretation,
  type InterpretationResult,
} from './types';

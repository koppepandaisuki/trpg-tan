import type { SystemDefinition } from "./types.js";
import { coc7 } from "./coc/coc7.js";
import { coc6 } from "./coc/coc6.js";

export type {
  SystemDefinition,
  CharacteristicDef,
  DerivedDef,
  SkillDef,
  OccupationDef,
} from "./types.js";
export { coc7 } from "./coc/coc7.js";
export { coc6 } from "./coc/coc6.js";
export {
  type CoCDerived,
  computeCoCDerived,
  coc7DamageBonus,
  coc6DamageBonus,
  coc7BaseMov,
  movAgePenalty,
} from "./coc/derive.js";
export {
  rollCharacteristicValue,
  generateAllCharacteristics,
} from "./coc/generate.js";
export {
  type AllocationErrorCode,
  type AllocationError,
  type SkillAllocation,
  type AllocationResult,
  evalPointFormula,
  validateSkillAllocation,
} from "./coc/allocate.js";

/** 収録済みシステム定義の一覧(id 引き当て用)*/
export const SYSTEMS: Record<string, SystemDefinition> = {
  [coc7.id]: coc7,
  [coc6.id]: coc6,
};

export function getSystem(id: string): SystemDefinition | undefined {
  return SYSTEMS[id];
}

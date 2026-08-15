export type SlotId = 'A' | 'B' | 'recovery' | 'none';
export type SlotHealth = 'healthy' | 'degraded' | 'failed' | 'unknown' | 'empty';

export interface SlotState {
  readonly activeSlot: SlotId;
  readonly bootedSlot: SlotId;
  readonly nextSlot?: SlotId;
  readonly previousKnownGoodSlot?: SlotId;
  readonly slotHealth: Readonly<Record<SlotId, SlotHealth>>;
  readonly bootAttempts: number;
}

/** SYS-011 — A/B slot state. Foundation for safe OS updates/rollback. */
export function createSlotState(input: Partial<SlotState> & Pick<SlotState, 'activeSlot' | 'bootedSlot' | 'bootAttempts'>): SlotState {
  return {
    activeSlot: input.activeSlot,
    bootedSlot: input.bootedSlot,
    slotHealth: input.slotHealth ?? { A: 'unknown', B: 'unknown', recovery: 'unknown', none: 'empty' },
    bootAttempts: input.bootAttempts,
    ...(input.nextSlot !== undefined ? { nextSlot: input.nextSlot } : {}),
    ...(input.previousKnownGoodSlot !== undefined ? { previousKnownGoodSlot: input.previousKnownGoodSlot } : {}),
  };
}

export function isSlotHealthy(state: SlotState): boolean {
  return state.slotHealth[state.bootedSlot] === 'healthy';
}

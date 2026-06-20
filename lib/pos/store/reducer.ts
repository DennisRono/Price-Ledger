import type { DomainState } from './types'
import { MAX_HISTORY, fallbackDomain } from './defaults'
import { uid } from '../format'

export type HistEntry = { state: DomainState; label: string }

export type FullState = {
  past: HistEntry[]
  present: DomainState
  future: HistEntry[]
  lastLabel: string
}

export type Action =
  | {
      type: 'COMMIT'
      label: string
      mutate: (d: DomainState) => DomainState
      audit?: string
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'HYDRATE'; present: DomainState }
  | { type: 'RESET' }

export function pushAudit(
  d: DomainState,
  action: string,
  detail: string,
): DomainState {
  const entry = {
    id: uid('aud'),
    at: Date.now(),
    by: d.currentCashierId,
    action,
    detail,
  }
  return { ...d, audit: [entry, ...d.audit].slice(0, 500) }
}

export function reducer(state: FullState, action: Action): FullState {
  switch (action.type) {
    case 'COMMIT': {
      let next = action.mutate(state.present)
      if (action.audit) next = pushAudit(next, action.label, action.audit)
      const past = [
        ...state.past,
        { state: state.present, label: state.lastLabel },
      ].slice(-MAX_HISTORY)
      return { past, present: next, future: [], lastLabel: action.label }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: prev.state,
        future: [
          { state: state.present, label: state.lastLabel },
          ...state.future,
        ],
        lastLabel: prev.label,
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        past: [
          ...state.past,
          { state: state.present, label: state.lastLabel },
        ].slice(-MAX_HISTORY),
        present: next.state,
        future: state.future.slice(1),
        lastLabel: next.label,
      }
    }
    case 'HYDRATE':
      return {
        past: [],
        present: action.present,
        future: [],
        lastLabel: 'Loaded',
      }
    case 'RESET':
      return {
        past: [],
        present: fallbackDomain(),
        future: [],
        lastLabel: 'Reset',
      }
    default:
      return state
  }
}

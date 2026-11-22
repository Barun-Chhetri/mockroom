import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { joinRoom } from './join-room'

export const actions: Record<string, ActionHandler<Env>> = {
  joinRoom,
}

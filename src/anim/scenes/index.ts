import type { SceneFactory } from './scene'
import { grid } from './grid'
import { ring } from './ring'
import { swarm } from './swarm'
import { tunnel } from './tunnel'

export const SCENES: SceneFactory[] = [tunnel, grid, swarm, ring]

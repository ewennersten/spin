import type { SceneFactory } from './scene'
import { grid } from './grid'
import { swarm } from './swarm'
import { tunnel } from './tunnel'

export const SCENES: SceneFactory[] = [tunnel, grid, swarm]

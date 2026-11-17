import type { SceneFactory } from './scene'
import { flock } from './flock'
import { grid } from './grid'
import { kalejdoskop } from './kalejdoskop'
import { klot } from './klot'
import { ring } from './ring'
import { swarm } from './swarm'
import { tunnel } from './tunnel'

export const SCENES: SceneFactory[] = [tunnel, grid, swarm, ring, klot, flock, kalejdoskop]

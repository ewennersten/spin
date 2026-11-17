import type { SceneFactory } from './scene'
import { grid } from './grid'
import { tunnel } from './tunnel'

export const SCENES: SceneFactory[] = [tunnel, grid]

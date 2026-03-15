/**
 * ActionDefs.tsx
 * Action grid definitions for predefined Windows actions + custom.
 * Split from ItemIcons.tsx so these imports are NOT pulled into the startup
 * bundle — ItemFormPanel is the only consumer and only renders on form open.
 * lucide-react v0.378.0
 *
 * Remaining 10 survivors (pre-overhaul stub — new power-user list added in Session 28):
 * screenshot, lock_screen, sleep, shut_down, restart, task_manager,
 * calculator, empty_recycle_bin, clipboard, run + custom
 */
import {
  Camera, Lock, Moon, Power, RotateCcw, Activity,
  Calculator, Clipboard, Play, Wrench, Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { ActionId } from '../../types'

export interface ActionDef {
  id:    ActionId
  label: string
  Icon:  LucideIcon
}

export const ACTION_DEFS: ActionDef[] = [
  { id: 'screenshot',        label: 'Screenshot',   Icon: Camera      },
  { id: 'lock_screen',       label: 'Lock Screen',  Icon: Lock        },
  { id: 'sleep',             label: 'Sleep',        Icon: Moon        },
  { id: 'shut_down',         label: 'Shut Down',    Icon: Power       },
  { id: 'restart',           label: 'Restart',      Icon: RotateCcw   },
  { id: 'task_manager',      label: 'Task Manager', Icon: Activity    },
  { id: 'calculator',        label: 'Calculator',   Icon: Calculator  },
  { id: 'empty_recycle_bin', label: 'Empty Bin',    Icon: Trash2      },
  { id: 'clipboard',         label: 'Clipboard',    Icon: Clipboard   },
  { id: 'run',               label: 'Run',          Icon: Play        },
  { id: 'custom',            label: 'Custom Action',Icon: Wrench      },
]

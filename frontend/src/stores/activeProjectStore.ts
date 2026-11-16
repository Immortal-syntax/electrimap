import { create } from 'zustand'
import { DEMO_PROJECT_ID } from '../components/layout/navigationConfig'

export interface ActiveProjectMeta {
  name: string
  district?: string | null
  state?: string | null
}

interface ActiveProjectStore {
  projectsById: Record<string, ActiveProjectMeta>
  setProjectMeta: (id: string, meta: ActiveProjectMeta) => void
  setProjectsList: (items: Array<{ id: string; name: string; target_district?: string | null; target_state?: string | null }>) => void
  resetUserProjects: () => void
}

const DEFAULT_PROJECTS_MAP: Record<string, ActiveProjectMeta> = {
  [DEMO_PROJECT_ID]: {
    name: 'Koraput — Bheja Reference Study',
    district: 'Koraput',
    state: 'Odisha',
  },
}

export const useActiveProjectStore = create<ActiveProjectStore>((set) => ({
  projectsById: { ...DEFAULT_PROJECTS_MAP },
  setProjectMeta: (id, meta) =>
    set((state) => ({
      projectsById: {
        ...state.projectsById,
        [id]: meta,
      },
    })),
  setProjectsList: (items) =>
    set((state) => {
      const next = { ...state.projectsById }
      for (const item of items) {
        next[item.id] = {
          name: item.name,
          district: item.target_district,
          state: item.target_state,
        }
      }
      return { projectsById: next }
    }),
  resetUserProjects: () => set({ projectsById: { ...DEFAULT_PROJECTS_MAP } }),
}))

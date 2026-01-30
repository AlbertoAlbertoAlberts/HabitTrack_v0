import { forwardRef } from 'react'
import styles from './LabMenu.module.css'

interface LabMenuProps {
  context: 'projects' | 'tags'
  isEditMode: boolean
  isDeleteMode: boolean
  isReorderMode: boolean
  onAddNew: () => void
  onToggleEdit: () => void
  onToggleDelete: () => void
  onToggleReorder: () => void
  onClose: () => void
}

export const LabMenu = forwardRef<HTMLDetailsElement, LabMenuProps>(
  ({ onAddNew, onToggleEdit, onToggleDelete, onToggleReorder, onClose }, ref) => {
    return (
      <details className={styles.menu} ref={ref}>
        <summary className={styles.menuButton} aria-label="Atvērt izvēlni" title="Izvēlne">
          ☰
        </summary>
        <div className={styles.menuPanel}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onToggleReorder()
            }}
          >
            Pārkārtot
          </button>
          
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onToggleDelete()
            }}
          >
            Dzēst
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onToggleEdit()
            }}
          >
            Rediģēt
          </button>
          
          <hr className={styles.menuDivider} />

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onAddNew()
            }}
          >
            Pievienot jaunu
          </button>
        </div>
      </details>
    )
  }
)

LabMenu.displayName = 'LabMenu'

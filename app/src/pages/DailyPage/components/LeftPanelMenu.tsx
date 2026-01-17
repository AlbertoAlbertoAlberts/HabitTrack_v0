import { forwardRef, useRef } from 'react'

import styles from './LeftPanelMenu.module.css'

interface LeftPanelMenuProps {
  isReorderMode: boolean
  isDeleteMode: boolean
  isPriorityEdit: boolean
  isRenameMode: boolean
  onToggleReorder: () => void
  onToggleDelete: () => void
  onTogglePriorityEdit: () => void
  onToggleRename: () => void
  onAddHabit: () => void
  onAddCategory: () => void
  onExport: () => void
  onImportFile: (file: File) => Promise<void>
  onClose: () => void
}

export const LeftPanelMenu = forwardRef<HTMLDetailsElement, LeftPanelMenuProps>(
  (
    {
      isReorderMode,
      isDeleteMode,
      isPriorityEdit,
      isRenameMode,
      onToggleReorder,
      onToggleDelete,
      onTogglePriorityEdit,
      onToggleRename,
      onAddHabit,
      onAddCategory,
      onExport,
      onImportFile,
      onClose,
    },
    ref,
  ) => {
    const importFileInputRef = useRef<HTMLInputElement>(null)

    return (
      <details className={styles.menu} ref={ref}>
        <summary className={styles.menuButton} aria-label="Atvērt darbību izvēlni" title="Izvēlne">
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
              onTogglePriorityEdit()
            }}
            disabled={!isPriorityEdit && (isDeleteMode || isReorderMode)}
          >
            Rediģēt prioritātes
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onToggleRename()
            }}
            disabled={!isRenameMode && (isDeleteMode || isReorderMode || isPriorityEdit)}
          >
            Rediģēt paradumus
          </button>

          <hr className={styles.menuDivider} />

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onAddHabit()
            }}
          >
            + Ieradumu
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onAddCategory()
            }}
          >
            + Kategorija
          </button>

          <hr className={styles.menuDivider} />

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              onExport()
            }}
          >
            Eksportēt datus
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose()
              importFileInputRef.current?.click()
            }}
          >
            Importēt datus
          </button>

          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                await onImportFile(file)
              }
            }}
            onClick={(e) => {
              // Reset value to allow re-importing the same file
              ;(e.target as HTMLInputElement).value = ''
            }}
          />
        </div>
      </details>
    )
  },
)

LeftPanelMenu.displayName = 'LeftPanelMenu'


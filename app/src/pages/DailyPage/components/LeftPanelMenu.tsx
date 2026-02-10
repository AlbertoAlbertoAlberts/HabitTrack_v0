import { forwardRef, useRef } from 'react'

import uiStyles from '../DailyShared.module.css'

interface LeftPanelMenuProps {
  isReorderMode: boolean
  isDeleteMode: boolean
  isRenameMode: boolean
  onToggleReorder: () => void
  onToggleDelete: () => void
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
      isRenameMode,
      onToggleReorder,
      onToggleDelete,
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
      <details className={uiStyles.menu} ref={ref}>
        <summary className={uiStyles.menuButton} aria-label="Atvērt darbību izvēlni" title="Izvēlne">
          ☰
        </summary>
        <div className={uiStyles.menuPanel}>
          <button
            type="button"
            className={uiStyles.menuItem}
            onClick={() => {
              onClose()
              onToggleReorder()
            }}
          >
            Pārkārtot
          </button>
          <button
            type="button"
            className={uiStyles.menuItem}
            onClick={() => {
              onClose()
              onToggleDelete()
            }}
          >
            Dzēst
          </button>

          <button
            type="button"
            className={uiStyles.menuItem}
            onClick={() => {
              onClose()
              onToggleRename()
            }}
            disabled={!isRenameMode && (isDeleteMode || isReorderMode)}
          >
            Rediģēt
          </button>

          <hr className={uiStyles.menuDivider} />

          <button
            type="button"
            className={uiStyles.menuItem}
            onClick={() => {
              onClose()
              onAddHabit()
            }}
          >
            + Ieradumu
          </button>

          <button
            type="button"
            className={uiStyles.menuItem}
            onClick={() => {
              onClose()
              onAddCategory()
            }}
          >
            + Kategorija
          </button>

          <hr className={uiStyles.menuDivider} />

          <button
            type="button"
            className={uiStyles.menuItem}
            onClick={() => {
              onClose()
              onExport()
            }}
          >
            Eksportēt datus
          </button>

          <button
            type="button"
            className={uiStyles.menuItem}
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


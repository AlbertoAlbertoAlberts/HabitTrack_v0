import { useState } from 'react'
import { Dialog, DialogBody, DialogFooter } from '../../../components/ui/Dialog'
import { useAppState, useAppStore } from '../../../domain/store/useAppStore'
import type { LabTagCategory } from '../../../domain/types'
import styles from './TagCategoryDialog.module.css'

interface TagCategoryDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
}

export function TagCategoryDialog({ open, onClose, projectId }: TagCategoryDialogProps) {
  const store = useAppStore()
  const state = useAppState()

  const categoriesMap = state.lab?.tagCategoriesByProject?.[projectId] ?? {}
  const categoryOrder = state.lab?.tagCategoryOrderByProject?.[projectId] ?? []
  const categories: LabTagCategory[] = categoryOrder
    .map((id) => categoriesMap[id])
    .filter(Boolean)

  // Append any categories not in the order array
  const orderedSet = new Set(categoryOrder)
  const unordered = Object.values(categoriesMap).filter((c) => !orderedSet.has(c.id))
  const allCategories = [...categories, ...unordered]

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    const duplicate = allCategories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setError('A category with this name already exists.')
      return
    }

    store.actions.addLabTagCategory(projectId, trimmed)
    setNewName('')
    setError(null)
  }

  const handleStartEdit = (cat: LabTagCategory) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setError(null)
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const trimmed = editingName.trim()
    if (!trimmed) return

    const duplicate = allCategories.some(
      (c) => c.id !== editingId && c.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setError('A category with this name already exists.')
      return
    }

    store.actions.updateLabTagCategory(projectId, editingId, { name: trimmed })
    setEditingId(null)
    setEditingName('')
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
    setError(null)
  }

  const handleDelete = (categoryId: string) => {
    store.actions.deleteLabTagCategory(projectId, categoryId)
    if (editingId === categoryId) {
      setEditingId(null)
      setEditingName('')
    }
    setError(null)
  }

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const ids = allCategories.map((c) => c.id)
    const temp = ids[index - 1]
    ids[index - 1] = ids[index]
    ids[index] = temp
    store.actions.reorderLabTagCategories(projectId, ids)
  }

  const handleMoveDown = (index: number) => {
    if (index >= allCategories.length - 1) return
    const ids = allCategories.map((c) => c.id)
    const temp = ids[index + 1]
    ids[index + 1] = ids[index]
    ids[index] = temp
    store.actions.reorderLabTagCategories(projectId, ids)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (editingId) {
        handleSaveEdit()
      } else {
        handleAdd()
      }
    }
    if (e.key === 'Escape' && editingId) {
      handleCancelEdit()
    }
  }

  return (
    <Dialog open={open} title="Manage Tag Categories" onClose={onClose}>
      <DialogBody>
        {allCategories.length === 0 ? (
          <div className={styles.emptyText}>
            No categories yet. Add one below to organize your tags.
          </div>
        ) : (
          <div className={styles.list}>
            {allCategories.map((cat, index) => (
              <div key={cat.id} className={styles.categoryRow}>
                <div className={styles.orderBtns}>
                  <button
                    type="button"
                    className={styles.btnIcon}
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={styles.btnIcon}
                    onClick={() => handleMoveDown(index)}
                    disabled={index === allCategories.length - 1}
                    aria-label="Move down"
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>

                {editingId === cat.id ? (
                  <input
                    type="text"
                    className={styles.editInput}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                ) : (
                  <div className={styles.categoryName}>{cat.name}</div>
                )}

                {editingId === cat.id ? (
                  <>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      onClick={handleSaveEdit}
                      aria-label="Save"
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      onClick={handleCancelEdit}
                      aria-label="Cancel"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      onClick={() => handleStartEdit(cat)}
                      aria-label="Edit"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                      onClick={() => handleDelete(cat.id)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.addInput}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="New category name"
          />
          <button
            type="button"
            className={styles.btnAdd}
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            Add
          </button>
        </div>
      </DialogBody>

      <DialogFooter>
        <button type="button" className={styles.btnClose} onClick={onClose}>
          Close
        </button>
      </DialogFooter>
    </Dialog>
  )
}

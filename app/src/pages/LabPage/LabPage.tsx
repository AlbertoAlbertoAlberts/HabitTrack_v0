import { useState, useRef, useEffect } from 'react'
import sharedStyles from '../../components/ui/shared.module.css'
import { useAppState, useAppStore } from '../../domain/store/useAppStore'
import type { LabTagDef } from '../../domain/types'
import { formatTagNameDisplay } from '../../domain/lab/utils/tagDisplay'
import { ProjectDialog } from './components/ProjectDialog'
import { TagDialog } from './components/TagDialog'
import { EventLogList } from './components/EventLogList'
import { DatasetDebugView } from './components/DatasetDebugView'
import { FindingsView } from './components/FindingsView'
import { LabErrorBoundary } from './components/ErrorBoundary'
import { LabMenu } from './components/LabMenu'
import styles from './LabPage.module.css'

export function LabPage() {
  const store = useAppStore()
  const state = useAppState()
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [isEditModeProjects, setIsEditModeProjects] = useState(false)
  const [isDeleteModeProjects, setIsDeleteModeProjects] = useState(false)
  const [isReorderingProjects, setIsReorderingProjects] = useState(false)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [isEditModeTags, setIsEditModeTags] = useState(false)
  const [isDeleteModeTags, setIsDeleteModeTags] = useState(false)
  const [isReorderingTags, setIsReorderingTags] = useState(false)
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null)
  const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<string | null>(null)
  const [tagsNotice, setTagsNotice] = useState<string | null>(null)
  const projectMenuRef = useRef<HTMLDetailsElement>(null)
  const tagMenuRef = useRef<HTMLDetailsElement>(null)

  const lab = state.lab
  const activeProjectId = lab?.ui?.activeProjectId ?? null

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectMenuRef.current?.open && !projectMenuRef.current.contains(e.target as Node)) {
        projectMenuRef.current.open = false
      }
      if (tagMenuRef.current?.open && !tagMenuRef.current.contains(e.target as Node)) {
        tagMenuRef.current.open = false
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Reconcile projectOrder so all known projects show up in the sidebar.
  useEffect(() => {
    if (!lab) return
    const existingIds = Object.keys(lab.projects)
    const orderedSet = new Set(lab.projectOrder)
    const missingIds = existingIds.filter((id) => !orderedSet.has(id))
    if (missingIds.length === 0) return
    store.actions.reorderLabProjects([...lab.projectOrder, ...missingIds])
  }, [lab, store.actions])

  if (!lab) {
    return (
      <div className={sharedStyles.page}>
        <section className={sharedStyles.panel}>
          <div className={styles.emptyState} aria-busy="true">
            <div className={styles.emptyTitle}>Loading LAB</div>
            <div className={styles.emptyBody}>Preparing your projects, tags, and analysis.</div>
          </div>
        </section>
      </div>
    )
  }

  const orderedSet = new Set(lab.projectOrder)
  const missingIds = Object.keys(lab.projects).filter((id) => !orderedSet.has(id))
  const allProjectIds = [...lab.projectOrder, ...missingIds]
  const projects = allProjectIds.map((id) => lab.projects[id]).filter((p) => p && !p.archived)

  const activeProject = activeProjectId ? lab.projects[activeProjectId] : null
  const activeTags: LabTagDef[] =
    activeProject && activeProjectId
      ? (lab.tagOrderByProject[activeProjectId]
          ?.map((id: string) => lab.tagsByProject[activeProjectId][id])
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name, 'lv')) || [])
      : []

  const handleAddProject = () => {
    setEditingProjectId(null)
    setProjectDialogOpen(true)
  }

  const handleEditProject = (projectId: string) => {
    setEditingProjectId(projectId)
    setProjectDialogOpen(true)
  }

  const handleDeleteProject = (projectId: string) => {
    setDeleteConfirmProjectId(projectId)
  }

  const confirmDeleteProject = () => {
    if (!deleteConfirmProjectId) return
    store.actions.archiveLabProject(deleteConfirmProjectId)
    if (activeProjectId === deleteConfirmProjectId) {
      store.actions.setActiveLabProject(null)
    }
    setDeleteConfirmProjectId(null)
    setIsDeleteModeProjects(false)
  }

  const handleAddTag = () => {
    if (!activeProjectId) return
    setEditingTagId(null)
    setTagDialogOpen(true)
  }

  const handleEditTag = (tagId: string) => {
    setEditingTagId(tagId)
    setTagDialogOpen(true)
  }

  const handleDeleteTag = (tagId: string) => {
    if (!activeProjectId) return
    
    const isInUse = store.selectors.isLabTagInUse(activeProjectId, tagId)
    if (isInUse) {
      setTagsNotice('Cannot delete this tag because it is used in event logs.')
      return
    }

    setDeleteConfirmTagId(tagId)
  }

  const confirmDeleteTag = () => {
    if (!deleteConfirmTagId || !activeProjectId) return
    store.actions.deleteLabTag(activeProjectId, deleteConfirmTagId)
    setDeleteConfirmTagId(null)
    setIsDeleteModeTags(false)
  }

  return (
    <div className={sharedStyles.page}>
      <div className={styles.layout}>
        <div className={styles.projectsArea}>
          <section className={sharedStyles.panel}>
            <div className={styles.headerRow}>
              <h1 className={styles.title}>LAB PROJECTS</h1>
              {(isEditModeProjects || isDeleteModeProjects || isReorderingProjects) ? (
                <button
                  className={styles.btnClose}
                  onClick={() => {
                    setIsEditModeProjects(false)
                    setIsDeleteModeProjects(false)
                    setIsReorderingProjects(false)
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              ) : (
                <LabMenu
                  ref={projectMenuRef}
                  context="projects"
                  isEditMode={isEditModeProjects}
                  isDeleteMode={isDeleteModeProjects}
                  isReorderMode={isReorderingProjects}
                  onAddNew={handleAddProject}
                  onToggleEdit={() => setIsEditModeProjects(!isEditModeProjects)}
                  onToggleDelete={() => setIsDeleteModeProjects(!isDeleteModeProjects)}
                  onToggleReorder={() => setIsReorderingProjects(!isReorderingProjects)}
                  onClose={() => { if (projectMenuRef.current) projectMenuRef.current.open = false }}
                />
              )}
            </div>

            {projects.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>No projects yet</div>
                <div className={styles.emptyBody}>
                  Create a LAB project to start tracking patterns and correlations in your data.
                </div>
              </div>
            ) : (
              <div className={styles.projectList}>
                {projects.map((project, index) => (
                  <div
                    key={project.id}
                    className={[
                      styles.projectCard,
                      activeProjectId === project.id && styles.projectCardActive,
                      isReorderingProjects && styles.projectCardDraggable,
                      dragOverProjectId === project.id && styles.projectCardDragOver
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (isEditModeProjects || isDeleteModeProjects || isReorderingProjects) return
                      store.actions.setActiveLabProject(project.id)
                    }}
                    draggable={isReorderingProjects}
                    onDragStart={(e) => {
                      if (!isReorderingProjects) return
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', JSON.stringify({ index, projectId: project.id }))
                    }}
                    onDragOver={(e) => {
                      if (!isReorderingProjects) return
                      e.preventDefault()
                      setDragOverProjectId(project.id)
                    }}
                    onDragLeave={() => {
                      if (!isReorderingProjects) return
                      setDragOverProjectId(null)
                    }}
                    onDrop={(e) => {
                      if (!isReorderingProjects) return
                      e.preventDefault()
                      setDragOverProjectId(null)
                      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                      if (data.index !== index) {
                        const reordered = [...projects]
                        const [moved] = reordered.splice(data.index, 1)
                        reordered.splice(index, 0, moved)
                        store.actions.reorderLabProjects(reordered.map(p => p.id))
                      }
                    }}
                  >
                    <div className={styles.projectHeader}>
                      <div className={styles.projectName}>{project.name}</div>
                      <div className={styles.projectBadge}>{project.mode}</div>
                    </div>
                    <div className={styles.projectMeta}>
                      {project.config.kind === 'daily' && (
                        <span>{project.config.outcome.name} ({project.config.outcome.scale.min}–{project.config.outcome.scale.max})</span>
                      )}
                      {project.config.kind === 'event' && <span>{project.config.event.name}</span>}
                    </div>
                    {isEditModeProjects && (
                      <button
                        className={styles.btnIconOverlay}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditProject(project.id)
                        }}
                        aria-label="Edit"
                      >
                        ✎
                      </button>
                    )}
                    {isDeleteModeProjects && (
                      <button
                        className={styles.btnDelete}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProject(project.id)
                        }}
                        aria-label="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className={styles.analysisArea}>
          {activeProject && (
            <LabErrorBoundary>
              <section className={sharedStyles.panel}>
                <h2 className={styles.subtitle}>Analysis for {activeProject.name}</h2>
                <FindingsView projectId={activeProjectId!} onEditProject={handleEditProject} />
              </section>
            </LabErrorBoundary>
          )}

          {!activeProject && (
            <section className={sharedStyles.panel}>
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>Select a project</div>
                <div className={styles.emptyBody}>
                  Choose a project from the left to view analysis and manage tags.
                </div>
              </div>
            </section>
          )}
        </div>

        {activeProject && (
          <div className={styles.tagsArea}>
            <section className={sharedStyles.panel}>
              <div className={styles.headerRow}>
                <h2 className={styles.subtitle}>Tags</h2>
                {(isEditModeTags || isDeleteModeTags || isReorderingTags) ? (
                  <button
                    className={styles.btnClose}
                    onClick={() => {
                      setIsEditModeTags(false)
                      setIsDeleteModeTags(false)
                      setIsReorderingTags(false)
                    }}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                ) : (
                  <LabMenu
                    ref={tagMenuRef}
                    context="tags"
                    isEditMode={isEditModeTags}
                    isDeleteMode={isDeleteModeTags}
                    isReorderMode={isReorderingTags}
                    onAddNew={handleAddTag}
                    onToggleEdit={() => setIsEditModeTags(!isEditModeTags)}
                    onToggleDelete={() => setIsDeleteModeTags(!isDeleteModeTags)}
                    onToggleReorder={() => setIsReorderingTags(!isReorderingTags)}
                    onClose={() => { if (tagMenuRef.current) tagMenuRef.current.open = false }}
                  />
                )}
              </div>

              {tagsNotice && (
                <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                  <div className={styles.noticeText}>{tagsNotice}</div>
                  <button
                    type="button"
                    className={styles.noticeBtn}
                    onClick={() => setTagsNotice(null)}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {activeTags.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>No tags yet</div>
                  <div className={styles.emptyBody}>Add tags to track different factors for this project.</div>
                </div>
              ) : (
                <div className={styles.tagList}>
                  {activeTags.map((tag, index) => (
                    <div
                      key={tag.id}
                      className={[
                        styles.tagCard,
                        isReorderingTags && styles.tagCardDraggable,
                        dragOverTagId === tag.id && styles.tagCardDragOver
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      draggable={isReorderingTags}
                      onDragStart={(e) => {
                        if (!isReorderingTags) return
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', JSON.stringify({ index, tagId: tag.id }))
                      }}
                      onDragOver={(e) => {
                        if (!isReorderingTags) return
                        e.preventDefault()
                        setDragOverTagId(tag.id)
                      }}
                      onDragLeave={() => {
                        if (!isReorderingTags) return
                        setDragOverTagId(null)
                      }}
                      onDrop={(e) => {
                        if (!isReorderingTags) return
                        e.preventDefault()
                        setDragOverTagId(null)
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                        if (data.index !== index && activeProjectId) {
                          const reordered = [...activeTags]
                          const [moved] = reordered.splice(data.index, 1)
                          reordered.splice(index, 0, moved)
                          store.actions.reorderLabTags(activeProjectId, reordered.map((t) => t.id))
                        }
                      }}
                    >
                      <div className={styles.tagHeader}>
                        <div className={styles.tagName}>{formatTagNameDisplay(tag.name)}</div>
                        {tag.group && <div className={styles.tagGroup}>{tag.group}</div>}
                      </div>
                      {tag.intensity?.enabled && (
                        <div className={styles.tagMeta}>
                          Intensity: {tag.intensity.min}–{tag.intensity.max}
                          {tag.intensity.unitLabel && ` ${tag.intensity.unitLabel}`}
                        </div>
                      )}
                      {isEditModeTags && (
                        <button
                          className={styles.btnIconOverlay}
                          onClick={(e) => {
                            e.stopPropagation()
                            setTagsNotice(null)
                            handleEditTag(tag.id)
                          }}
                          aria-label="Edit"
                        >
                          ✎
                        </button>
                      )}
                      {isDeleteModeTags && (
                        <button
                          className={styles.btnDelete}
                          onClick={(e) => {
                            e.stopPropagation()
                            setTagsNotice(null)
                            handleDeleteTag(tag.id)
                          }}
                          aria-label="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeProject.mode === 'event' && (
                <EventLogList
                  projectId={activeProjectId!}
                  onEditProject={() => handleEditProject(activeProjectId!)}
                />
              )}
            </section>
          </div>
        )}
      </div>

      <DatasetDebugView />

      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        projectId={editingProjectId}
      />

      {activeProjectId && tagDialogOpen && (
        <TagDialog
          key={`${activeProjectId}:${editingTagId ?? 'new'}`}
          open={tagDialogOpen}
          onClose={() => setTagDialogOpen(false)}
          projectId={activeProjectId}
          tagId={editingTagId}
        />
      )}

      {deleteConfirmProjectId && (
        <div className={styles.deleteOverlay}>
          <div className={styles.deleteDialog}>
            <div className={styles.deleteMessage}>
              Archive this project? (It will be hidden but not deleted)
            </div>
            <div className={styles.deleteActions}>
              <button
                className={styles.deleteBtn}
                onClick={() => setDeleteConfirmProjectId(null)}
              >
                Atcelt
              </button>
              <button
                className={`${styles.deleteBtn} ${styles.deleteBtnDanger}`}
                onClick={confirmDeleteProject}
              >
                Dzēst
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmTagId && (
        <div className={styles.deleteOverlay}>
          <div className={styles.deleteDialog}>
            <div className={styles.deleteMessage}>
              Delete this tag permanently?
            </div>
            <div className={styles.deleteActions}>
              <button
                className={styles.deleteBtn}
                onClick={() => setDeleteConfirmTagId(null)}
              >
                Atcelt
              </button>
              <button
                className={`${styles.deleteBtn} ${styles.deleteBtnDanger}`}
                onClick={confirmDeleteTag}
              >
                Dzēst
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LabPage


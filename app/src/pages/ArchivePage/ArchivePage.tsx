import { Link } from 'react-router-dom'

import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'

import sharedStyles from '../../components/ui/shared.module.css'
import styles from './ArchivePage.module.css'

function formatCompletedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  // Latvian locale formatting (local time) – display only.
  const date = d.toLocaleDateString('lv-LV')
  const time = d.toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export function ArchivePage() {
  const state = useAppState()

  const items = Object.values(state.todoArchive)
    .slice()
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  return (
    <div className={sharedStyles.page}>
      <section className={sharedStyles.panel}>
        <div className={styles.header}>
          <h1 className={styles.title}>Arhīvs</h1>
          <Link to="/" className={sharedStyles.smallBtn} style={{ textDecoration: 'none' }}>
            Atpakaļ
          </Link>
        </div>

        {items.length === 0 ? <p className={styles.empty}>Arhīvs ir tukšs.</p> : null}

        <div className={styles.list}>
          {items.map((it) => (
            <div key={it.id} className={styles.item}>
              <div>
                <div className={styles.itemTitle} title={it.text}>
                  {it.text}
                </div>
                <div className={styles.meta}>Pabeigts: {formatCompletedAt(it.completedAt)}</div>
                {it.restoredAt ? (
                  <div className={styles.meta}>Atjaunots: {formatCompletedAt(it.restoredAt)}</div>
                ) : null}
              </div>

              <button
                type="button"
                className={sharedStyles.smallBtn}
                disabled={Boolean(it.restoredAt)}
                onClick={() => appStore.actions.restoreTodo(it.id)}
              >
                Atjaunot
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default ArchivePage

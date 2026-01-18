import sharedStyles from '../../components/ui/shared.module.css'
import styles from './LabPage.module.css'

export function LabPage() {
  return (
    <div className={[sharedStyles.page, styles.page].filter(Boolean).join(' ')}>
      <section className={[sharedStyles.panel, styles.panel].filter(Boolean).join(' ')}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>LAB</h1>
          <div className={styles.subtitle}>Sandbox area for experiments and future features.</div>
        </div>
      </section>

      <section className={[sharedStyles.panel, styles.panel].filter(Boolean).join(' ')}>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Nothing here yet</div>
          <div className={styles.emptyBody}>
            Build whatever you want here — layout/theme already matches the rest of the app.
          </div>
        </div>
      </section>
    </div>
  )
}

export default LabPage

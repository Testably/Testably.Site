/**
 * Shows the code block of a diagnostic entry that reports the diagnostic `id` and swaps in the fixed code block
 * on request. Both blocks are children of the component, the mistake first. With `migrateTo`, the first block is
 * not a mistake but code that can be migrated to that library, so it is shown neutrally and the migrated block in
 * the color of the library's section.
 */
import React, {Children, useState, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

export default function ApplyFix({id, migrateTo, children}: {
  id: string;
  migrateTo?: string;
  children: ReactNode;
}): ReactElement {
  const [original, fixed] = Children.toArray(children);
  const [isFixed, setFixed] = useState(false);
  const label = migrateTo
    ? {badge: 'MIGRATED', fixed: `Migrated to ${migrateTo}.`, original: 'Migration available.', apply: 'Migrate'}
    : {badge: 'FIXED', fixed: 'No diagnostic.', original: `This code reports ${id}.`, apply: 'Apply fix'};
  return (
    <div className={clsx(styles.applyFix, migrateTo && styles.isMigration, isFixed && styles.isFixed)}>
      {isFixed ? fixed : original}
      <div className={styles.bar} aria-live="polite">
        <span className={styles.badge}>{isFixed ? label.badge : id}</span>
        <span className={styles.status}>{isFixed ? label.fixed : label.original}</span>
        <button type="button" className={styles.button} onClick={() => setFixed(!isFixed)}>
          {isFixed ? 'Undo' : label.apply}
        </button>
      </div>
    </div>
  );
}

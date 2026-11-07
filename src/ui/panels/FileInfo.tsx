import { useEditor } from '../../store/editor';
import { formatBytes } from '../../export/exporter';

export function FileInfo() {
  const source = useEditor((s) => s.source);
  if (!source) return null;
  const duration = source.delays.reduce((a, b) => a + b, 0) / 1000;
  const loop = source.loopCount == null ? 'פעם אחת' : source.loopCount === 0 ? 'אינסופית' : `${source.loopCount + 1} פעמים`;
  const rows: [string, string][] = [
    ['שם הקובץ', source.fileName],
    ['ממדים', `${source.width} × ${source.height} px`],
    ['פריימים', String(source.frameCount)],
    ['משך כולל', `${duration.toFixed(2)} שניות`],
    ['גודל בדיסק', formatBytes(source.fileSize)],
    ['לולאה', source.frameCount > 1 ? loop : '—'],
    ['שקיפות', source.hasAlpha ? 'יש' : 'אין']
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-bold text-accent">מאפייני הקובץ</h2>
      </div>
      <dl className="space-y-2 p-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="min-w-0 truncate text-left font-medium" dir="auto" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="px-4 text-xs text-ink-faint">בחרו שכבת טקסט כדי לערוך אותה, או הוסיפו שכבה חדשה עם T.</p>
    </div>
  );
}

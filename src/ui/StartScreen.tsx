import { useEffect, useState } from 'react';
import { Clock, ImagePlus, Trash } from 'lucide-react';
import { deleteProject, listRecent, type RecentEntry } from '../persist/autosave';
import { openFile, openRecent, pickFile } from '../app/actions';
import { ACCEPT, SUPPORTED_LABEL } from '../decode/load';

export function StartScreen() {
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  useEffect(() => {
    listRecent().then(setRecent);
  }, []);

  const choose = async () => {
    const f = await pickFile(`${ACCEPT},.json`);
    if (f) await openFile(f);
  };

  return (
    <main className="scroll-thin flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-[radial-gradient(circle_at_15%_10%,#e9e2ff,transparent_45%),radial-gradient(circle_at_90%_90%,#ffe0ea,transparent_40%)] px-4 py-10">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">עורך טקסט לגיפים</h1>
        <p className="mt-2 text-ink-soft">
          אוגר סיני זקן פעם אמר: "מה, נריץ?"
          <br />
          יהי סקוויקו ברוך
        </p>

        <button
          type="button"
          onClick={choose}
          className="focus-ring group mt-8 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent/40 bg-white/70 px-6 py-16 text-center shadow-sm transition hover:border-accent hover:bg-white"
        >
          <span className="rounded-full bg-accent-soft p-4 text-accent transition group-hover:scale-105">
            <ImagePlus size={32} />
          </span>
          <span className="text-lg font-bold text-ink">גררו לכאן גיף, או לחצו לבחירת קובץ</span>
          <span className="text-sm text-ink-soft">אפשר גם להדביק מהלוח (Ctrl+V). פורמטים: {SUPPORTED_LABEL}, או קובץ פרויקט.</span>
          <span className="btn-accent mt-2 px-5">בחירת קובץ</span>
        </button>

        {recent.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-soft">
              <Clock size={15} /> פרויקטים אחרונים
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {recent.map((r) => (
                <li key={r.id} className="group relative overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:border-accent">
                  <button type="button" className="focus-ring block w-full text-right" onClick={() => openRecent(r.id)}>
                    <div className="checker flex aspect-video items-center justify-center overflow-hidden">
                      {r.thumb ? <img src={r.thumb} alt="" className="max-h-full max-w-full object-contain" /> : null}
                    </div>
                    <div className="p-2">
                      <div className="truncate text-sm font-medium" dir="auto" title={r.name}>
                        {r.name}
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        {new Date(r.updatedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })} · {r.width}×{r.height}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="focus-ring absolute left-1.5 top-1.5 rounded-md bg-white/90 p-1 text-ink-soft opacity-0 shadow transition hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`מחיקת הפרויקט ${r.name}`}
                    onClick={async () => {
                      await deleteProject(r.id);
                      setRecent(await listRecent());
                    }}
                  >
                    <Trash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

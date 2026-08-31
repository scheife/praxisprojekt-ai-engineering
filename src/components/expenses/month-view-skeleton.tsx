import { Skeleton } from '@/components/ui/skeleton'
import { Wordmark } from '@/components/wordmark'

/**
 * Der Ladezustand von `/` — Skeletons in `--muted` an der Stelle des künftigen Inhalts, kein
 * Spinner-Overlay (docs/design-system.md §8).
 *
 * Er hängt an einer **Suspense-Grenze in der Seite** und nicht an einer `app/loading.tsx`:
 * Eine Ladedatei direkt unter `src/app/` gälte auch für `/login` und `/signup` — die gehören
 * PROJ-1, haben ein anderes Layout und würden hier das Gerüst der Monatsansicht zeigen
 * (design.md, TD-12).
 */
export function MonthViewSkeleton() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-4 px-5">
          <Wordmark className="text-xl" />
          <div className="flex flex-1 justify-center">
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-40" />
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>

          <Skeleton className="h-[7.5rem] w-full rounded-xl" />

          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </main>
    </>
  )
}

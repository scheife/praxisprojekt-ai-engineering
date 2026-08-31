import { Skeleton } from '@/components/ui/skeleton'
import { Wordmark } from '@/components/wordmark'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/** Skeletons in `--muted` an der Stelle des künftigen Inhalts, kein Spinner-Overlay. */
export default function KontoLoading() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-4 px-5">
          <Wordmark className="text-xl" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-28" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 py-10">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-52" />
            </div>
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>

        {/* PROJ-2 · der Export-Abschnitt (AC-27). */}
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-64" />
          </CardContent>
        </Card>
      </main>
    </>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
import { Wordmark } from '@/components/wordmark'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/** Skeletons in `--muted` an der Stelle des künftigen Inhalts, kein Spinner-Overlay. */
export default function KontoLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-6 px-5 py-12">
      <Wordmark className="text-2xl" />
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
    </main>
  )
}

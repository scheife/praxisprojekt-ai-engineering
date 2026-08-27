import { cn } from '@/lib/utils'

/**
 * Die Wortmarke `auslage.`
 *
 * Ein Wort, Space Grotesk Bold, Kleinschreibung. Wort in --foreground, **Punkt in Olive**.
 * Der Punkt gehört dazu und fällt nie weg — wie bei `alex macht.`
 * Nie ein Symbol, Monogramm oder Icon danebenstellen (docs/design-system.md §2).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-grotesk font-bold lowercase tracking-[-0.02em] text-foreground',
        className,
      )}
    >
      auslage<span className="text-primary">.</span>
    </span>
  )
}

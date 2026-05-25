import { useState, type ReactNode } from 'react'

export function Section({
  title,
  action,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
}) {
  const [open, setOpen] = useState(!defaultCollapsed)

  const header = (
    <header className="mb-3 flex items-baseline justify-between">
      <h2 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {collapsible && (
          <span
            aria-hidden
            className={`inline-block text-[8px] transition-transform ${open ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
        )}
        {title}
      </h2>
      {action}
    </header>
  )

  if (!collapsible) {
    return (
      <section className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
        {header}
        {children}
      </section>
    )
  }

  return (
    <section className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="block w-full text-left"
        aria-expanded={open}
      >
        {header}
      </button>
      {open && children}
    </section>
  )
}

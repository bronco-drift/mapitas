import type { ReactNode } from 'react'

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-slate-100 px-5 py-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

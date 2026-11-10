import type { ReactNode } from 'react'

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="market-page-header">
      <div>
        {eyebrow && <span className="market-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="market-page-actions">{actions}</div>}
    </header>
  )
}

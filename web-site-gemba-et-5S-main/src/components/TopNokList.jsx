export default function TopNokList({ items }) {
  if (items.length === 0) return <p className="muted">Aucun point NOK.</p>
  return (
    <ol className="nok-list">
      {items.map((n) => (
        <li key={n.q}>
          <strong>{n.count}×</strong> — {n.q}
        </li>
      ))}
    </ol>
  )
}

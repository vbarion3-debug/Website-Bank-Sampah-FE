// Markdown ringan yang sama dengan editor pengumuman di admin: **tebal**, *miring*, "- " bullet

function parseInline(line, keyPrefix) {
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
  const nodes = []
  let lastIndex = 0
  let match
  let i = 0

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index))
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[1]}</strong>)
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{match[2]}</em>)
    }
    lastIndex = regex.lastIndex
    i += 1
  }

  if (lastIndex < line.length) nodes.push(line.slice(lastIndex))
  return nodes
}

// Versi teks polos untuk pratinjau singkat
export function stripMarkdown(text = '') {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^\s*-\s+/gm, '• ')
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
}

export default function RichText({ text, className = '' }) {
  if (!text) return null
  const lines = String(text).split('\n')

  return (
    <div className={className}>
      {lines.map((line, idx) => {
        if (line.trim().startsWith('- ')) {
          return (
            <div key={idx} className="flex gap-2">
              <span className="shrink-0">•</span>
              <span>{parseInline(line.trim().slice(2), idx)}</span>
            </div>
          )
        }
        if (!line.trim()) return <br key={idx} />
        return (
          <p key={idx} className="mb-1 last:mb-0">
            {parseInline(line, idx)}
          </p>
        )
      })}
    </div>
  )
}

const PROMPTS = [
  'What should my next semester look like?',
  'What are the prerequisites for CSCI306?',
  'How do I schedule a CASA advising appointment?',
  'Draft an email to my advisor summarizing my plan',
]

export default function SuggestedPrompts({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="suggested">
      {PROMPTS.map((p) => (
        <button key={p} className="chip" onClick={() => onPick(p)}>
          {p}
        </button>
      ))}
    </div>
  )
}

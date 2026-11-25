// Client-side privacy guardrail (proposal: "never ask for a name, student ID, or grades").
// Runs before a message leaves the browser. It is a best-effort pattern check, not a
// guarantee, so the backend should run its own check too (see docs/api-contract.md).

export type PiiKind = 'cwid' | 'grade' | 'name' | 'contact'

export interface PiiFinding {
  kind: PiiKind
  match: string // the sensitive text itself
}

interface Rule {
  kind: PiiKind
  // Group 1 = context kept on redaction (may be empty), group 2 = the sensitive text.
  re: RegExp
}

const B = '(?=[\\s.,!?;:)]|$)' // end of a grade token

const RULES: Rule[] = [
  // ---- CWID / student ID ----
  { kind: 'cwid', re: /((?:cwid|student\s*(?:id|number)|id\s*(?:#|number))\s*(?:is|:|#|=)?\s*)(\d{5,10})/gi },
  { kind: 'cwid', re: /()\b(\d{8,9})\b/g }, // Mines CWIDs are 8 digits

  // ---- Grades ----
  // "I got a B+", "earned an A-", "ended up with a C" (grade letters must be uppercase)
  {
    kind: 'grade',
    re: new RegExp(
      `((?:[Gg]ot|[Ee]arned|[Rr]eceived|[Mm]ade|[Hh]ad|[Ee]nded up with|[Pp]ulled)\\s+(?:an?\\s+)?)([A-DF][+-]?)${B}(?!\\s*or\\s+(?:better|higher|above))`,
      'g',
    ),
  },
  // "my grade was a C", "grade: B", "scored 72%" (but not "a grade of C- or better")
  {
    kind: 'grade',
    re: new RegExp(
      `((?:[Mm]y\\s+)?(?:[Gg]rade|[Ss]core|[Mm]ark)\\s*(?:was|is|:|=)\\s*(?:an?\\s+)?)([A-DF][+-]?${B}|\\d{1,3}(?:\\.\\d+)?\\s?%)(?!\\s*or\\s+(?:better|higher|above))`,
      'g',
    ),
  },
  { kind: 'grade', re: /((?:[Ss]cored|[Gg]ot)\s+(?:an?\s+)?)(\d{1,3}(?:\.\d+)?\s?%)/g },
  // "my GPA is 3.2", "GPA: 2.85", "I have a 3.4 GPA"
  { kind: 'grade', re: /((?:[Mm]y\s+)?(?:cumulative\s+|overall\s+|major\s+)?GPA\s*(?:is|was|of|:|=)\s*(?:about|around|like|a)?\s*)([0-4]\.\d{1,2})/gi },
  { kind: 'grade', re: /((?:[Hh]ave|[Gg]ot|[Hh]ad)\s+an?\s+)([0-4]\.\d{1,2})(?=\s*GPA)/g },
  // "CSCI101: B", "MATH111 - A-"
  { kind: 'grade', re: new RegExp(`(\\b[A-Z]{4}\\s?\\d{3}\\s*[:=–-]\\s*)([A-DF][+-]?)${B}(?!\\s+[a-z])`, 'g') },
  // "I failed CSCI261"
  { kind: 'grade', re: /(\b[Ii]\s+(?:have\s+)?)(failed|flunked)\b/g },

  // ---- Names ----
  {
    kind: 'name',
    re: /((?:[Mm]y\s+name\s+is|[Mm]y\s+name's|\b[Nn]ame\s*:|\b[Cc]all\s+me)\s+)([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){0,2})/g,
  },
  { kind: 'name', re: /(\b(?:I'm|I’m|I\s+am)\s+)([A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+)\b/g },
  // Email-style sign-off on its own line: "Thanks,\nJane Doe"
  {
    kind: 'name',
    re: /((?:^|\n|[.!?]\s+)\s*(?:[Tt]hanks|[Tt]hank\s+you|[Bb]est|[Ss]incerely|[Rr]egards|[Cc]heers)[,!.]?\s*(?:\n\s*|-\s*|,\s*))([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)\s*$/g,
  },

  // ---- Contact info (identifies the student just like a name) ----
  { kind: 'contact', re: /()([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g },
  { kind: 'contact', re: /()(\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b)/g },
]

const PLACEHOLDER: Record<PiiKind, string> = {
  cwid: '[CWID removed]',
  grade: '[grade removed]',
  name: '[name removed]',
  contact: '[contact info removed]',
}

export const KIND_LABEL: Record<PiiKind, string> = {
  cwid: 'a CWID / student ID',
  grade: 'a grade or GPA',
  name: 'a name',
  contact: 'an email address or phone number',
}

/** Kinds that are never needed for advising, so "send anyway" is not offered. */
export const BLOCKING_KINDS: PiiKind[] = ['cwid', 'contact']

export function detectPii(text: string): PiiFinding[] {
  const found: PiiFinding[] = []
  for (const { kind, re } of RULES) {
    for (const m of text.matchAll(re)) {
      const match = m[2]?.trim()
      if (match && !found.some((f) => f.match === match)) found.push({ kind, match })
    }
  }
  return found
}

export function redactPii(text: string): string {
  let out = text
  for (const { kind, re } of RULES) out = out.replace(re, (_m, keep: string) => `${keep}${PLACEHOLDER[kind]}`)
  return out
}

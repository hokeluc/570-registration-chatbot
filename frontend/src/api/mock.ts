import type { ChatRequest, ChatResponse } from './types'

// Fake backend so the UI can be built and demoed before Flask exists.
// Each branch exercises a different part of the UI (citations, warnings,
// profile updates, email drafts). Responses are synthetic, not real advice.

const today = new Date().toISOString().slice(0, 10)

export async function mockChat(req: ChatRequest): Promise<ChatResponse> {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 600))
  const last = req.messages[req.messages.length - 1]?.content.toLowerCase() ?? ''
  const { profile } = req

  if (last.includes('fail')) throw new Error('Mock error: backend unavailable')

  if (last.includes('prereq')) {
    return {
      reply:
        '**CSCI306 – Software Engineering** requires:\n\n- CSCI210 – Systems Programming, **and**\n- one of CSCI220 – Data Structures and Algorithms *or* CSCI262 – Data Structures\n\n_(Mock answer, real data comes from the catalog tool.)_',
      citations: [
        {
          title: 'CSCI306 – Course Catalog',
          url: 'https://catalog.mines.edu/search/?P=CSCI306',
          last_updated: '2025-06-12',
          accessed: today,
          catalog_year: profile.catalog_year,
        },
      ],
      profile_updates: [],
    }
  }

  if (last.includes('taken') || last.includes('completed') || last.includes('took')) {
    const course = last.match(/[a-z]{4}\s?\d{3}/)?.[0]?.replace(/\s/, '').toUpperCase() ?? 'CSCI101'
    return {
      reply: `Got it. It sounds like you've completed **${course}**. Should I add it to your profile so future suggestions skip it?`,
      citations: [],
      profile_updates: [
        { field: 'completed_courses', op: 'add', value: course, reason: `You said you've taken ${course}.` },
      ],
    }
  }

  if (last.includes('email')) {
    return {
      reply:
        "Here's a draft you can edit and send yourself:\n\n```email\nSubject: Spring course plan — questions before registration\n\nHi [Advisor name],\n\nI'm a " +
        `${profile.majors.join(' / ')} student (catalog ${profile.catalog_year ?? 'unknown'}) and I'd like to check my plan for next semester:\n\n` +
        '- CSCI306 – Software Engineering\n- MATH334 – Probability\n- MATH322 – Linear Algebra\n- Focus area course\n\n' +
        'Questions:\n1. Does this plan keep me on track to graduate in ' +
        `${profile.grad_year}?\n2. Are there any holds or requirements I'm missing?\n\nThank you,\n[Your name]\n` +
        '```',
      citations: [],
      profile_updates: [],
    }
  }

  if (last.includes('offered') || last.includes('2027')) {
    return {
      reply:
        'Historically this course has been offered in **fall** semesters. Mines does not publish future offerings, so treat this as a guess and check the schedule of classes when it is released.',
      citations: [
        {
          title: 'Registrar – Registration Information',
          url: 'https://registrar.mines.edu/registration-information/',
          last_updated: '2025-10-01',
          accessed: today,
        },
      ],
      profile_updates: [],
      warnings: ['This is a prediction based on past semesters, not a guarantee the course will be offered.'],
    }
  }

  if (last.includes('casa') || last.includes('advisor') || last.includes('appointment')) {
    return {
      reply:
        'You can request an advising appointment through CASA. Fill out the advising request form on the CASA website and an advisor will reach out to schedule.',
      citations: [
        { title: 'CASA – Academic Advising', url: 'https://www.mines.edu/casa/', accessed: today },
      ],
      profile_updates: [],
    }
  }

  return {
    reply: `This is a **mock** reply. Once the Flask backend is running, answers will come from the Mines catalog and Minesflow.\n\nYour profile: ${profile.majors.join(' + ')}${profile.track ? ` (${profile.track})` : ''}, entered ${profile.entry_term}, catalog ${profile.catalog_year ?? 'not set'}.\n\nTry asking about **prereqs**, **email**, **offered**, **CASA**, or say "I've taken MATH111".`,
    citations: [],
    profile_updates: [],
  }
}

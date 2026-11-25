import type { OptionsResponse } from './types'

// Used until GET /api/options exists (Person 3 will serve this from Minesflow data).
// Placeholder lists: verify names against the current catalog before the demo.
export const FALLBACK_OPTIONS: OptionsResponse = {
  majors: [
    { id: 'amst', name: 'Applied Mathematics & Statistics', tracks: [] },
    { id: 'cheng', name: 'Chemical Engineering', tracks: [] },
    { id: 'chem', name: 'Chemistry', tracks: [] },
    { id: 'ceng', name: 'Civil Engineering', tracks: [] },
    {
      id: 'csci',
      name: 'Computer Science',
      tracks: [
        'General',
        'Business',
        'Computer Engineering',
        'Cybersecurity',
        'Data Science',
        'Robotics & Intelligent Systems',
        'Research Honors',
      ],
    },
    { id: 'deng', name: 'Design Engineering', tracks: [] },
    { id: 'econ', name: 'Economics', tracks: [] },
    { id: 'eeng', name: 'Electrical Engineering', tracks: [] },
    { id: 'ephy', name: 'Engineering Physics', tracks: [] },
    { id: 'envi', name: 'Environmental Engineering', tracks: [] },
    { id: 'geol', name: 'Geological Engineering', tracks: [] },
    { id: 'gphy', name: 'Geophysical Engineering', tracks: [] },
    { id: 'meng', name: 'Mechanical Engineering', tracks: [] },
    { id: 'mtgn', name: 'Metallurgical & Materials Engineering', tracks: [] },
    { id: 'mnge', name: 'Mining Engineering', tracks: [] },
    { id: 'pegn', name: 'Petroleum Engineering', tracks: [] },
    { id: 'qbio', name: 'Quantitative Biosciences', tracks: [] },
  ],
  minors: [
    'Computer Science',
    'Data Science',
    'Economics',
    'Mathematics',
    'Physics',
    'Robotics',
    'Space and Planetary Science',
    'Humanitarian Engineering',
  ],
  catalog_years: ['2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027'],
}

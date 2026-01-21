const knowledgeBase = [
  {
    id: 'cycle-count-file-failed-view-error',
    title: 'Failed file: View error panel',
    summary:
      'When a cycle count upload fails, the View error panel shows row-level validation errors.',
    steps: [
      'Open Cycle Count > Imports and select the Failed Files tab.',
      'Click View error for the failed file to see row-level messages.',
      'Download the error report and fix the fields called out in each row.',
      'Re-upload the corrected file and confirm it moves to the Processed tab.'
    ],
    tags: ['cycle count', 'file import', 'errors', 'view error'],
    triggers: ['failed file', 'view error', 'upload', 'import']
  },
  {
    id: 'cycle-count-investigate-variance',
    title: 'Investigate a variance before recount',
    summary:
      'Use variance checks to confirm whether a mismatch is real or caused by missing scans.',
    steps: [
      'Verify the location is correct and scan the location again.',
      'Check for recent moves, picks, or replenishments for the SKU.',
      'Confirm the unit of measure and pack size match the expected count.',
      'If the variance remains, proceed with the recount workflow.'
    ],
    tags: ['cycle count', 'variance', 'recount', 'inventory'],
    triggers: ['variance', 'mismatch', 'recount', 'count off']
  },
  {
    id: 'cycle-count-file-format-checks',
    title: 'Cycle count file format checks',
    summary: 'Most import errors come from missing required fields or invalid formats.',
    steps: [
      'Confirm required columns are present and match the template headers.',
      'Validate that SKU and location values match the system master data.',
      'Check date and quantity formats for invalid characters or decimals.',
      'Ensure there are no extra delimiters or blank rows in the file.'
    ],
    tags: ['cycle count', 'file format', 'template', 'validation'],
    triggers: ['template', 'columns', 'format', 'missing fields']
  }
];

function normalize(value) {
  return value.toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function scoreEntry(entry, tokens) {
  if (tokens.length === 0) {
    return 0;
  }

  const haystack = [
    entry.title,
    entry.summary,
    ...(entry.steps ?? []),
    ...entry.tags,
    ...(entry.triggers ?? [])
  ]
    .map((value) => normalize(value))
    .join(' ');

  return tokens.reduce((score, token) => {
    return score + (haystack.includes(token) ? 1 : 0);
  }, 0);
}

function searchKnowledge(query, limit = 5) {
  const tokens = tokenize(query);
  const matches = knowledgeBase
    .map((entry) => ({ ...entry, score: scoreEntry(entry, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (limit <= 0) {
    return matches;
  }

  return matches.slice(0, limit);
}

module.exports = {
  searchKnowledge
};

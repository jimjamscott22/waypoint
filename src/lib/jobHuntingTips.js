export const TIP_INDEX_STORAGE_KEY = 'waypoint.tipIndex.v1';

export const JOB_HUNTING_TIPS = [
  {
    category: 'Resume & ATS',
    title: 'Mirror the exact role vocabulary',
    body: 'Read the top three requirements in the job posting and weave those exact phrases into your summary and experience bullets so both automated screens and hurried recruiters spot the match immediately.',
  },
  {
    category: 'Applications',
    title: 'Apply within the first 48 hours',
    body: 'Fresh listings receive the most recruiter attention before candidate queues overflow. Check your daily matches early and prioritize high-fit postings while they are new.',
  },
  {
    category: 'Outreach',
    title: 'Send a concise hiring-manager note',
    body: 'Pair your application with a four-sentence message to the hiring manager or team lead naming the role, one relevant result you have delivered, and why their team caught your eye.',
  },
  {
    category: 'Follow-up',
    title: 'Set a 5-to-7 business day follow-up date',
    body: 'Whenever you submit an application, schedule a concrete next-action reminder a week out. A polite check-in keeps your application warm without feeling pushy.',
  },
  {
    category: 'Resume & ATS',
    title: 'Lead bullets with measurable outcomes',
    body: 'Structure experience bullets around impact—what changed, by how much, and using which tools—rather than listing routine duties.',
  },
  {
    category: 'Networking',
    title: 'Ask for 15-minute informational chats',
    body: 'People are far more likely to accept a brief, low-pressure conversation about their team culture and day-to-day work than an open-ended request for a referral.',
  },
  {
    category: 'Pipeline hygiene',
    title: 'Keep your active priority list focused',
    body: 'Rank your top five saved roles and work through them before opening dozens of new tabs. Steady, high-quality applications beat scattered volume.',
  },
  {
    category: 'Interviews',
    title: 'Prepare five versatile STAR stories',
    body: 'Write down five real examples covering troubleshooting, teamwork, tight deadlines, learning a new system, and handling a mistake. You can adapt those five stories to almost any behavioral question.',
  },
  {
    category: 'Research',
    title: 'Study the company’s tech stack and pain points',
    body: 'Look at several open listings at the same employer to see which systems, migrations, or support challenges they mention repeatedly, then speak to those themes in your cover note and interview.',
  },
  {
    category: 'Interviews',
    title: 'Bring three sharp questions for the interviewer',
    body: 'Ask what success looks like in the first 90 days, what the team’s biggest current bottleneck is, and how new hires ramp up. Thoughtful questions signal genuine engagement.',
  },
  {
    category: 'Follow-up',
    title: 'Send thank-you notes within 24 hours',
    body: 'Reference one specific topic from your conversation in your thank-you email so each interviewer remembers the discussion and sees how attentively you listened.',
  },
  {
    category: 'Search strategy',
    title: 'Search adjacent titles in the same role family',
    body: 'Employers label identical work differently—help desk, desktop support, service desk, and field technician often overlap. Cast a wide title net and filter by actual responsibilities.',
  },
  {
    category: 'Applications',
    title: 'Apply directly on the employer’s career page',
    body: 'When you discover a role on an aggregator board, check the company’s own careers portal to confirm the listing is still active and submit directly into their applicant tracking system.',
  },
  {
    category: 'Qualifications',
    title: 'Treat job descriptions as wish lists, not checklists',
    body: 'If you meet roughly 60–70% of the core requirements and can show how quickly you learn the rest, submit the application instead of self-selecting out.',
  },
  {
    category: 'Momentum',
    title: 'Time-box daily job search blocks',
    body: 'Split your search into focused blocks—reviewing new matches, tailoring two applications, and sending one follow-up—so you make consistent daily progress without burning out.',
  },
  {
    category: 'Online presence',
    title: 'Align your LinkedIn headline with your target role',
    body: 'Include your target job title, core technical skills, and location in your headline so recruiters searching by keyword immediately understand where you fit.',
  },
  {
    category: 'Negotiation',
    title: 'Research local compensation ranges early',
    body: 'Compare posted salary bands across similar roles in your metro area before your first phone screen so you can state a grounded, confident range when asked.',
  },
  {
    category: 'Pipeline hygiene',
    title: 'Archive stalled roles to keep your view clear',
    body: 'If an application has had no response after two follow-ups and several weeks, move it to Closed so your dashboard highlights the opportunities you can still influence.',
  },
  {
    category: 'Hands-on proof',
    title: 'Highlight home labs and practical projects',
    body: 'When commercial experience in a tool is light, document a small lab, script, or troubleshooting walkthrough you built yourself to prove hands-on curiosity.',
  },
  {
    category: 'Interviews',
    title: 'Narrate your troubleshooting thought process',
    body: 'When answering technical scenario questions, walk through how you isolate variables, check logs, verify assumptions, and communicate with users—even if you do not know the exact command offhand.',
  },
];

export function normalizeTipIndex(index, total = JOB_HUNTING_TIPS.length) {
  if (total <= 0) return 0;
  const parsed = Number.parseInt(index, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed % total;
}

export function nextTipIndex(currentIndex, total = JOB_HUNTING_TIPS.length) {
  if (total <= 0) return 0;
  return (normalizeTipIndex(currentIndex, total) + 1) % total;
}

let currentSessionTipState = null;

export function getStartupTip(storage = globalThis.localStorage, tips = JOB_HUNTING_TIPS) {
  if (!currentSessionTipState) {
    currentSessionTipState = advanceStoredTip(storage, tips);
  }
  return currentSessionTipState;
}

export function resetSessionTipForTests() {
  currentSessionTipState = null;
}

export function advanceStoredTip(storage = globalThis.localStorage, tips = JOB_HUNTING_TIPS) {
  const total = tips.length;
  if (total === 0) return { index: 0, total: 0, tip: null };

  let raw = null;
  try {
    raw = storage?.getItem?.(TIP_INDEX_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }

  const index = normalizeTipIndex(raw, total);
  const next = nextTipIndex(index, total);

  try {
    storage?.setItem?.(TIP_INDEX_STORAGE_KEY, String(next));
  } catch {
    // Still works when storage is unavailable.
  }

  const state = {
    index,
    total,
    tip: tips[index],
  };
  currentSessionTipState = state;
  return state;
}

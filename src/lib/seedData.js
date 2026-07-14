export const JOB_STAGES = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Closed'];
export const STAGES = ['All', ...JOB_STAGES];

export const INITIAL_JOBS = [
  { id: 'job-1', role: 'Systems Administrator', company: 'Corvid Managed Services', stage: 'Interviewing', location: 'Remote (US)', salary: '$75–90k', contact: 'Marcus Lee · IT Dir.', next: 'Tech interview · Jul 14', urgent: true },
  { id: 'job-2', role: 'Help Desk Team Lead', company: 'Brightpath Credit Union', stage: 'Interviewing', location: 'Madison, WI', salary: '$60–70k', contact: 'Priya Raman · HR', next: 'Panel interview · Jul 17', urgent: false },
  { id: 'job-3', role: 'Cloud Support Associate', company: 'Nimbus Hosting', stage: 'Applied', location: 'Remote (US)', salary: '$65–78k', contact: '—', next: 'Follow up · Jul 16', urgent: false },
  { id: 'job-4', role: 'IT Support Specialist II', company: 'Northlake Health System', stage: 'Applied', location: 'Madison, WI · hybrid', salary: '$58–68k', contact: 'Dana Whitfield · HR', next: 'Follow up · Jul 15', urgent: false },
  { id: 'job-5', role: 'Network Administrator', company: 'Lakeview School District', stage: 'Applied', location: 'Middleton, WI', salary: '$62–74k', contact: 'jobs@lakeview.k12', next: 'Follow up due today', urgent: true },
  { id: 'job-6', role: 'Junior Systems Engineer', company: 'Halberd Logistics', stage: 'Saved', location: 'Sun Prairie, WI', salary: '$70–82k', contact: '—', next: 'Tailor resume & apply', urgent: false },
  { id: 'job-7', role: 'IT Operations Technician', company: 'Meridian Colo', stage: 'Saved', location: 'Verona, WI · onsite', salary: '$55–64k', contact: '—', next: 'Research team on LinkedIn', urgent: false },
  { id: 'job-8', role: 'Desktop Support Analyst', company: 'Kettering College', stage: 'Closed', location: 'Madison, WI', salary: '$52–60k', contact: 'HR portal', next: 'Closed Jul 1 · keep contact', urgent: false },
];

export const INITIAL_QUEUE = [
  { id: 'queue-1', role: 'Systems Administrator (Linux)', company: 'Fairwater Insurance Group', match: '92% match', meta: 'Remote · $78–92k · posted 1d ago · via "Sysadmin · remote"' },
  { id: 'queue-2', role: 'IT Support Specialist', company: 'Oakline Veterinary Partners', match: '84% match', meta: 'Madison, WI · $56–63k · posted 3d ago · via "IT support · Madison"' },
  { id: 'queue-3', role: 'Network Admin I', company: 'Talgrove Manufacturing', match: '77% match', meta: 'Waunakee, WI · hybrid · posted 2d ago · via "Network admin"' },
];

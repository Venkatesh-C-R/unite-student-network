// Content for the landing page. Scores and rules come from the approved UNITE spec.

export const PROGRAMMES = [
  { level: 'BE/BTech', name: 'Automobile Engineering' },
  { level: 'BE/BTech', name: 'Biomedical Engineering' },
  { level: 'BE/BTech', name: 'Civil Engineering' },
  { level: 'BE/BTech', name: 'Computer Science and Engineering' },
  { level: 'BE/BTech', name: 'Computer Science and Engineering (AI and ML)' },
  { level: 'BE/BTech', name: 'Electrical and Electronics Engineering' },
  { level: 'BE/BTech', name: 'Electronics and Communication Engineering' },
  { level: 'BE/BTech', name: 'Instrumentation and Control Engineering' },
  { level: 'BE/BTech', name: 'Mechanical Engineering' },
  { level: 'BE/BTech', name: 'Production Engineering' },
  { level: 'BE/BTech', name: 'Robotics and Automation' },
  { level: 'BE/BTech', name: 'Bio Technology' },
  { level: 'BE/BTech', name: 'Fashion Technology' },
  { level: 'BE/BTech', name: 'Information Technology' },
  { level: 'BE/BTech', name: 'Textile Technology' },
  { level: 'BE/BTech', name: 'Metallurgical Engineering' },
  { level: 'BE/BTech', name: 'Mechanical Engineering (Sandwich)' },
  { level: 'BSc', name: 'Applied Science' },
  { level: 'BSc', name: 'Computer Systems and Design' },
  { level: 'ME/MTech', name: 'Automotive Engineering' },
  { level: 'ME/MTech', name: 'Biometrics and Cybersecurity' },
  { level: 'ME/MTech', name: 'Computer Science and Engineering' },
  { level: 'ME/MTech', name: 'Control Systems' },
  { level: 'ME/MTech', name: 'Embedded & Real-Time Systems' },
  { level: 'ME/MTech', name: 'Engineering Design' },
  { level: 'ME/MTech', name: 'Industrial Engineering' },
  { level: 'ME/MTech', name: 'Manufacturing Engineering' },
  { level: 'ME/MTech', name: 'Power Electronics and Drives' },
  { level: 'ME/MTech', name: 'Structural Engineering' },
  { level: 'ME/MTech', name: 'VLSI Design' },
  { level: 'ME/MTech', name: 'Bio Technology' },
  { level: 'ME/MTech', name: 'Nano Science and Technology' },
  { level: 'ME/MTech', name: 'Textile Technology' },
  { level: 'ME/MTech', name: 'Industrial Metallurgy' },
  { level: 'MSc', name: 'Applied Mathematics' },
  { level: 'MSc', name: 'Computational Finance' },
  { level: 'MSc', name: 'Cyber Security' },
  { level: 'MSc', name: 'Data Science' },
  { level: 'MSc', name: 'Software Systems' },
  { level: 'MSc', name: 'Theoretical Computer Science' },
  { level: 'MSc', name: 'Fashion Design & Merchandising' },
  { level: 'MCA', name: 'Master of Computer Applications' },
  { level: 'MBA', name: 'MBA' },
  { level: 'MBA', name: 'MBA (Waste Management & Social Entrepreneurship)' },
].map((p, i) => ({ ...p, id: i + 1, label: `${p.level} · ${p.name}` }))

export const MAX_GROUP_SIZE = 6

export const HOST_CATEGORIES = [
  { key: 'college', label: 'College', multiplier: 1.0, hint: 'Hosted by PSG Tech or another PSG institution' },
  { key: 'state', label: 'State', multiplier: 1.5, hint: 'Hosted by any other college, even outside Tamil Nadu' },
  { key: 'national', label: 'National', multiplier: 2.0, hint: 'Hosted by an Institute of National Importance' },
]

export const POSITIONS = [
  { key: '1', label: '1st place', base: 100 },
  { key: '2', label: '2nd place', base: 70 },
  { key: '3', label: '3rd place', base: 50 },
  { key: '4', label: '4th place', base: 45 },
  { key: '5', label: '5th place', base: 40 },
  { key: '6', label: '6th place', base: 35 },
  { key: '7', label: '7th place', base: 30 },
  { key: '8', label: '8th place', base: 25 },
  { key: '9', label: '9th place', base: 20 },
  { key: '10', label: '10th place', base: 15 },
  { key: 'p', label: 'Participation', base: 10 },
]

export function points(positionKey, categoryKey) {
  const base = POSITIONS.find((p) => p.key === positionKey).base
  const m = HOST_CATEGORIES.find((c) => c.key === categoryKey).multiplier
  return base * m
}

// Demo data only — fictional groups, each with ≤ 6 members from distinct programmes.
export const DEMO_GROUPS = [
  {
    name: 'Team Nova',
    programmes: ['BE CSE', 'BE Mechanical', 'BE Fashion Tech', 'MCA', 'MSc Data Science', 'ME VLSI'],
    wins: [['1', 'national'], ['3', 'state']],
  },
  {
    name: 'Circuit Breakers',
    programmes: ['BE EEE', 'BE ECE', 'ME CSE', 'BE Civil', 'MBA'],
    wins: [['1', 'state'], ['2', 'college'], ['p', 'national']],
  },
  {
    name: 'Bio Bytes',
    programmes: ['BE Biomedical', 'BE Bio Tech', 'BE IT', 'MSc Cyber Security'],
    wins: [['2', 'national'], ['5', 'college']],
  },
  {
    name: 'Loom & Logic',
    programmes: ['BE Textile Tech', 'MSc Software Systems', 'BE Robotics', 'BSc Applied Science', 'ME Engineering Design', 'MCA'],
    wins: [['1', 'college'], ['4', 'state']],
  },
  {
    name: 'Prime Movers',
    programmes: ['BE Automobile', 'ME Automotive', 'BE Production'],
    wins: [['2', 'state'], ['p', 'college']],
  },
].map((g) => ({ ...g, total: g.wins.reduce((s, [pos, cat]) => s + points(pos, cat), 0) }))
  .sort((a, b) => b.total - a.total)

export const STEPS = [
  { title: 'Sign up with your college ID', body: 'Register with your PSG email (rollno@psgtech.ac.in) and verify with a one-time password.' },
  { title: 'Build your profile', body: 'Keep it simple — About, Interests and Links to GitHub, LinkedIn, LeetCode or anything else.' },
  { title: 'Discover and connect', body: 'Find students across programmes who share your interests and send friend requests.' },
  { title: 'Form or join a group', body: 'Up to six members, one from each programme. The server checks every join.' },
  { title: 'Compete together', body: 'Plan meetups with group polls, then take on hackathons, paper presentations and competitions.' },
  { title: 'Submit proof, earn points', body: 'Upload a certificate or result. Faculty verify it, and approved points lift your group up the leaderboard.' },
]

export const DOWNLOADS = [
  { title: 'Project Abstract', desc: 'Four-page abstract: idea, end users, feasibility, modules and scoring.', file: 'UNITE_Abstract.pdf', type: 'PDF', size: '56 KB', pages: '4 pages' },
  { title: 'Design Document', desc: 'Requirements, flow diagram, database schema, use cases, modules and timeline.', file: 'UNITE_Design_Document.pdf', type: 'PDF', size: '384 KB', pages: '9 pages' },
  { title: 'Rules & Scoring Guide', desc: 'One-page summary of the six-member rule, host categories and the points table.', file: 'UNITE_Rules_and_Scoring_Guide.pdf', type: 'PDF', size: '176 KB', pages: '1 page' },
  { title: 'Eligible Programmes', desc: 'Preliminary list of the 44 PSG programmes, grouped by degree level.', file: 'UNITE_Eligible_Programmes.pdf', type: 'PDF', size: '132 KB', pages: '1 page' },
  { title: 'Database Schema', desc: 'Simplified eight-table overview of the UNITE database.', file: 'UNITE_Database_Schema.png', type: 'PNG', size: '114 KB', pages: 'Diagram' },
  { title: 'Use Case Diagram', desc: 'UML use cases for students and faculty / admin.', file: 'UNITE_Use_Case_Diagram.png', type: 'PNG', size: '122 KB', pages: 'Diagram' },
]

export const TEAM = [
  { name: 'Bala Subramanian B', roll: '26MX310' },
  { name: 'Nareshwaran J', roll: '26MX331' },
  { name: 'Venkatesh C R', roll: '26MX354' },
]

export const RULES = [
  'A student can be in only one union at a time.',
  'A union has up to six members, each from a different programme.',
  'Each union has one leader and can have one second in command.',
  'The leader or second in command approves join requests.',
  'If the leader leaves, the second in command takes over.',
  'Only results approved by faculty earn points.',
]

export const FAQS = [
  { q: 'Who can join UNITE?', a: 'Students of PSG College of Technology (and the eligible PSG Institute of Management programmes). Sign-up uses your college email, rollno@psgtech.ac.in. PhD and research programmes are not included for now.' },
  { q: 'Why only one student per programme?', a: 'UNITE is built for interdisciplinary teamwork. One member per programme means every union mixes different skills — a designer, an engineer, a data scientist and more.' },
  { q: 'Can I switch to another union?', a: 'Yes. Leave your current union, then ask to join the new one. When a union accepts you, your other pending requests are cancelled.' },
  { q: 'Who is the leader?', a: 'Whoever creates the union. The leader can name one member as second in command and change that choice at any time.' },
  { q: 'Are BE CSE and ME CSE the same programme?', a: 'No. Degree level and programme name together identify a programme, so a BE CSE student and an ME CSE student can be in the same union.' },
  { q: 'Can I be friends with someone from my own programme?', a: 'Yes. The one-per-programme rule applies only to unions, not to friendships.' },
  { q: 'What if an event needs more than six people?', a: 'Two or more unions can team up for that event. Each union keeps its own members and limits — unions are never merged.' },
  { q: 'How are points decided?', a: 'By your result and the host institution: College ×1.0, State ×1.5 (any other college) and National ×2.0 (Institutes of National Importance).' },
  { q: 'How do we plan meetups?', a: 'With union polls — members vote on the time and place.' },
]

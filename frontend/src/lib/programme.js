// Short, readable programme labels for chips, e.g. "BE CSE", "ME VLSI", "MSc DS".
const ABBR = {
  'Computer Science and Engineering': 'CSE',
  'Computer Science and Engineering (AI and ML)': 'CSE AIML',
  'Electrical and Electronics Engineering': 'EEE',
  'Electronics and Communication Engineering': 'ECE',
  'Instrumentation and Control Engineering': 'ICE',
  'Information Technology': 'IT',
  'Mechanical Engineering': 'Mech',
  'Mechanical Engineering (Sandwich)': 'Mech (S)',
  'Automobile Engineering': 'Auto',
  'Biomedical Engineering': 'BME',
  'Civil Engineering': 'Civil',
  'Production Engineering': 'Prod',
  'Robotics and Automation': 'RAE',
  'Bio Technology': 'Biotech',
  'Fashion Technology': 'FT',
  'Textile Technology': 'Textile',
  'Metallurgical Engineering': 'Metal',
  'Applied Science': 'Applied Sci',
  'Computer Systems and Design': 'CSD',
  'Automotive Engineering': 'Automotive',
  'Biometrics and Cybersecurity': 'Biometrics',
  'Control Systems': 'Control',
  'Embedded & Real-Time Systems': 'Embedded',
  'Engineering Design': 'Eng Design',
  'Industrial Engineering': 'Industrial',
  'Manufacturing Engineering': 'Mfg',
  'Power Electronics and Drives': 'PED',
  'Structural Engineering': 'Structural',
  'VLSI Design': 'VLSI',
  'Nano Science and Technology': 'Nano',
  'Industrial Metallurgy': 'Ind Metal',
  'Applied Mathematics': 'Maths',
  'Computational Finance': 'Comp Fin',
  'Cyber Security': 'Cyber',
  'Data Science': 'DS',
  'Software Systems': 'SS',
  'Theoretical Computer Science': 'TCS',
  'Fashion Design & Merchandising': 'FDM',
  'Master of Computer Applications': '',
  MBA: '',
  'MBA (Waste Management & Social Entrepreneurship)': 'WM&SE',
}

export function shortProgramme(level, name) {
  const lvl = level?.split('/')[0] || ''
  const abbr = ABBR[name] ?? name
  return [lvl, abbr].filter(Boolean).join(' ')
}

// Stable colour per programme id, spread around the indigo → cyan range and beyond
export function programmeColor(id) {
  const hue = (230 + ((id * 47) % 160)) % 360
  return `hsl(${hue} 75% 58%)`
}

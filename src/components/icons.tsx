// Minimal inline icons (stroke = currentColor) for the mobile tab bar.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true }

export const IconHome = () => (<svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>)
export const IconDumbbell = () => (<svg {...base}><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /></svg>)
export const IconCheck = () => (<svg {...base}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" /></svg>)
export const IconBook = () => (<svg {...base}><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" /><path d="M5 17a3 3 0 013-3h11" /></svg>)
export const IconUser = () => (<svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>)
export const IconUsers = () => (<svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><path d="M16 4.5a3.5 3.5 0 010 7M18 15c2 .6 3.2 2.2 3.8 5" /></svg>)

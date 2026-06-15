export default function Logo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Connection lines — drawn first so nodes sit on top */}
      <line x1="20" y1="20" x2="20" y2="7"  stroke="#D97757" strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
      <line x1="20" y1="20" x2="32" y2="14" stroke="#D97757" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
      <line x1="20" y1="20" x2="30" y2="29" stroke="#D97757" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="20" y1="20" x2="11" y2="31" stroke="#D97757" strokeWidth="1.2" strokeLinecap="round" opacity="0.38"/>
      <line x1="20" y1="20" x2="8"  y2="16" stroke="#D97757" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>

      {/* Secondary connections between outer nodes */}
      <line x1="20" y1="7"  x2="32" y2="14" stroke="#D97757" strokeWidth="0.8" strokeLinecap="round" opacity="0.22"/>
      <line x1="32" y1="14" x2="30" y2="29" stroke="#D97757" strokeWidth="0.8" strokeLinecap="round" opacity="0.18"/>
      <line x1="8"  y1="16" x2="11" y2="31" stroke="#D97757" strokeWidth="0.8" strokeLinecap="round" opacity="0.18"/>

      {/* Outer nodes */}
      <circle cx="20" cy="7"  r="2.8" fill="#D97757" opacity="0.75"/>
      <circle cx="32" cy="14" r="2.2" fill="#D97757" opacity="0.62"/>
      <circle cx="30" cy="29" r="2.5" fill="#D97757" opacity="0.52"/>
      <circle cx="11" cy="31" r="2.0" fill="#D97757" opacity="0.48"/>
      <circle cx="8"  cy="16" r="2.5" fill="#D97757" opacity="0.62"/>

      {/* Center node — brightest */}
      <circle cx="20" cy="20" r="4.5" fill="#D97757"/>

      {/* Center glow */}
      <circle cx="20" cy="20" r="4.5" fill="#E8956A" opacity="0.35"/>
    </svg>
  )
}

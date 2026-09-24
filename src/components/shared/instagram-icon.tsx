/** Instagram'ın resmi degrade rengiyle glif — lucide-react marka ikonu vermiyor. */
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="instagram-gradient" x1="1" y1="23" x2="23" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#instagram-gradient)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="url(#instagram-gradient)" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.15" fill="url(#instagram-gradient)" />
    </svg>
  );
}

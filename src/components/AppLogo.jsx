// The app icon at header size: the tuner's segment bar reduced to three bars,
// the teal one in the middle being "in tune". The full seven-bar version is the
// PWA/home-screen icon in public/; below ~40px it simplifies to this.
export default function AppLogo({ size = 30 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect width="100" height="100" rx="23" fill="#1f1f23" />
      <rect x="0.5" y="0.5" width="99" height="99" rx="22.5" fill="none" stroke="rgba(255,255,255,0.07)" />
      <rect x="29" y="40" width="8" height="20" rx="4" fill="#52525b" />
      <rect x="46" y="24" width="8" height="52" rx="4" fill="#2aab9e" />
      <rect x="63" y="40" width="8" height="20" rx="4" fill="#52525b" />
    </svg>
  )
}

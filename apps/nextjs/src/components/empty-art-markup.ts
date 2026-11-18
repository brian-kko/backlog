/*
 * Empty-state illustrations for Gemuzu.
 * Inlined so they follow the theme through the --art-* variables; their
 * animation classes are prefixed "ea-" and animated in styles/art.css.
 * The markup is static and ours, never user input.
 */
export const home = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 170" focusable="false">
    <g class="ea-card-hand" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="var(--art-muted)" fill="var(--card)">
        <rect x="71" y="36" width="53" height="80" rx="6" transform="rotate(-17 97 76)" />
        <rect x="136" y="36" width="53" height="80" rx="6" transform="rotate(17 163 76)" />
      </g>
      <rect x="102" y="28" width="56" height="84" rx="6" stroke="var(--art-ink)" fill="var(--card)" />
      <rect x="109" y="35" width="42" height="70" rx="3" stroke="var(--art-muted)" fill="none" />
      <path d="M130 56l11 14-11 14-11-14z" stroke="var(--art-accent)" fill="var(--art-accent)" fill-opacity="0.1" />
    </g>
    <g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M46 135h168v8H46z" stroke="var(--art-ink)" />
      <path d="M60 143v9m140-9v9" stroke="var(--art-muted)" />
    </g>
  </svg>`;

export const emptyArt = {
  home,
  library:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 26 260 170" focusable="false"><g stroke="var(--art-ink, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"> <line x1="42" y1="164" x2="258" y2="164" /> <line x1="56" y1="164" x2="56" y2="169" /> <line x1="244" y1="164" x2="244" y2="169" /> </g> <g stroke="var(--art-muted, #b6bcad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="var(--art-ink, currentColor)" fill-opacity="0.08"> <rect x="56" y="112" width="28" height="52" rx="3" /> <rect x="96" y="112" width="28" height="52" rx="3" /> <rect x="176" y="112" width="28" height="52" rx="3" /> <rect x="216" y="112" width="28" height="52" rx="3" /> </g> <g class="ea-slot-glow" stroke="var(--art-accent, #c8ed78)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"> <rect x="136" y="112" width="28" height="52" rx="3" /> </g> <g class="ea-cart" stroke="var(--art-ink, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="136" y="52" width="28" height="50" rx="4" fill="var(--art-ink, currentColor)" fill-opacity="0.12" /> <rect x="141" y="64" width="18" height="24" rx="2" fill="var(--art-ink, currentColor)" fill-opacity="0.08" /> <line x1="142" y1="96" x2="158" y2="96" stroke="var(--art-muted, #b6bcad)" /> </g></svg>',
  wishlist:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="29 5 260 170" focusable="false"><circle cx="132" cy="34" r="6" stroke="var(--art-muted, #b6bcad)" stroke-width="2" fill="none" /> <circle cx="132" cy="34" r="2" fill="var(--art-ink, currentColor)" /> <g class="ea-tag" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <line x1="132" y1="34" x2="132" y2="59" stroke="var(--art-ink, currentColor)" /> <rect x="104" y="50" width="56" height="96" rx="8" stroke="var(--art-ink, currentColor)" fill="var(--art-ink, currentColor)" fill-opacity="0.1" /> <circle cx="132" cy="63" r="4" stroke="var(--art-ink, currentColor)" fill="none" /> <line x1="116" y1="84" x2="148" y2="84" stroke="var(--art-muted, #b6bcad)" /> <line x1="116" y1="98" x2="142" y2="98" stroke="var(--art-muted, #b6bcad)" /> <line x1="116" y1="112" x2="134" y2="112" stroke="var(--art-muted, #b6bcad)" /> </g> <g class="ea-target" stroke="var(--art-accent, #c8ed78)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"> <circle cx="192" cy="136" r="16" /> <line x1="170" y1="136" x2="178" y2="136" /> <line x1="206" y1="136" x2="214" y2="136" /> <circle cx="192" cy="136" r="2" fill="var(--art-accent, #c8ed78)" /> </g></svg>',
  updates:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="1 4 260 170" focusable="false"><g stroke="var(--art-ink, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"> <line x1="108" y1="54" x2="108" y2="136" /> <line x1="101" y1="68" x2="115" y2="68" /> <circle cx="108" cy="52" r="3" fill="var(--art-ink, currentColor)" /> <path d="M 88 144 L 94 136 L 122 136 L 128 144 Z" fill="var(--art-ink, currentColor)" fill-opacity="0.12" /> </g> <g stroke="var(--art-muted, #b6bcad)" stroke-width="2" stroke-linecap="round"> <line x1="92" y1="156" x2="124" y2="156" /> <line x1="96" y1="164" x2="120" y2="164" /> </g> <g class="ea-arc1" stroke="var(--art-muted, #b6bcad)" stroke-width="2" stroke-linecap="round" fill="none"> <path d="M 128 37 A 25 25 0 0 1 128 67" /> </g> <g class="ea-arc2" stroke="var(--art-muted, #b6bcad)" stroke-width="2" stroke-linecap="round" fill="none"> <path d="M 144 25 A 45 45 0 0 1 144 79" /> </g> <g class="ea-arc3" stroke="var(--art-accent, #c8ed78)" stroke-width="2" stroke-linecap="round" fill="none"> <path d="M 160 13 A 65 65 0 0 1 160 91" /> </g></svg>',
  deals:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 13 260 170" focusable="false"><g stroke="var(--art-muted, #b6bcad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"> <rect x="86" y="48" width="104" height="28" rx="3" /> <rect x="104" y="53" width="68" height="18" rx="2" /> <rect x="94" y="84" width="104" height="28" rx="3" /> <rect x="112" y="89" width="68" height="18" rx="2" /> <rect x="88" y="120" width="104" height="28" rx="3" /> <rect x="106" y="125" width="68" height="18" rx="2" /> </g> <path d="M 147 98 H 161" stroke="var(--art-accent, #c8ed78)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <g class="ea-lens" stroke="var(--art-ink, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="154" cy="98" r="32" fill="var(--art-ink, currentColor)" fill-opacity="0.08" /> <path d="M 134 86 A 22 22 0 0 1 146 78" stroke="var(--art-muted, #b6bcad)" fill="none" /> <path d="M 179 119 L 197 137 L 193 141 L 175 123 Z" fill="var(--art-ink, currentColor)" /> </g></svg>',
} as const;

export type EmptyArtName = keyof typeof emptyArt;

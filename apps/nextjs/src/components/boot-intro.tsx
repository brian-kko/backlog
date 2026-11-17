/**
 * Gemuzu's boot moment: a cartridge drops into a slot, clicks, the slot light
 * turns lime, and the screen fades into the page, in under a second.
 *
 * It is plain server-rendered SVG animated by CSS, so it shows on the very
 * first paint (no wait for React). `bootScript` runs in <head> before paint
 * and decides whether it plays: once per browser session, never with
 * reduced motion or without JavaScript, and any click or key skips it
 * (append "?boot" to a URL to replay it on demand). The
 * overlay ignores pointer events, so the page underneath is never blocked.
 */
export const bootScript = `(function(){var d=document.documentElement;try{var force=/[?&]boot(?:[=&]|$)/.test(location.search);if(!force&&(sessionStorage.getItem("gemuzu-booted")||matchMedia("(prefers-reduced-motion: reduce)").matches)){d.dataset.boot="skip";return}sessionStorage.setItem("gemuzu-booted","1");d.dataset.boot="play";var s=function(){d.dataset.boot="skip"};addEventListener("pointerdown",s,{once:true});addEventListener("keydown",s,{once:true});setTimeout(s,1400)}catch(e){d.dataset.boot="skip"}})();`;

export function BootIntro() {
  return (
    <div className="boot" aria-hidden="true">
      <svg
        className="boot-art"
        viewBox="0 0 240 240"
        width="240"
        height="240"
        role="presentation"
      >
        {/* Cartridge, drawn first so the console front hides the inserted part */}
        <g className="boot-cart">
          <path
            className="boot-cart-shell"
            d="M74 40h92a8 8 0 0 1 8 8v100H66V48a8 8 0 0 1 8-8z"
          />
          <rect
            className="boot-cart-label"
            x="80"
            y="56"
            width="80"
            height="58"
            rx="4"
          />
          <text className="boot-cart-name" x="120" y="92" textAnchor="middle">
            GEMUZU
          </text>
          <path className="boot-cart-grip" d="M84 124h72M84 130h72M84 136h72" />
        </g>
        {/* Console slot */}
        <rect
          className="boot-console"
          x="40"
          y="138"
          width="160"
          height="64"
          rx="10"
        />
        <rect
          className="boot-slot"
          x="66"
          y="138"
          width="108"
          height="10"
          rx="3"
        />
        <circle className="boot-led" cx="182" cy="182" r="5" />
      </svg>
    </div>
  );
}

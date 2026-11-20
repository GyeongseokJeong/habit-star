import { Sparkles } from "lucide-react";

/**
 * Shared Starlit Warmth scenery. The home variant must retain the original
 * waves, glow, copy and brand, while reflection uses one quiet closing line.
 * Only one variant is rendered at a time in the home/reflection page switch,
 * so the existing SVG gradient IDs stay unchanged for visual regression.
 */
type Props =
  | { kind: "home"; completed: boolean; hidden?: boolean }
  | { kind: "reflection"; completed?: never; hidden?: never };

export function StarlitClosingFooter(props: Props) {
  const { kind } = props;
  const completed = kind === "home" && props.completed;
  const hidden = kind === "home" ? props.hidden : undefined;

  return (
    <footer className={`closing-footer ${kind === "reflection" ? "closing-footer--reflection" : ""}`} aria-label={kind === "home" ? "하루의 마무리" : "돌아보기 마무리"} hidden={hidden}>
              <div className="closing-landscape">
                <svg className="closing-waves" viewBox="0 0 420 104" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="closing-wave-distance" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" className="closing-wave-far-left" />
                      <stop offset="52%" className="closing-wave-far-middle" />
                      <stop offset="100%" className="closing-wave-far-right" />
                    </linearGradient>
                    <linearGradient id="closing-wave-foreground" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" className="closing-wave-near-top" />
                      <stop offset="66%" className="closing-wave-near-middle" />
                      <stop offset="100%" className="closing-wave-near-bottom" />
                    </linearGradient>
                    <radialGradient id="closing-horizon-glow">
                      <stop offset="0%" className="closing-horizon-core" />
                      <stop offset="44%" className="closing-horizon-mid" />
                      <stop offset="100%" stopColor="#b994d6" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="closing-wave-soften" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity=".86" />
                      <stop offset="40%" stopColor="white" stopOpacity=".63" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <mask id="closing-wave-depth-mask">
                      <rect width="420" height="104" fill="url(#closing-wave-soften)" />
                    </mask>
                  </defs>
                  <path
                    className="closing-wave-far"
                    d="M0 59 C42 40 83 34 123 52 S211 78 266 55 S365 31 420 52 V104 H0Z"
                    fill="url(#closing-wave-distance)"
                    mask="url(#closing-wave-depth-mask)"
                  />
                  {/* Diffuse light sits in the valley, partially behind the near hill; no hard highlight stroke. */}
                  <ellipse
                    className="closing-horizon-light"
                    cx="210" cy="69" rx="104" ry="23"
                    fill="url(#closing-horizon-glow)"
                  />
                  <path
                    className="closing-wave-near"
                    d="M0 76 C55 56 102 64 153 78 S251 88 306 70 S383 65 420 74 V104 H0Z"
                    fill="url(#closing-wave-foreground)"
                  />
                  <g className="closing-sky-sparks">
                    <path d="M42 29 l2 -4 2 4 4 2 -4 2 -2 4 -2 -4 -4 -2Z" />
                    <circle cx="76" cy="46" r="1.2" />
                    <path d="M373 35 l1.6 -3.2 1.6 3.2 3.2 1.6 -3.2 1.6 -1.6 3.2 -1.6 -3.2 -3.2 -1.6Z" />
                    <circle cx="347" cy="52" r="1" />
                  </g>
                </svg>
                {kind === "home" ? (
                  <>
                    <div className="closing-copy">
                      <h2>꾸준함은 완벽함보다 빛나요.</h2>
                      <p>{completed
                        ? "오늘도 한 걸음, 잘 해내고 있어요."
                        : "작은 시작도 충분히 소중해요."}</p>
                    </div>
                    <div className="closing-brand"><Sparkles size={16} aria-hidden="true" /> 별하루</div>
                  </>
                ) : (
                  <div className="closing-copy closing-reflection-copy">
                    <p>다시 시작하는 하루도 충분히 빛나요.</p>
                  </div>
                )}
              </div>
            </footer>
  );
}

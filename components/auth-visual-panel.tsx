import { AuthBrand } from "@/components/auth-brand";

const authCopy = {
  login: {
    description:
      "Keep projects, people, and progress moving in one shared workspace.",
    eyebrow: "One workspace, in sync",
    title: "Make good work easier to do.",
  },
  signup: {
    description:
      "Your administrator will prepare your account and help you get started.",
    eyebrow: "A thoughtful place to work",
    title: "Your team’s work, moving together.",
  },
} as const;

const AuthVisualPanel = ({ mode }: { mode: keyof typeof authCopy }) => {
  const copy = authCopy[mode];

  return (
    <aside
      aria-labelledby="auth-visual-title"
      className="auth-visual-panel relative isolate hidden min-h-0 overflow-hidden rounded-3xl p-7 text-white md:flex md:flex-col md:justify-between lg:p-8"
    >
      <div
        aria-hidden="true"
        className="auth-visual-glow-top pointer-events-none absolute -top-28 -right-28 size-80 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="auth-visual-glow-bottom pointer-events-none absolute -bottom-36 -left-24 size-96 rounded-full blur-3xl"
      />
      <div className="relative">
        <AuthBrand />
      </div>
      <div className="relative max-w-md pb-3">
        <div
          aria-hidden="true"
          className="auth-visual-emblem mb-8 grid size-16 place-items-center rounded-2xl border border-white/15"
        >
          <svg
            className="size-8 text-auth-highlight"
            fill="none"
            viewBox="0 0 32 32"
          >
            <path
              d="M5 24V8l11 10L27 8v16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            />
          </svg>
        </div>
        <p className="mb-3 text-xs font-semibold tracking-widest text-auth-highlight/80 uppercase">
          {copy.eyebrow}
        </p>
        <h2
          className="font-heading text-4xl leading-tight font-semibold tracking-tight"
          id="auth-visual-title"
        >
          {copy.title}
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
          {copy.description}
        </p>
      </div>
      <div className="relative flex items-center gap-2 text-xs text-white/55">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-auth-highlight"
        />
        A calmer way to keep the whole team aligned
      </div>
    </aside>
  );
};

export { AuthVisualPanel };

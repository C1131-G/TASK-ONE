import { AuthBrand } from "@/components/auth-brand";

const authCopy = {
  login: {
    description:
      "Keep projects, people, and progress moving in one shared workspace.",
    title: "Give good work a clear path.",
  },
  signup: {
    description:
      "Your administrator will prepare your account and help you get started.",
    title: "Your team’s work, moving together.",
  },
} as const;

const AuthVisualPanel = ({ mode }: { mode: keyof typeof authCopy }) => {
  const copy = authCopy[mode];

  return (
    <aside
      aria-labelledby="auth-visual-title"
      className="auth-visual-panel relative isolate hidden min-h-0 overflow-hidden text-white md:flex md:flex-col md:justify-between"
    >
      <div className="relative">
        <AuthBrand />
      </div>
      <div aria-hidden="true" className="auth-workflow">
        <span className="auth-workflow-line" />
        <span className="auth-workflow-node">
          <span className="auth-workflow-dot" />
          Plan
        </span>
        <span className="auth-workflow-node auth-workflow-node-active">
          <span className="auth-workflow-dot" />
          Focus
        </span>
        <span className="auth-workflow-node">
          <span className="auth-workflow-dot" />
          Finish
        </span>
      </div>
      <div className="auth-visual-copy relative max-w-md pb-3">
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
      <div className="auth-visual-footer relative flex items-center gap-2 text-xs text-white/55">
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

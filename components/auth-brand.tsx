const AuthBrand = () => (
  <div className="auth-brand">
    <span aria-hidden="true" className="auth-brand-mark">
      <svg fill="none" viewBox="0 0 24 24">
        <path
          d="M4.5 18V6l7.5 7 7.5-7v12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
    </span>
    <span className="auth-brand-copy">
      <span className="auth-brand-name">Metsys</span>
      <span className="auth-brand-product">Task System</span>
    </span>
  </div>
);

export { AuthBrand };

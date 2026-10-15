/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { clientStatusText } from "@/features/portal/client-status";
import {
  RatingCard,
  ReplyBox,
  VerifyActions,
} from "@/features/portal/components/portal-lifecycle-actions";
import { PortalTime } from "@/features/portal/components/portal-time";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

const closedText = {
  confirmed: "You confirmed the fix",
  no_response: "Closed because we didn't hear back",
  not_a_bug: "Closed as not a bug",
  unconfirmed: "Closed automatically after 7 days without a reply",
} as const;

const latestTeamComment = (bug: PortalBugDetail) =>
  bug.comments.findLast((comment) => comment.isTeam)?.body ?? null;

const QuestionBanner = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const { question } = bug.lifecycle;
  if (!question) {
    return null;
  }
  return (
    <section
      aria-labelledby="portal-question-h"
      className="portal-action-banner"
      data-tone="attention"
    >
      <h2 id="portal-question-h">We need more information</h2>
      <p className="faint">
        Asked <PortalTime iso={question.askedAt} />
      </p>
      {question.text ? (
        <blockquote className="portal-quote">{question.text}</blockquote>
      ) : null}
      {bug.canComment ? (
        <ReplyBox bugId={bug.id} />
      ) : (
        <p className="hint">Replies are closed on this bug.</p>
      )}
      <p className="hint">
        If we don&apos;t hear back, we&apos;ll close this bug automatically
        after 14 days without a reply.
      </p>
    </section>
  );
};

const VerifyBanner = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const { verification } = bug.lifecycle;
  if (!verification) {
    return null;
  }
  return (
    <section
      aria-labelledby="portal-verify-h"
      className="portal-action-banner"
      data-tone="attention"
    >
      <h2 id="portal-verify-h">Fix ready – please verify</h2>
      <p>
        We believe this is fixed (since <PortalTime iso={verification.since} />
        ). Please check it and let us know.
      </p>
      <VerifyActions bug={bug} />
      <p className="hint">
        If we don&apos;t hear back, we&apos;ll close this bug automatically
        after 7 days.
      </p>
    </section>
  );
};

const RatingSummary = ({
  rating,
}: {
  readonly rating: NonNullable<PortalBugDetail["lifecycle"]["rating"]>;
}) => (
  <section aria-labelledby="portal-rating-h" className="panel portal-panel">
    <h2 className="sec" id="portal-rating-h">
      Your rating
    </h2>
    <p className="portal-rating-line">
      {rating.satisfaction === "up" ? (
        <ThumbsUp aria-hidden="true" size={18} weight="fill" />
      ) : (
        <ThumbsDown aria-hidden="true" size={18} weight="fill" />
      )}
      {rating.satisfaction === "up" ? "Thumbs up" : "Thumbs down"}
    </p>
    {rating.comment ? <p className="portal-prose">{rating.comment}</p> : null}
  </section>
);

const ClosedBanner = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const { lifecycle } = bug;
  const reason = lifecycle.closedReason;
  const teamNote = reason === "not_a_bug" ? latestTeamComment(bug) : null;
  return (
    <>
      <section
        aria-labelledby="portal-closed-h"
        className="portal-action-banner"
        data-tone="neutral"
      >
        <h2 id="portal-closed-h">
          {reason ? closedText[reason] : "This bug is closed"}
        </h2>
        {teamNote ? (
          <blockquote className="portal-quote">{teamNote}</blockquote>
        ) : null}
        {lifecycle.canReportAgain ? (
          <div>
            <Link
              className="btn btn-secondary btn-sm"
              href={`/portal/new?from=${bug.id}`}
            >
              Report again
            </Link>
          </div>
        ) : null}
      </section>
      {lifecycle.canRate ? <RatingCard bugId={bug.id} /> : null}
      {lifecycle.rating ? <RatingSummary rating={lifecycle.rating} /> : null}
    </>
  );
};

const MergedPanel = ({
  duplicateOf,
}: {
  readonly duplicateOf: NonNullable<
    PortalBugDetail["lifecycle"]["duplicateOf"]
  >;
}) => (
  <section
    aria-labelledby="portal-merged-h"
    className="portal-action-banner"
    data-tone="neutral"
  >
    <h2 id="portal-merged-h">Merged – we&apos;re already tracking this</h2>
    <p>
      The original bug is currently:{" "}
      <strong>{clientStatusText[duplicateOf.status]}</strong>
    </p>
    {duplicateOf.key || duplicateOf.title ? (
      <p className="muted">
        Original:{" "}
        {[duplicateOf.key, duplicateOf.title].filter(Boolean).join(" ")}
      </p>
    ) : null}
  </section>
);

const PortalLifecycleBanner = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const { lifecycle } = bug;
  if (lifecycle.question) {
    return <QuestionBanner bug={bug} />;
  }
  if (lifecycle.verification) {
    return <VerifyBanner bug={bug} />;
  }
  if (lifecycle.duplicateOf) {
    return <MergedPanel duplicateOf={lifecycle.duplicateOf} />;
  }
  if (bug.status === "closed" || bug.status === "not_a_bug") {
    return <ClosedBanner bug={bug} />;
  }
  return null;
};

export { PortalLifecycleBanner };

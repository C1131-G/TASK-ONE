"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in workspace styles. */

import type { RefObject } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  BehaviorFields,
  ProjectField,
  StepsField,
  SummaryFields,
} from "@/features/portal/components/portal-bug-fields";
import { PORTAL_REPORT_STEPS } from "@/features/portal/components/portal-bug-form-mode";
import type {
  Errors,
  Values,
} from "@/features/portal/components/portal-bug-form-model";
import { PortalContextDisclosure } from "@/features/portal/components/portal-context-disclosure";
import {
  EnvironmentFields,
  ImpactField,
  PageUrlField,
} from "@/features/portal/components/portal-environment-fields";
import { PortalReportAttachments } from "@/features/portal/components/portal-report-attachments";
import type { CapturedScreenshot } from "@/features/portal/components/portal-screenshot-capture";
import type { CollectedBrowserContext } from "@/features/portal/portal-browser-context";
import type { DetectedEnvironment } from "@/features/portal/portal-environment";
import type {
  PortalProject,
  PortalResponseTimes,
} from "@/src/server/portal/portal-contracts";

import type { Patch } from "./portal-field-support";

const PortalReportWizardStage = ({
  activeStep,
  captured,
  context,
  detected,
  errors,
  files,
  onAddStep,
  onCaptured,
  onFiles,
  onPatch,
  onRemoveStep,
  onStepChange,
  onToggleContext,
  pending,
  projects,
  responseTimes,
  sendContext,
  stepHeadingRef,
  values,
}: {
  readonly activeStep: number;
  readonly captured: CapturedScreenshot | null;
  readonly context: CollectedBrowserContext | undefined;
  readonly detected: DetectedEnvironment;
  readonly errors: Errors;
  readonly files: readonly File[];
  readonly onAddStep: () => void;
  readonly onCaptured: (next: CapturedScreenshot | null) => void;
  readonly onFiles: (files: File[]) => void;
  readonly onPatch: Patch;
  readonly onRemoveStep: (id: string) => void;
  readonly onStepChange: (id: string, text: string) => void;
  readonly onToggleContext: (send: boolean) => void;
  readonly pending: boolean;
  readonly projects: readonly PortalProject[];
  readonly responseTimes: PortalResponseTimes | null;
  readonly sendContext: boolean;
  readonly stepHeadingRef: RefObject<HTMLHeadingElement | null>;
  readonly values: Values;
}) => (
  <section aria-labelledby="portal-step-heading" className="portal-wizard-step">
    <h2 id="portal-step-heading" ref={stepHeadingRef} tabIndex={-1}>
      {PORTAL_REPORT_STEPS[activeStep] ?? "Report details"}
    </h2>
    {activeStep === 0 ? (
      <div className="portal-wizard-summary">
        <ProjectField
          errors={errors}
          onPatch={onPatch}
          pending={pending}
          projects={projects}
          value={values.projectId}
        />
        <SummaryFields
          errors={errors}
          onPatch={onPatch}
          pending={pending}
          values={values}
        />
      </div>
    ) : null}
    {activeStep === 1 ? (
      <div className="portal-wizard-reproduction">
        <StepsField
          errors={errors}
          onAdd={onAddStep}
          onRemove={onRemoveStep}
          onStepChange={onStepChange}
          pending={pending}
          steps={values.steps}
        />
        <BehaviorFields
          errors={errors}
          onPatch={onPatch}
          pending={pending}
          values={values}
        />
      </div>
    ) : null}
    {activeStep === 2 ? (
      <div className="portal-wizard-impact">
        <PageUrlField
          errors={errors}
          onPatch={onPatch}
          pending={pending}
          value={values.pageUrl}
        />
        <ImpactField
          errors={errors}
          onPatch={onPatch}
          pending={pending}
          responseTimes={responseTimes}
          value={values.impact}
        />
      </div>
    ) : null}
    {activeStep === 3 ? (
      <div className="portal-wizard-evidence">
        <EnvironmentFields
          detected={detected}
          isCreate
          onPatch={onPatch}
          pending={pending}
          values={values}
        />
        <PortalReportAttachments
          captured={captured}
          disabled={pending}
          files={files}
          onCaptured={onCaptured}
          onFiles={onFiles}
        />
        {context ? (
          <PortalContextDisclosure
            context={context}
            disabled={pending}
            onToggle={onToggleContext}
            sendContext={sendContext}
          />
        ) : null}
      </div>
    ) : null}
  </section>
);

export { PortalReportWizardStage };

const PortalReportWizardNavigation = ({
  activeStep,
}: {
  readonly activeStep: number;
}) => (
  <ol aria-label="Report progress" className="portal-wizard-progress">
    {PORTAL_REPORT_STEPS.map((label, index) => (
      <li
        aria-current={activeStep === index ? "step" : undefined}
        data-complete={activeStep > index || undefined}
        key={label}
      >
        <span aria-hidden="true">{index + 1}</span>
        <span>{label}</span>
      </li>
    ))}
  </ol>
);

const PortalReportWizardActions = ({
  activeStep,
  onBack,
  onContinue,
  pending,
  submitText,
}: {
  readonly activeStep: number;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly pending: boolean;
  readonly submitText: string;
}) => (
  <div className="portal-form-acts portal-wizard-acts">
    {activeStep > 0 ? (
      <WorkspaceButton
        className="btn btn-ghost"
        disabled={pending}
        onClick={onBack}
        type="button"
      >
        Back
      </WorkspaceButton>
    ) : null}
    <span className="portal-wizard-count">
      Step {activeStep + 1} of {PORTAL_REPORT_STEPS.length}
    </span>
    {activeStep < PORTAL_REPORT_STEPS.length - 1 ? (
      <WorkspaceButton
        className="btn btn-primary"
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          onContinue();
        }}
        type="button"
      >
        Continue
      </WorkspaceButton>
    ) : (
      <WorkspaceButton
        className="btn btn-primary"
        disabled={pending}
        type="submit"
      >
        {submitText}
      </WorkspaceButton>
    )}
  </div>
);

export { PortalReportWizardActions, PortalReportWizardNavigation };

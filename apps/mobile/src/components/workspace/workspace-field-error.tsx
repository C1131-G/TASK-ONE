import { StyleSheet, Text } from "react-native";

import { type AppFailure, ValidationFailed } from "@/errors";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceFieldErrorProps {
  readonly failure?: AppFailure | undefined;
  /** The form field whose message to show; omitted shows the first message. */
  readonly field?: string;
}

/** Renders the ValidationFailed field errors; other failures render nothing. */
export const WorkspaceFieldError = ({ failure, field }: WorkspaceFieldErrorProps) => {
  const { isDark } = useTheme();
  if (failure === undefined || failure._tag !== "ValidationFailed") {
    return null;
  }
  const fieldErrors = (failure as ValidationFailed).fieldErrors;
  const message =
    field === undefined
      ? (Object.values(fieldErrors)[0] ?? null)
      : (fieldErrors[field] ?? null);
  if (message === null) {
    return null;
  }

  return (
    <Text
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        typeStyle("xs"),
        styles.error,
        { color: isDark ? theme.dark.red : theme.light.red },
      ]}
    >
      {message}
    </Text>
  );
};

const styles = StyleSheet.create({
  error: {
    marginTop: spacing.s1,
  },
});

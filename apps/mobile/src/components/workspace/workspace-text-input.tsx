import { StyleSheet, TextInput, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { FONT_SCALE_CAP, typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceTextInputProps {
  readonly accessibilityLabel?: string;
  readonly invalid?: boolean;
  readonly keyboardType?: "default" | "email-address" | "numeric" | "url";
  readonly multiline?: boolean;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly value: string;
}

export const WorkspaceTextInput = ({
  accessibilityLabel,
  invalid = false,
  keyboardType = "default",
  multiline = false,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: WorkspaceTextInputProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: palette.sunken, borderColor: invalid ? palette.red : palette.border },
      ]}
    >
      <TextInput
        aria-invalid={invalid}
        accessibilityLabel={accessibilityLabel}
        keyboardType={keyboardType}
        maxFontSizeMultiplier={FONT_SCALE_CAP}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.text3}
        secureTextEntry={secureTextEntry}
        style={[typeStyle("md"), styles.input, { color: palette.text }]}
        value={value}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  input: {
    flex: 1,
    textAlignVertical: "top",
  },
});

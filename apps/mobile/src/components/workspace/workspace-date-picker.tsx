import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { WorkspaceSheet } from "@/components/workspace/workspace-sheet";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";

export interface WorkspaceDatePickerProps {
  readonly label: string;
  readonly onChange: (iso: string | null) => void;
  readonly placeholder?: string;
  /** IANA zone used to render the current value; selection stays absolute. */
  readonly timeZone?: string;
  /** ISO datetime string, or null for no date. */
  readonly value: string | null;
}

const formatValue = (iso: string, timeZone?: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone,
  });
  return formatter.format(new Date(iso));
};

/** Date-only or datetime picker in a sheet; commits an ISO string on confirm. */
export const WorkspaceDatePicker = ({
  label,
  onChange,
  placeholder = "Pick a date",
  timeZone,
  value,
}: WorkspaceDatePickerProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date>(() => new Date());

  const openSheet = (): void => {
    setPending(value === null ? new Date() : new Date(value));
    setOpen(true);
  };

  const confirm = (): void => {
    onChange(pending.toISOString());
    setOpen(false);
  };

  return (
    <View>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityValue={{ text: value === null ? placeholder : formatValue(value, timeZone) }}
        onPress={openSheet}
        style={[
          styles.trigger,
          { backgroundColor: palette.sunken, borderColor: palette.border },
        ]}
      >
        <Text
          style={[typeStyle("md"), { color: value === null ? palette.text3 : palette.text }]}
        >
          {value === null ? placeholder : formatValue(value, timeZone)}
        </Text>
        <Text style={{ color: palette.text3 }}>🗓</Text>
      </Pressable>
      <WorkspaceSheet onClose={() => setOpen(false)} title={label} visible={open}>
        <DateTimePicker
          mode="date"
          onChange={(event, date) => {
            if (event.type === "set" && date !== undefined) {
              setPending(date);
            }
          }}
          {...(timeZone === undefined ? {} : { timeZoneName: timeZone })}
          value={pending}
        />
        <DateTimePicker
          mode="time"
          onChange={(event, date) => {
            if (event.type === "set" && date !== undefined) {
              setPending((current) => {
                const combined = new Date(current);
                combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
                return combined;
              });
            }
          }}
          {...(timeZone === undefined ? {} : { timeZoneName: timeZone })}
          value={pending}
        />
        <View style={styles.actions}>
          <WorkspaceButton
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
            variant="ghost"
          >
            Clear
          </WorkspaceButton>
          <WorkspaceButton onPress={confirm} variant="primary">
            Confirm
          </WorkspaceButton>
        </View>
      </WorkspaceSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.s2,
    justifyContent: "flex-end",
    marginTop: spacing.s3,
  },
  trigger: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.s2,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
});

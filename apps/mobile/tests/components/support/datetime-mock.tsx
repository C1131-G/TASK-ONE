import { View } from "react-native";

interface NativeEvent {
  readonly nativeEvent: { readonly timestamp: number };
}

interface MockProps {
  readonly mode?: string;
  readonly onChange?: (event: NativeEvent, date?: Date) => void;
  readonly timeZoneName?: string;
  readonly value: Date;
}

/**
 * Jest stand-in for the native date/time picker: forwards props and adapts
 * the native onChange(event, date) contract so tests can fireEvent a change.
 */
export default function DateTimePickerMock(props: MockProps) {
  const { onChange, mode, ...rest } = props;
  return (
    <View
      {...({
        onChange: (event: NativeEvent) =>
          onChange?.(event, new Date(event.nativeEvent.timestamp)),
        testID: mode === "time" ? "native-timepicker" : "native-datepicker",
      } satisfies Record<string, unknown>)}
      {...(rest as Record<string, unknown>)}
    />
  );
}

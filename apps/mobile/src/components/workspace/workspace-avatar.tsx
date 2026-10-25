import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, theme } from "@/theme/tokens.generated";

export interface WorkspaceAvatarProps {
  readonly name: string;
  readonly size?: number;
  readonly uri?: string;
}

const AVATAR_HUES = [214, 262, 172, 338, 24, 154];

const initialsOf = (name: string): string =>
  name
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const hueOf = (name: string): number => {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }
  return AVATAR_HUES[hash % AVATAR_HUES.length] ?? 214;
};

/** A circular avatar showing initials (or the image) with a stable hue per name. */
export const WorkspaceAvatar = ({ name, size = 32, uri }: WorkspaceAvatarProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const hue = hueOf(name);

  return (
    <View
      accessible
      accessibilityLabel={name}
      accessibilityRole="image"
      style={[
        styles.circle,
        {
          backgroundColor: uri === undefined ? `hsl(${hue} 32% ${isDark ? 30 : 82}%)` : "transparent",
          height: size,
          width: size,
        },
      ]}
    >
      {uri === undefined ? (
        <Text
          style={[
            typeStyle("xs", { weight: 600 }),
            { color: isDark ? palette.text : palette.text2 },
          ]}
        >
          {initialsOf(name)}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    borderRadius: radii.full,
    justifyContent: "center",
  },
});

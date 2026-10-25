import { StyleSheet, Text, View } from "react-native";

import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

/** Placeholder until the workspace screens land in Phase 6. */
export default function WorkspaceHomeRoute() {
  return (
    <WorkspaceScreen title="Home">
      <View style={styles.host}>
        <Text>Workspace screens arrive in Phase 6.</Text>
      </View>
    </WorkspaceScreen>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});

import { StyleSheet, Text, View } from "react-native";

import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

/** Placeholder until the portal screens land in Phase 8. */
export default function PortalHomeRoute() {
  return (
    <WorkspaceScreen title="Portal">
      <View style={styles.host}>
        <Text>Portal screens arrive in Phase 8.</Text>
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

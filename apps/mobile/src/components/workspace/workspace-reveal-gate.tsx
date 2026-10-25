import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated } from "react-native";

/** Reads the OS reduced-motion preference as reactive state. */
export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    const readPreference = async (): Promise<void> => {
      const value = await AccessibilityInfo.isReduceMotionEnabled();
      if (active) {
        setReduced(value);
      }
    };
    void readPreference();
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => setReduced(value),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
};

export interface WorkspaceRevealGateProps {
  readonly children: ReactNode;
}

/** Fades its children in once; respects the reduced-motion preference. */
export const WorkspaceRevealGate = ({ children }: WorkspaceRevealGateProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      duration: 140,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
};

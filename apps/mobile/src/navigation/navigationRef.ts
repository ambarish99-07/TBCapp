import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/** Lets components mounted outside the Stack.Navigator's own screen tree (e.g. the app-wide
 * "Track Order" pill, rendered as a sibling of the navigator) still trigger navigation. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

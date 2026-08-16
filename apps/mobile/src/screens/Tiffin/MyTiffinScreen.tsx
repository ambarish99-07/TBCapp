import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView } from "react-native";
import { TiffinSubscriptionAndOrders } from "../../components/TiffinSubscriptionAndOrders";
import { theme } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "MyTiffin">;

export function MyTiffinScreen({ navigation }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(4) }}
    >
      <TiffinSubscriptionAndOrders navigation={navigation} />
    </ScrollView>
  );
}

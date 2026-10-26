import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { OrderSync } from '@/components/order-sync';
import { Colors, Fonts } from '@/constants/theme';
import { AppProvider, useApp } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.brand,
    background: Colors.bg,
    card: Colors.bg,
    text: Colors.ink,
    border: Colors.border,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  return (
    <AppProvider>
      <ThemeProvider value={theme}>
        <ReadyGate fontsLoaded={fontsLoaded}>
          <Stack
            screenOptions={{
              headerTintColor: Colors.ink,
              headerTitleStyle: { fontFamily: Fonts.bold },
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
              contentStyle: { backgroundColor: Colors.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="cart" options={{ title: 'Kosár' }} />
            <Stack.Screen name="checkout" options={{ title: 'Pénztár' }} />
            <Stack.Screen name="order/[id]" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen
              name="location"
              options={{
                presentation: 'formSheet',
                headerShown: false,
                sheetAllowedDetents: 'fitToContents',
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            <Stack.Screen name="info" options={{ title: 'Étterem információk' }} />
          </Stack>
          <OrderSync />
        </ReadyGate>
      </ThemeProvider>
    </AppProvider>
  );
}

/** Addig tartja a splash képernyőt, amíg a betűtípusok és a mentett adatok be nem töltődnek. */
function ReadyGate({ fontsLoaded, children }: { fontsLoaded: boolean; children: ReactNode }) {
  const { hydrated } = useApp();
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return ready ? <>{children}</> : null;
}

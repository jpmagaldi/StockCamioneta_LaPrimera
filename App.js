import { useEffect, useState, useRef } from 'react';
import { AppState, Text as RNText } from 'react-native';
import { 
    MD3LightTheme as DefaultTheme,
    Provider as PaperProvider 
} from 'react-native-paper';
import { es, registerTranslation } from 'react-native-paper-dates'
import { NavigationContainer} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import StockCarga from './StockCarga';
import Configuracion from './Configuracion';
import Ranking from './Ranking';
import Ventas from './Ventas';

if (RNText.defaultProps == null) RNText.defaultProps = {};
RNText.defaultProps.maxFontSizeMultiplier = 1.2;


const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#9A1115',
        secondary: '#414141',
    },
};

const Tab = createBottomTabNavigator();
registerTranslation('es', es)



export default function App() {
  const appState = useRef(AppState.currentState);
  const [refreshKey, setRefreshKey] = useState(0);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        setRefreshKey(prev => prev + 1);
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);
  
  
  
    return (
        <PaperProvider theme={theme}>
            <NavigationContainer>
                <Tab.Navigator
                    key={refreshKey}
                    screenOptions={({ route }) => ({
                        tabBarIcon: ({ focused, color, size }) => {
                            let iconName;
                            if (route.name === 'Carga') {
                                iconName = focused ? 'truck-delivery' : 'truck-delivery-outline';
                            } else if (route.name === 'Stock') {
                                iconName = focused ? 'package-variant' : 'package-variant-closed';
                            } else if (route.name === 'Ventas') {
                                iconName = focused ? 'trophy' : 'trophy-outline';
                            } else if (route.name === 'Ajustes') {
                                iconName = focused ? 'cog' : 'cog-outline';
                            }
                            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
                        },
                        tabBarActiveTintColor: theme.colors.primary,
                        tabBarInactiveTintColor: 'gray',
                        headerShown: false
                    })}
                >
                    <Tab.Screen name="Carga" component={StockCarga} />
                    <Tab.Screen name="Stock" component={Ranking} />
                    <Tab.Screen name="Ventas" component={Ventas} />
                    <Tab.Screen name="Ajustes" component={Configuracion} />
                </Tab.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}



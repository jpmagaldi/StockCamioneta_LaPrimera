import { useEffect, useState, useCallback } from 'react';
import { FlatList, View, StyleSheet, StatusBar, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
    Text, 
    TextInput, 
    Button, 
    ActivityIndicator, 
    Portal, 
    Dialog,
    TouchableRipple,  
    Surface, 
    IconButton,
    Icon,
    SegmentedButtons,
    MD3LightTheme as DefaultTheme,
    Provider as PaperProvider 
} from 'react-native-paper';
import { es, registerTranslation } from 'react-native-paper-dates'
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { apiClient } from './store'
import Configuracion from './Configuracion';
import Ranking from './Ranking';

// Prevenir que el ajuste de fuente (zoom) del sistema rompa el diseño
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

function StockCarga() {
    const [loading, setLoading] = useState(true);
    const [productos, setProductos] = useState([]);
    const [seleccionado, setSeleccionado] = useState(null);
    const [visible, setVisible] = useState(false);
    const [cantidad, setCantidad] = useState('1');
    const [cargaActual, setCargaActual] = useState([]);
    const [tipoCarga, setTipoCarga] = useState('0');
    const [modalExito, setModalExito] = useState({ visible: false, title: '', message: '', type: 'success' });
    const [botoninicio, setBotonInicio] = useState(true);
    const [textoinfo, setTextoInfo] = useState('');


    
    const BuscarInicial = async (maxIntentos = 3) => {
        for (let i = 0; i < maxIntentos; i++) {
            try {
                let response = await apiClient.get(`searchInicio`, { timeout: 2000 });
                if (response.data === 'OK') {
                    setBotonInicio(true);
                    setTipoCarga('2');
                } else {
                    setBotonInicio(false);
                    setTipoCarga('0');
                }
                return true;
            } catch (error) {
                console.error(`Error en BuscarInicial (intento ${i + 1}):`, error.message);

                if (i > 1) {
                    setTextoInfo('Esta tardando mucho, quizas no haya internet o el servidor no responde');
                } else if (i === maxIntentos - 1) {
                    setBotonInicio(false);
                    return false;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }   
    
    const BuscarInfo = async () => {
        try {
            let response = await apiClient.get(`getProductosNegocio`);
            const prods = response.data.map((nombre, index) => ({
                id: String(index),
                nombre: nombre
            }));
            setProductos(prods);
            return true;
        } catch (error) {
            console.error('Error buscando productos:', error);
            return false;
        }
    } 
    
    
    useFocusEffect(
        useCallback(() => {
            const cargarTodo = async () => {
                setTextoInfo('');
                setLoading(true);
                try {
                    await BuscarInicial();
                    const esInfo = await BuscarInfo();

                    if (esInfo) {
                        setLoading(false);
                    }
                } catch (error) {
                    console.error("Error al refrescar vista:", error);
                }
            };
            cargarTodo();
        }, [])
    );

    const showModal = (producto) => {
        const existente = cargaActual.find(c => c.id === producto.id);
        setSeleccionado(producto);
        setCantidad(existente ? String(existente.cantidad) : '1');
        setVisible(true);
    };

    const hideModal = () => {
        setVisible(false);
        setSeleccionado(null);
    };

    const handleAceptar = () => {
        const formattedCantidad = cantidad.replace(',', '.');
        const cantNum = parseFloat(formattedCantidad);
        if (!isNaN(cantNum) && cantNum > 0 && seleccionado) {
            const nuevaEntrada = { ...seleccionado, cantidad: cantNum };
            setCargaActual([...cargaActual.filter(item => item.id !== seleccionado.id), nuevaEntrada]);
            hideModal();
        }
    };

    const handleQuitar = () => {
        if (seleccionado) {
            setCargaActual(cargaActual.filter(item => item.id !== seleccionado.id));
            hideModal();
        }
    };

    const aumentar = () => setCantidad(prev => {
        const current = parseInt(prev.replace(',', '.')) || 0;
        return String(current + 1);
    });
    
    const disminuir = () => setCantidad(prev => {
        const current = parseInt(prev.replace(',', '.')) || 0;
        const next = Math.max(0, current - 1);
        return String(next);
    });

    const handleCantidadChange = (text) => {
        let formatted = text.replace(',', '.');
        // Permite números con hasta un decimal, permitiendo empezar con punto
        if (formatted === '' || /^\d*\.?\d?$/.test(formatted)) {
            setCantidad(formatted);
        }
    };

    const Finalizar = async () => {
        try {
            let response = await apiClient.post(`postProductosNegocio`, {
                Productos: cargaActual,
                Tipo: tipoCarga
            })
            if (response.data.error === null) {
                setModalExito({ 
                    visible: true, 
                    title: '¡Carga Exitosa!',
                    message: `Se han registrado ${cargaActual.length} productos correctamente en el sistema.`,
                    type: 'success' 
                });
                
                // Reiniciar la vista
                setCargaActual([]);
                setCantidad('1');
                setSeleccionado(null);
                await BuscarInicial();
            } else {
                console.log(response.data)
                setModalExito({ 
                    visible: true, 
                    title: 'Error de Conexión',
                    message: response.data.error, 
                    type: 'error' 
                });
            }
            
        } catch (error) {
            console.error('Error al finalizar carga:', error);
            setModalExito({ 
                visible: true, 
                title: 'Error de Conexión',
                message: 'No se pudo guardar la carga. Verifique su conexión al servidor.', 
                type: 'error' 
            });
        }
    };

    const renderItem = ({ item }) => {
        const yaCargado = cargaActual.find(c => c.id === item.id);

        return (
            <TouchableRipple
                style={[styles.row, yaCargado && styles.rowChecked]}
                onPress={() => showModal(item)}
                rippleColor="rgba(0, 0, 0, .1)"
            >
                <View style={styles.rowContent}>
                    <Text style={[styles.rowText, yaCargado && styles.textChecked]} maxFontSizeMultiplier={1.2}>
                        {item.nombre}
                    </Text>
                    {yaCargado && (
                        <Surface style={styles.badge} elevation={1}>
                        <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{yaCargado.cantidad}</Text>
                        </Surface>
                    )}
                </View>
            </TouchableRipple>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" animating={true} />
                    <Text style={{ marginTop: 10 }}>Cargando productos...</Text>
                    <Text style={{ marginTop: 10, textAlign: 'center'}}>{textoinfo}</Text>
                </View>
            ) : (
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View style={styles.titleContainer}>
                            <Text variant="headlineSmall" style={styles.title} maxFontSizeMultiplier={1.2}>Stock Camioneta</Text>
                            <Button 
                                mode="contained" 
                                onPress={Finalizar} 
                                disabled={cargaActual.length === 0}
                                style={styles.btnFinalizar}
                                contentStyle={{ height: 45 }}
                                labelStyle={{ maxFontSizeMultiplier: 1.2 }}
                            >
                                Finalizar
                            </Button>
                        </View>
                        <SegmentedButtons
                            value={tipoCarga}
                            onValueChange={setTipoCarga}
                            buttons={[
                                { value: '0', label: 'Inicio', icon: 'archive-plus', disabled: botoninicio},
                                { value: '3', label: 'Carga', icon: 'truck-cargo-container' },
                                { value: '2', label: 'Negocio', icon: 'store' }  
                            ]}
                            style={styles.segmentedButtons}
                        />
                    </View>

                    <FlatList
                        data={productos}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                        contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText} maxFontSizeMultiplier={1.2}>No se encontraron productos</Text>}
                    />

                    <Portal>
                        <Dialog 
                            visible={visible} 
                            onDismiss={hideModal}
                            style={{ borderRadius: 28, backgroundColor: '#fff', overflow: 'hidden' }}
                        >
                            <View style={{ backgroundColor: theme.colors.primary, height: 6 }} />
                            
                            <View style={{ alignItems: 'center', marginTop: 20 }}>
                                <View style={{ 
                                    backgroundColor: '#FCE4E4', 
                                    width: 70, 
                                    height: 70, 
                                    borderRadius: 35, 
                                    justifyContent: 'center', 
                                    alignItems: 'center' 
                                }}>
                                    <Icon source="package-variant-closed" color={theme.colors.primary} size={40} />
                                </View>
                            </View>

                            <Dialog.Title style={{ textAlign: 'center', fontWeight: 'bold', paddingBottom: 0 }} maxFontSizeMultiplier={1.2}>
                                Seleccionar Cantidad
                            </Dialog.Title>
                            
                            <Dialog.Content>
                                <Text variant="bodyLarge" style={{ textAlign: 'center', color: '#555', marginBottom: 20 }} maxFontSizeMultiplier={1.2}>
                                    {seleccionado?.nombre}
                                </Text>

                                <View style={styles.cantidadContainer}>
                                    <IconButton
                                        icon="minus"
                                        size={30}
                                        mode="contained-tonal"
                                        onPress={disminuir}
                                        iconColor={theme.colors.primary}
                                    />
                                    <TextInput
                                        value={cantidad}
                                        onChangeText={handleCantidadChange}
                                        keyboardType="decimal-pad"
                                        mode="outlined"
                                        style={styles.inputCantidad}
                                        contentStyle={{ textAlign: 'center', fontSize: 24, fontWeight: 'bold' }}
                                        outlineStyle={{ borderRadius: 12 }}
                                    />
                                    <IconButton
                                        icon="plus"
                                        size={30}
                                        mode="contained-tonal"
                                        onPress={aumentar}
                                        iconColor={theme.colors.primary}
                                    />
                                </View>
                            </Dialog.Content>

                            <Dialog.Actions style={{ 
                                flexDirection: 'column', 
                                paddingHorizontal: 20, 
                                paddingBottom: 25,
                                gap: 10
                            }}>
                                <Button 
                                    mode="contained" 
                                    onPress={handleAceptar}
                                    style={{ width: '100%', borderRadius: 12 }}
                                    contentStyle={{ height: 48 }}
                                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                                >
                                    CONFIRMAR
                                </Button>
                                
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <Button 
                                        mode="outlined" 
                                        onPress={hideModal}
                                        style={{ flex: 1, borderRadius: 12 }}
                                        contentStyle={{ height: 48 }}
                                    >
                                        Cancelar
                                    </Button>

                                    {cargaActual.find(c => c.id === seleccionado?.id) && (
                                        <Button 
                                            mode="outlined" 
                                            onPress={handleQuitar}
                                            textColor="#7B0016"
                                            icon="trash-can-outline"
                                            style={{ flex: 1, borderRadius: 12, borderColor: '#7B0016' }}
                                            contentStyle={{ height: 48 }}
                                        >
                                            Quitar
                                        </Button>
                                    )}
                                </View>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>

                    <Portal>
                        <Dialog 
                            visible={modalExito.visible} 
                            onDismiss={() => setModalExito({ ...modalExito, visible: false })}
                            style={{ borderRadius: 28, backgroundColor: '#fff', overflow: 'hidden' }}
                        >
                            <View style={{ backgroundColor: modalExito.type === 'success' ? '#4CAF50' : '#9A1115', height: 6 }} />
                            
                            <View style={{ alignItems: 'center', marginTop: 30 }}>
                                <View style={{ 
                                    backgroundColor: modalExito.type === 'success' ? '#E8F5E9' : '#FFEBEE', 
                                    width: 80, 
                                    height: 80, 
                                    borderRadius: 40, 
                                    justifyContent: 'center', 
                                    alignItems: 'center' 
                                }}>
                                    <Icon 
                                        source={modalExito.type === 'success' ? "check-circle" : "alert-circle"} 
                                        color={modalExito.type === 'success' ? "#4CAF50" : "#9A1115"} 
                                        size={50} 
                                    />
                                </View>
                            </View>
                            
                            <Dialog.Title style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 24, paddingVertical: 10 }} maxFontSizeMultiplier={1.2}>
                                {modalExito.title}
                            </Dialog.Title>
                            
                            <Dialog.Content>
                                <Text variant="bodyLarge" style={{ textAlign: 'center', color: '#555', lineHeight: 24 }} maxFontSizeMultiplier={1.2}>
                                    {modalExito.message}
                                </Text>
                            </Dialog.Content>

                            <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 25 }}>
                                <Button 
                                    mode="contained" 
                                    onPress={() => setModalExito({ ...modalExito, visible: false })}
                                    style={{ width: '100%', borderRadius: 12, backgroundColor: modalExito.type === 'success' ? '#4CAF50' : '#9A1115' }}
                                    contentStyle={{ height: 48 }}
                                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                                >
                                    CONTINUAR
                                </Button>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>
                </View>
            )}
        </SafeAreaView>
    );
}

export default function App() {
  
  return (
        <PaperProvider theme={theme}>
            <NavigationContainer>
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        tabBarIcon: ({ focused, color, size }) => {
                            let iconName;
                            if (route.name === 'Carga') {
                                iconName = focused ? 'truck-delivery' : 'truck-delivery-outline';
                            } else if (route.name === 'Ventas') {
                                iconName = focused ? 'package-variant' : 'package-variant-closed';
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
                    <Tab.Screen name="Ventas" component={Ranking} />
                    <Tab.Screen name="Ajustes" component={Configuracion} />
                </Tab.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginVertical: 20,
    },
    titleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        gap: 8,
    },
    title: {
        fontWeight: 'bold',
        color: '#1a1a1a',
        flex: 1, // Esto hace que el título ocupe el espacio sobrante y se divida en líneas si es preciso
    },
    btnFinalizar: {
       borderRadius: 8,
       justifyContent: 'center',
    },
    segmentedButtons: {
        width: '100%',
    },
    listContainer: {
        paddingBottom: 30,
    },
    row: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    rowChecked: {
        backgroundColor: '#E8F5E9',
        borderColor: '#81C784',
    },
    rowContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowText: {
        fontSize: 17,
        fontWeight: '500',
        color: '#333',
    },
    textChecked: {
        color: '#2E7D32',
    },
    badge: {
        backgroundColor: '#9A1115',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    modalContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalSurface: {
        width: '100%',
        borderRadius: 24,
        padding: 24,
        backgroundColor: 'white',
    },
    modalHeader: {
        alignItems: 'center',
    },
    modalSubtitle: {
        marginTop: 8,
        opacity: 0.6,
        fontSize: 16,
    },
    cantidadContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginVertical: 10,
    },
    inputCantidad: {
        width: 100,
        height: 60,
        backgroundColor: 'white',
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 30,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        opacity: 0.5,
    },
});

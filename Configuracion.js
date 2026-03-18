import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import {
    Text, Button, Portal, Dialog,
    TextInput,
    Surface, Icon
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useStore, changeBaseURL, apiClient } from './store'

const InputIp = ({ value, onchange }) => {
    const [currentvalue1, setcurrentvalue1] = useState(value);
    useEffect(() => { setcurrentvalue1(value); }, [value]);

    return (
        <TextInput
            label="Dirección IP del Servidor"
            mode="outlined"
            keyboardType='numeric'
            outlineColor="#e0e0e0"
            activeOutlineColor="#9A1115"
            left={<TextInput.Icon icon="ip-network" color="#9A1115" />}
            onChangeText={v => {
                setcurrentvalue1(v);
                onchange(v);
            }}
            value={currentvalue1}
        />
    )
}

const InputPtoVenta = ({ value, onchange }) => {
    const [currentvalue, setcurrentvalue] = useState(value);
    useEffect(() => { setcurrentvalue(value); }, [value]);

    return <TextInput
        label="Punto de Venta"
        mode="outlined"
        keyboardType='numeric'
        outlineColor="#e0e0e0"
        activeOutlineColor="#9A1115"
        left={<TextInput.Icon icon="store-marker" color="#9A1115" />}
        onChangeText={v => {
            setcurrentvalue(v);
            onchange(v);
        }}
        value={currentvalue}
    />
}

export default function Configuracion({ navigation, route }) {
    const [useIp, setIp] = useState()
    const [usePtoventa, setPtoventa] = useState()

    // Variables de Alerta
    const [titulo, setTitulo] = useState('');
    const [texto, setTexto] = useState('');
    const [visible, setVisible] = useState(false);
    
    // Status de conexión
    const [statusConexion, setStatusConexion] = useState('Login..');

    const Alerta = () => (
        <View>
            <Portal>
                <Dialog visible={visible} onDismiss={() => setVisible(false)}>
                    <Dialog.Title>{titulo}</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">{texto}</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setVisible(false)}>Aceptar</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    )

    const VerificarConexion = async () => {
        setStatusConexion('Login..');
        try {
            await apiClient.get('searchInicio', { timeout: 2000 });
            setStatusConexion('Online');
        } catch (error) {
            if (error.response) {
                setStatusConexion('Online');
            } else {
                setStatusConexion('Offline');
            }
        }
    }

    useFocusEffect(
        useCallback(() => {
            const Variables = async () => {
                setIp(await useStore.getStringAsync('useIp') || '');
                setPtoventa(await useStore.getStringAsync('usePtoventa') || '');
                VerificarConexion();
            }
            Variables()
        }, [])
    );

    const Guardar = async () => {
        try {
            await useStore.setStringAsync('useIp', useIp);
            await useStore.setStringAsync('usePtoventa', usePtoventa);
            await changeBaseURL()
            
            VerificarConexion();

            setTitulo('Correcto.')
            setTexto('Se guardó correctamente.')

        } catch (e) {
            setTitulo('Hmmm algo pasó')
            setTexto(e)
        }
        setVisible(true)
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={{ padding: 16 }}>
                    <Surface style={styles.sectionSurface} elevation={1}>
                        <View style={styles.sectionHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Icon source="server-network" size={24} color="#9A1115" />
                                <Text variant="titleMedium" style={styles.sectionTitle}>Conexión al Servidor</Text>
                            </View>

                            <View style={[styles.statusBadge, { 
                                backgroundColor: statusConexion === 'Online' ? '#E8F5E9' 
                                              : statusConexion === 'Login..' ? '#FFF3E0' 
                                              : '#FFEBEE',
                                borderColor: statusConexion === 'Online' ? '#A5D6A7' 
                                              : statusConexion === 'Login..' ? '#FFCC80' 
                                              : '#EF9A9A',
                            }]}>
                                <View style={[styles.statusDot, { 
                                    backgroundColor: statusConexion === 'Online' ? '#4CAF50' 
                                                  : statusConexion === 'Login..' ? '#FF9800' 
                                                  : '#F44336' 
                                }]} />
                                <Text style={[styles.statusText, { 
                                    color: statusConexion === 'Online' ? '#2E7D32' 
                                         : statusConexion === 'Login..' ? '#E65100' 
                                         : '#C62828' 
                                }]}>
                                    {statusConexion === 'Online' ? 'Online' 
                                   : statusConexion === 'Login..' ? 'Login..' 
                                   : 'Offline'}
                                </Text>
                            </View>
                        </View>
                        
                        <View style={{ gap: 16, marginBottom: 24 }}>
                            <InputIp value={useIp} onchange={setIp} />
                            <InputPtoVenta value={usePtoventa} onchange={(e) => { setPtoventa(e) }} />
                        </View>
                        
                        <Button
                            style={{ borderRadius: 12 }}
                            mode='contained'
                            contentStyle={{ height: 48 }}
                            onPress={() => Guardar()}
                            buttonColor="#9A1115"
                        >
                            GUARDAR CAMBIOS
                        </Button>
                    </Surface>
                </View>
            </ScrollView>
            {Alerta()}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    sectionSurface: {
        padding: 20,
        borderRadius: 16,
        backgroundColor: '#fff',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#333'
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    }
});



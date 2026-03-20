import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Dimensions } from 'react-native';
import { 
    Text, 
    Surface, 
    DataTable, 
    Icon,
    ActivityIndicator,
    TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerInput } from 'react-native-paper-dates';
import { useFocusEffect } from '@react-navigation/native';
import { useStore, apiClient } from './store'

const { width: screenWidth } = Dimensions.get('window');
const availableWidth = screenWidth - 63 // padding: 16 on each side

export default function Ranking({ navigation, route }) {
    const [fecha, setFecha] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [usePtoventa, setPtoventa] = useState(useStore.getString('usePtoventa'))
    
    // Estados para las tablas
    const [dataTabla1, setDataTabla1] = useState([]);
    const [dataTabla2, setDataTabla2] = useState([]);
    const [dataTabla3, setDataTabla3] = useState([]);
    const [dataTabla4, setDataTabla4] = useState([]);
    const [dataTabla5, setDataTabla5] = useState([]);
    const [dataTabla6, setDataTabla6] = useState([]);
    const [dataTabla7, setDataTabla7] = useState([]);

    const [importeVentas, setImporteVentas] = useState('Cargando...');
    const [ImporteColor, setImporteColor] = useState('#d37f00');


    const BuscarInfo = async () => {
        setLoading(true);
        // Limpiamos datos para forzar re-render visual
        setDataTabla1([])
        setDataTabla2([])
        setDataTabla3([])
        setDataTabla4([])
        setDataTabla5([])
        setDataTabla6([])
        setDataTabla7([])
        
        try {             
            let response = await apiClient.post(`getStockInfo`, {
                Fecha: fecha.toISOString().slice(0, 10),
                PtoVenta: usePtoventa
            })
            if (response.data.error === null) {
                setDataTabla1(response.data.Tabla1 || [])
                setDataTabla2(response.data.Tabla2 || [])
                setDataTabla3(response.data.Tabla3 || [])
                setDataTabla4(response.data.Tabla4 || [])
                setDataTabla5(response.data.Tabla5 || [])
                setDataTabla6(response.data.Tabla6 || [])
                setDataTabla7(response.data.Tabla7 || [])
                setImporteVentas(response.data.Total)
                
                if (response.data.Total !== '0.00') {
                    const formattedTotal = parseFloat(response.data.Total).toLocaleString('es-AR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    });
                    setImporteVentas(`${formattedTotal}`);
                    setImporteColor('#43a047');
                } else {
                    setImporteVentas('0.00');
                    setImporteColor('#43a047');
                }               
            } else {
                setImporteVentas('ERROR INTERNO');
                setImporteColor('#8B0000');
            }
            setLoading(false)
        } catch (e) {
            setImporteVentas('ERROR INTERNO');
            setImporteColor('#8B0000');
            console.error('Error en BuscarInfo (Ranking):', e);
        }
    }

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;
            const cargarTodo = async () => {
                const pv = await useStore.getStringAsync('usePtoventa');
                if (isMounted) {
                    setPtoventa(pv);
                    await BuscarInfo(pv);
                }
            };
            cargarTodo();
            return () => { isMounted = false; };
        }, [fecha])
    );

    // Componente reutilizable para las secciones de tabla
    const TablaSeccion = ({ titulo, icono, data }) => (
        <Surface style={styles.tableSurface} elevation={1}>
            <View style={styles.sectionHeader}>
                <Icon source={icono} size={24} color="#9A1115" />
                <Text variant="titleMedium" style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>{titulo}</Text>
            </View>
            
            <ScrollView >
                <View>
                    <DataTable style={[styles.table, { width: availableWidth }]}>
                       
                        <DataTable.Header style={styles.tableHeader}>
                            <DataTable.Title style={styles.widthComp}>
                                <Text style={styles.headerText} maxFontSizeMultiplier={1.2}>Producto</Text>
                            </DataTable.Title>
                            <DataTable.Title style={styles.widthTotal}>
                                <Text style={styles.headerText} maxFontSizeMultiplier={1.2}>Cantidad</Text>
                            </DataTable.Title>
                        </DataTable.Header>

                        {data.length === 0 ? (
                            <DataTable.Row>
                                <DataTable.Cell style={{ flex: 1, justifyContent: 'center' }}>
                                    <Text variant="bodySmall" style={{ color: '#999' }} maxFontSizeMultiplier={1.2}>Sin datos disponibles</Text>
                                </DataTable.Cell>
                            </DataTable.Row>
                        ) : (
                            data.map((item, index) => (
                                <DataTable.Row key={index} style={styles.tableRow}>
                                    <DataTable.Cell style={styles.widthComp}>
                                        <Text style={styles.cellText} maxFontSizeMultiplier={1.2} numberOfLines={2}>{item[0]}</Text>
                                    </DataTable.Cell>
                                    <DataTable.Cell style={styles.widthTotal}>
                                        <Text style={styles.valueText} maxFontSizeMultiplier={1.2}>{Math.round(parseFloat(item[1]))}</Text>
                                    </DataTable.Cell>
                                </DataTable.Row>
                            ))
                        )}
                    </DataTable>
                </View>
            </ScrollView>
        </Surface>
    );

     const TablaSeccionVenta = ({ titulo, icono, data }) => (
        <Surface style={styles.tableSurface} elevation={1}>
            <View style={styles.sectionHeader}>
                <Icon source={icono} size={24} color="#9A1115" />
                <Text variant="titleMedium" style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>{titulo}</Text>
            </View>
            
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                <View>
                    <DataTable style={[styles.table, { width: availableWidth * 1.3 }]}>
                        <DataTable.Header style={styles.tableHeader}>
                            <DataTable.Title style={styles.widthComp}>
                                <Text style={styles.headerText} maxFontSizeMultiplier={1.2}>Producto.</Text>
                            </DataTable.Title>
                            <DataTable.Title style={styles.widthTotalV}>
                                <Text style={styles.headerText} maxFontSizeMultiplier={1.2}>Cantidad</Text>
                            </DataTable.Title>
                            <DataTable.Title style={styles.widthCambio}>
                                <Text style={styles.headerText} maxFontSizeMultiplier={1.2}>Cambios</Text>
                            </DataTable.Title>
                        </DataTable.Header>

                        {data.length === 0 ? (
                            <DataTable.Row>
                                <DataTable.Cell style={{ flex: 1, justifyContent: 'center' }}>
                                    <Text variant="bodySmall" style={{ color: '#999' }} maxFontSizeMultiplier={1.2}>Sin datos disponibles</Text>
                                </DataTable.Cell>
                            </DataTable.Row>
                        ) : (
                            data.map((item, index) => (
                                <DataTable.Row key={index} style={styles.tableRow}>
                                    <DataTable.Cell style={styles.widthComp}>
                                        <Text style={styles.cellText} maxFontSizeMultiplier={1.2} numberOfLines={2}>{item.Producto}</Text>
                                    </DataTable.Cell>
                                    <DataTable.Cell style={styles.widthTotalV}>
                                        <Text style={styles.valueText} maxFontSizeMultiplier={1.2}>{Math.round(parseFloat(item.Cantidad_Total))}</Text>
                                    </DataTable.Cell>
                                    <DataTable.Cell style={styles.widthCambio}>
                                        <Text style={styles.valueText} maxFontSizeMultiplier={1.2}>{Math.round(parseFloat(item.Cambio_Total))}</Text>
                                    </DataTable.Cell>
                                </DataTable.Row>
                            ))
                        )}
                    </DataTable>
                </View>
            </ScrollView>
        </Surface>
    );   
    
    
    
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <Icon source="package-variant-closed" size={40} color="#9A1115" />
                    <Text variant="headlineMedium" style={styles.title} maxFontSizeMultiplier={1.2}>Control de Stock</Text>
                    {loading && (
                        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIndicator size="small" color="#9A1115" />
                            <Text variant="bodySmall" style={{ color: '#9A1115' }} maxFontSizeMultiplier={1.2}>Actualizando datos...</Text>
                        </View>
                    )}
                </View>

                {/* Filters Section */}
                <Surface style={styles.filterSurface} elevation={1}>
                    <View style={styles.sectionHeader}>
                        <Icon source="calendar-month" size={24} color="#9A1115" />
                        <Text variant="titleMedium" style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>Selección de Fecha</Text>
                    </View>
                    <DatePickerInput
                        locale="es"
                        label="Fecha de consulta"
                        value={fecha}
                        onChange={(d) => setFecha(d)}
                        inputMode="start"
                        mode="outlined"
                        activeOutlineColor="#9A1115"
                        style={styles.dateInput}
                    />
                </Surface>

                {/* Secciones de Tablas */}
                {dataTabla1.length > 0 ? (
                <TablaSeccion 
                    titulo="Stock inicial" 
                    icono="archive" 
                    data={dataTabla1} 
                />
                ) : null}
                
                {dataTabla2.length > 0 ? (
                <TablaSeccion 
                    titulo="Carga en Fabrica" 
                    icono="archive-arrow-up" 
                    data={dataTabla2} 
                />
                ) : null}

                {dataTabla6.length > 0 ? (
                <TablaSeccion 
                    titulo="Carga en Negocio" 
                    icono="archive-arrow-up" 
                    data={dataTabla6} 
                />
                ) : null}

                {dataTabla3.length > 0 ? (
                <TablaSeccion 
                    titulo="Bajada en Negocio" 
                    icono="archive-arrow-down" 
                    data={dataTabla3} 
                />
                ) : null}

                {dataTabla4.length > 0 ? (
                <TablaSeccionVenta 
                    titulo="Venta" 
                    icono="clipboard-edit-outline" 
                    data={dataTabla4} 
                />
                ) : null}
               
               {dataTabla7.length > 0 ? (
               <TablaSeccion 
                    titulo="Cambios sin ventas" 
                    icono="cash-off" 
                    data={dataTabla7}
                />
                ) : null}
                
                {dataTabla5.length > 0 ? (
                <TablaSeccion 
                    titulo="Stock Final" 
                    icono="warehouse" 
                    data={dataTabla5} 
                />
                ) : null}

                <Surface style={[styles.totalSurface, { backgroundColor: ImporteColor, marginTop: 16 }]} elevation={2}>
                    <View style={styles.totalHeader}>
                        <Icon source="currency-usd" size={24} color="#fff" />
                        <Text variant="titleMedium" style={styles.totalLabel} maxFontSizeMultiplier={1.2}>TOTAL VENTAS</Text>
                    </View>
                    <TextInput
                        mode="flat"
                        value={importeVentas}
                        style={styles.totalInput}
                        textColor="#fff"
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        readOnly
                    />
                </Surface>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    headerContainer: {
        alignItems: 'center',
        marginVertical: 24,
    },
    title: {
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginTop: 8,
    },
    filterSurface: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    tableSurface: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#333',
    },
    dateInput: {
        backgroundColor: '#fff',
    },
    table: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    tableHeader: {
        backgroundColor: '#9A1115',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tableRow: {
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        minHeight: 56,
    },
    cellText: {
        fontSize: 15,
        color: '#1a1a1a',
    },
    valueText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#9A1115',
    },
    widthComp: {
        width: availableWidth * 0.65,
        flex: 0,
    },
    widthTotal: {
        width: availableWidth * 0.28,
        flex: 0,
        justifyContent: 'center'
    },
    widthTotalV: {
        width: availableWidth * 0.3,
        flex: 0,
        justifyContent: 'center'
    },
    widthCambio: {
        width: availableWidth * 0.3,
        flex: 0,
        justifyContent: 'center'
    },
    totalSurface: {
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#9A1115',
        marginTop: 8,
    },
    totalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 10,
    },
    totalLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    totalInput: {
        backgroundColor: 'transparent',
        fontSize: 28,
        fontWeight: 'bold',
        height: 50,
        paddingHorizontal: 0,
    },
});

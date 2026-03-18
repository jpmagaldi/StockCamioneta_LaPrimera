import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Dimensions } from 'react-native';
import { 
    Text, 
    Surface, 
    DataTable, 
    Icon,
    ActivityIndicator,
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


    const BuscarInfo = async (ptoventaActual) => {
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
            const pv = ptoventaActual || usePtoventa;
            
            let response = await apiClient.post(`getStockInfo`, {
                Fecha: fecha.toISOString().slice(0, 10),
                PtoVenta: pv
            })
                      
            if (response.data) {
                setDataTabla1(response.data.Tabla1 || [])
                setDataTabla2(response.data.Tabla2 || [])
                setDataTabla3(response.data.Tabla3 || [])
                setDataTabla4(response.data.Tabla4 || [])
                setDataTabla5(response.data.Tabla5 || [])
                setDataTabla6(response.data.Tabla6 || [])
                setDataTabla7(response.data.Tabla7 || [])
                setLoading(false);
            }
            
        } catch (e) {
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
                <Text variant="titleMedium" style={styles.sectionTitle}>{titulo}</Text>
            </View>
            
            <ScrollView >
                <View>
                    <DataTable style={[styles.table, { width: availableWidth }]}>
                       
                        <DataTable.Header style={styles.tableHeader}>
                            <DataTable.Title style={styles.widthComp} textStyle={styles.headerText}>Producto</DataTable.Title>
                            <DataTable.Title style={styles.widthTotal} textStyle={styles.headerText}>Cantidad</DataTable.Title>
                        </DataTable.Header>

                        {data.length === 0 ? (
                            <DataTable.Row>
                                <DataTable.Cell style={{ flex: 1, justifyContent: 'center' }}>
                                    <Text variant="bodySmall" style={{ color: '#999' }}>Sin datos disponibles</Text>
                                </DataTable.Cell>
                            </DataTable.Row>
                        ) : (
                            data.map((item, index) => (
                                <DataTable.Row key={index} style={styles.tableRow}>
                                    <DataTable.Cell style={styles.widthComp} textStyle={styles.cellText}>{item[0]}</DataTable.Cell>
                                    <DataTable.Cell style={styles.widthTotal} textStyle={styles.valueText}>{Math.round(parseFloat(item[1]))}</DataTable.Cell>
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
                <Text variant="titleMedium" style={styles.sectionTitle}>{titulo}</Text>
            </View>
            
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                <View>
                    <DataTable style={[styles.table, { width: availableWidth * 1.3 }]}>
                        <DataTable.Header style={styles.tableHeader}>
                            <DataTable.Title style={styles.widthComp} textStyle={styles.headerText}>Producto.</DataTable.Title>
                            <DataTable.Title style={styles.widthTotalV} textStyle={styles.headerText}>Cantidad</DataTable.Title>
                            <DataTable.Title style={styles.widthCambio} textStyle={styles.headerText}>Cambios</DataTable.Title>
                        </DataTable.Header>

                        {data.length === 0 ? (
                            <DataTable.Row>
                                <DataTable.Cell style={{ flex: 1, justifyContent: 'center' }}>
                                    <Text variant="bodySmall" style={{ color: '#999' }}>Sin datos disponibles</Text>
                                </DataTable.Cell>
                            </DataTable.Row>
                        ) : (
                            data.map((item, index) => (
                                <DataTable.Row key={index} style={styles.tableRow}>
                                    <DataTable.Cell style={styles.widthComp} textStyle={styles.cellText}>{item.Producto}</DataTable.Cell>
                                    <DataTable.Cell style={styles.widthTotalV} textStyle={styles.valueText}>{Math.round(parseFloat(item.Cantidad_Total))}</DataTable.Cell>
                                    <DataTable.Cell style={styles.widthCambio} textStyle={styles.valueText}>{Math.round(parseFloat(item.Cambio_Total))}</DataTable.Cell>
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
                    <Text variant="headlineMedium" style={styles.title}>Control de Stock</Text>
                    {loading && (
                        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIndicator size="small" color="#9A1115" />
                            <Text variant="bodySmall" style={{ color: '#9A1115' }}>Actualizando datos...</Text>
                        </View>
                    )}
                </View>

                {/* Filters Section */}
                <Surface style={styles.filterSurface} elevation={1}>
                    <View style={styles.sectionHeader}>
                        <Icon source="calendar-month" size={24} color="#9A1115" />
                        <Text variant="titleMedium" style={styles.sectionTitle}>Selección de Fecha</Text>
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
        height: 56,
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
    }   
});

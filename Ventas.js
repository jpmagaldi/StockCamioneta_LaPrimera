import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { 
    Text, 
    Surface, 
    TextInput, 
    DataTable, 
    Icon,
    ActivityIndicator,
    Portal,
    Modal,
    Button,
    Divider,
    TouchableRipple,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerInput } from 'react-native-paper-dates';
import { useFocusEffect } from '@react-navigation/native';
import { useStore, apiClient } from './store'

export default function Ranking({ navigation, route }) {
    const [fecha, setFecha] = useState(new Date());
    const [importeVentas, setImporteVentas] = useState('Cargando..');
    const [usePtoventa, setPtoventa] = useState(useStore.getString('usePtoventa'));
    const [ImporteColor, setImporteColor] = useState('#d37f00');
    const [rankingData, setRankingData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal details states
    const [selectedItem, setSelectedItem] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [invoiceDetails, setInvoiceDetails] = useState(null);
    const [modalError, setModalError] = useState(null);

    const handleRowLongPress = async (item) => {
        setSelectedItem(item);
        setModalVisible(true);
        setModalLoading(true);
        setModalError(null);
        setInvoiceDetails(null);

        try {
            let response;
            if (item.tipo === 'Presu.') {
                response = await apiClient.post('/reImprimirPres', {
                    nro: String(item.nro),
                    pto: usePtoventa
                });
            } else {
                const apiTipo = item.tipo === 'Fact.A' ? 1 : 3;
                response = await apiClient.post('/reImprimir', {
                    nro: String(item.nro),
                    pto: usePtoventa,
                    tipo: apiTipo
                });
            }

            if (response.data && response.data.error === 'Vacio') {
                setModalError('No se encontró el detalle del comprobante.');
            } else if (response.data && response.data.error) {
                setModalError(response.data.error);
            } else if (response.data && Array.isArray(response.data)) {
                setInvoiceDetails({
                    cliente: response.data[0],
                    productos: response.data[1],
                    factura: response.data[2]
                });
            } else {
                setModalError('Formato de datos no válido.');
            }
        } catch (error) {
            console.error(error);
            setModalError('Error al conectar con el servidor.');
        } finally {
            setModalLoading(false);
        }
    };

    const hideDetailModal = () => {
        setModalVisible(false);
        setSelectedItem(null);
        setInvoiceDetails(null);
    };

    const handleDeleteBudget = () => {
        if (!selectedItem || selectedItem.tipo !== 'Presu.') return;

        Alert.alert(
            'Confirmar Eliminación',
            '¿Está seguro de que desea eliminar este presupuesto? Esta acción no se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'Eliminar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setModalLoading(true);
                            const response = await apiClient.post('/eliminarPresupuesto', {
                                nro: String(selectedItem.nro),
                                pto: usePtoventa
                            });
                            if (response.data && response.data.error === null) {
                                hideDetailModal();
                                BuscarInfo();
                                Alert.alert('Éxito', 'El presupuesto ha sido eliminado correctamente.');
                            } else {
                                setModalError(response.data.error || 'No se pudo eliminar el presupuesto.');
                            }
                        } catch (error) {
                            console.error(error);
                            setModalError('Error de red al intentar eliminar.');
                        } finally {
                            setModalLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const InvoiceDetailModal = () => {
        if (!selectedItem) return null;

        let subtotalVal = 0;
        let ivaVal = 0;
        let totalVal = 0;

        if (invoiceDetails && invoiceDetails.factura) {
            totalVal = parseFloat(selectedItem.tipo === 'Presu.' ? invoiceDetails.factura[2] : invoiceDetails.factura[4]) || 0;
            subtotalVal = selectedItem.tipo === 'Presu.' ? (totalVal / 1.21) : parseFloat(invoiceDetails.factura[2] || 0);
            ivaVal = selectedItem.tipo === 'Presu.' ? (totalVal - subtotalVal) : parseFloat(invoiceDetails.factura[3] || 0);
        }

        return (
            <Portal>
                <Modal
                    visible={modalVisible}
                    onDismiss={hideDetailModal}
                    contentContainerStyle={styles.modalContainer}
                >
                    <Surface style={styles.modalSurface} elevation={5}>
                        {modalLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator animating={true} color="#9A1115" size="large" />
                                <Text style={styles.loadingText}>Cargando detalle...</Text>
                            </View>
                        ) : modalError ? (
                            <View style={styles.errorContainer}>
                                <Icon source="alert-circle-outline" size={48} color="#c62828" />
                                <Text style={styles.errorText}>{modalError}</Text>
                                <Button mode="contained" onPress={hideDetailModal} style={styles.closeButton} buttonColor="#9A1115">
                                    Cerrar
                                </Button>
                            </View>
                        ) : invoiceDetails ? (
                            <ScrollView 
                                showsVerticalScrollIndicator={true} 
                                persistentScrollbar={true}
                                contentContainerStyle={styles.modalScrollContent}
                            >
                                {/* Header */}
                                <View style={styles.modalHeader}>
                                    <Icon 
                                        source={selectedItem.tipo === 'Presu.' ? 'file-hidden' : 'file-document-outline'} 
                                        size={30} 
                                        color="#9A1115" 
                                    />
                                    <View style={styles.headerTitleText}>
                                        <Text variant="titleLarge" style={styles.modalTitle}>
                                            {selectedItem.tipo === 'Presu.' ? 'Presupuesto' : selectedItem.tipo === 'Fact.A' ? 'Factura A' : 'Nota de Crédito A'}
                                        </Text>
                                        <Text variant="bodyMedium" style={styles.modalSubtitle}>
                                            Nro: {invoiceDetails.factura[1]}
                                        </Text>
                                    </View>
                                    <View style={styles.scrollIndicatorBadge}>
                                        <Icon source="arrow-down-bold" size={14} color="#9A1115" />
                                        <Text style={styles.scrollIndicatorText}>Deslizar</Text>
                                    </View>
                                </View>

                                <Divider style={styles.modalDivider} />

                                {/* Client Info */}
                                <View style={styles.infoSection}>
                                    <Text variant="labelLarge" style={styles.sectionLabel}>Cliente</Text>
                                    <Text variant="bodyLarge" style={styles.clientName}>{invoiceDetails.cliente[0]}</Text>
                                    <Text variant="bodyMedium" style={styles.clientCuit}>CUIT: {invoiceDetails.cliente[1]}</Text>
                                    {selectedItem.tipo !== 'Presu.' && invoiceDetails.cliente[3] && (
                                        <Text variant="bodyMedium" style={styles.clientIva}>Cond. IVA: {invoiceDetails.cliente[3]}</Text>
                                    )}
                                    {selectedItem.tipo !== 'Presu.' && invoiceDetails.cliente[2] && (
                                        <Text variant="bodyMedium" style={styles.clientDir}>Dirección: {invoiceDetails.cliente[2]}</Text>
                                    )}
                                    <Text variant="bodyMedium" style={styles.invoiceDate}>Fecha: {invoiceDetails.factura[0]}</Text>
                                </View>

                                <Divider style={styles.modalDivider} />

                                {/* Products List */}
                                <View style={styles.productsSection}>
                                    <Text variant="labelLarge" style={styles.sectionLabel}>Productos</Text>
                                    
                                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                                        <View style={{ width: 540 }}>
                                            <View style={styles.productsTableHeader}>
                                                <Text style={[styles.headerCell, styles.cellCant]}>Cant</Text>
                                                <Text style={[styles.headerCell, styles.cellDetalle]}>Detalle</Text>
                                                <Text style={[styles.headerCell, styles.cellPrecio, { textAlign: 'right' }]}>P. Unit</Text>
                                                <Text style={[styles.headerCell, styles.cellCambio, { textAlign: 'right' }]}>Cambios</Text>
                                                <Text style={[styles.headerCell, styles.cellTotal, { textAlign: 'right' }]}>Total</Text>
                                            </View>

                                            {invoiceDetails.productos.map((prod, index) => (
                                                <View key={index} style={styles.productRow}>
                                                    <Text style={[styles.productCell, styles.cellCant]}>
                                                        {parseFloat(prod[1])}
                                                    </Text>
                                                    <Text style={[styles.productCell, styles.cellDetalle]}>
                                                        {prod[0]}
                                                    </Text>
                                                    <Text style={[styles.productCell, styles.cellPrecio, { textAlign: 'right' }]}>
                                                        ${parseFloat(prod[2]).toFixed(2)}
                                                    </Text>
                                                    <Text style={[styles.productCell, styles.cellCambio, { textAlign: 'right' }]}>
                                                        {prod[4] ? parseFloat(prod[4]) : 0}
                                                    </Text>
                                                    <Text style={[styles.productCell, styles.cellTotal, { textAlign: 'right', fontWeight: 'bold' }]}>
                                                        ${parseFloat(prod[3]).toFixed(2)}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>

                                <Divider style={styles.modalDivider} />

                                {/* Summary & CAE */}
                                <View style={styles.summarySection}>
                                    <View style={styles.financialContainer}>
                                        <View style={styles.financialRow}>
                                            <Text variant="bodyMedium" style={styles.financialLabel}>Subtotal:</Text>
                                            <Text variant="bodyMedium" style={styles.financialValue}>
                                                ${subtotalVal.toFixed(2)}
                                            </Text>
                                        </View>
                                        <View style={styles.financialRow}>
                                            <Text variant="bodyMedium" style={styles.financialLabel}>IVA (21%):</Text>
                                            <Text variant="bodyMedium" style={styles.financialValue}>
                                                ${ivaVal.toFixed(2)}
                                            </Text>
                                        </View>
                                        <Divider style={{ marginVertical: 8, backgroundColor: '#e0e0e0' }} />
                                        <View style={styles.financialRow}>
                                            <Text variant="titleMedium" style={styles.totalLabelText}>TOTAL FINAL:</Text>
                                            <Text variant="titleLarge" style={styles.totalValueText}>
                                                ${totalVal.toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>

                                    {selectedItem.tipo !== 'Presu.' && (
                                        <View style={styles.caeContainer}>
                                            <Text variant="bodySmall" style={styles.caeText}>CAE: {invoiceDetails.factura[5]}</Text>
                                            <Text variant="bodySmall" style={styles.caeText}>Vto CAE: {invoiceDetails.factura[6]}</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                    <Button 
                                        mode="contained" 
                                        onPress={hideDetailModal} 
                                        style={[styles.closeButton, { flex: 1 }]}
                                        buttonColor="#9A1115"
                                        labelStyle={{ fontWeight: 'bold' }}
                                    >
                                        Cerrar
                                    </Button>
                                    
                                    <Button 
                                        mode="outlined" 
                                        onPress={handleDeleteBudget} 
                                        disabled={selectedItem.tipo !== 'Presu.'}
                                        style={[styles.deleteButton, { flex: 1, borderColor: selectedItem.tipo === 'Presu.' ? '#c62828' : '#e0e0e0' }]}
                                        textColor={selectedItem.tipo === 'Presu.' ? '#c62828' : '#a0a0a0'}
                                        labelStyle={{ fontWeight: 'bold' }}
                                        icon="trash-can-outline"
                                    >
                                        Eliminar
                                    </Button>
                                </View>
                            </ScrollView>
                        ) : null}
                    </Surface>
                </Modal>
            </Portal>
        );
    };

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

    const BuscarInfo = async (pv = usePtoventa) => {
        setLoading(true)
        try {
            let response = await apiClient.post(`rankingFact`, {
                Fecha: fecha.toISOString().slice(0, 10),
                PtoVta: pv,
            })
            if (response.data.error === null) {
                const combined = [
                    ...(response.data.rowF || []).map(item => ({
                        tipo: item.Comprobante,
                        cliente: item['SUBSTRING(c.RazonS,1,26)'],
                        nro: item.N_fact.slice(6,13).replace(/^0+/, ''),
                        total: item.Total
                    })),
                    ...(response.data.rowP || []).map(item => ({
                        tipo: 'Presu.',
                        cliente: item['SUBSTRING(c.RazonS,1,26)'],
                        nro: item.N_Presu.slice(6,13).replace(/^0+/, ''),
                        total: item.Total
                    }))
                ];
                setRankingData(combined);
                if (response.data.total !== '0.00') {
                    const formattedTotal = parseFloat(response.data.total).toLocaleString('es-AR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    });
                    setImporteVentas(`${formattedTotal}`);
                    setImporteColor('#43a047');
                } else {
                    setImporteVentas('0.00');
                    setImporteColor('#43a047');
                }
            } 
            else {
                setImporteVentas(response.data.error);
                setImporteColor('#8B0000');
            }
            setLoading(false)
        } catch (e) {
            setImporteVentas('ERROR INTERNO');
            setImporteColor('#8B0000');
            console.error(e);
        }
    }
    
    return (
        <SafeAreaView style={styles.container}>
            <InvoiceDetailModal />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <Icon source="trophy-outline" size={40} color="#9A1115" />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text variant="headlineMedium" style={styles.title}>Ranking de Ventas</Text>
                        {loading && <ActivityIndicator animating={true} color="#9A1115" size="small" style={{ marginLeft: 10, marginTop: 8 }} />}
                    </View>
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

                {/* Rankings Table */}
                <Surface style={styles.tableSurface} elevation={1}>
                    <View style={styles.sectionHeader}>
                        <Icon source="format-list-numbered" size={24} color="#9A1115" />
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Clasificación de Facturas</Text>
                            <Text variant="bodySmall" style={{ color: '#888', fontStyle: 'italic', marginTop: 2 }}>Mantenga presionado un item para ver el detalle</Text>
                        </View>
                    </View>
                    
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                        <View>
                            <DataTable style={[styles.table, { width: 440 }]}>
                                <DataTable.Header style={styles.tableHeader}>
                                    <DataTable.Title style={styles.widthComp} textStyle={styles.headerText}>Comp.</DataTable.Title>
                                    <DataTable.Title style={styles.widthCliente} textStyle={styles.headerText}>Cliente</DataTable.Title>
                                    <DataTable.Title style={styles.widthNro} textStyle={styles.headerText}>Nro.</DataTable.Title>
                                    <DataTable.Title numeric style={styles.widthTotal} textStyle={styles.headerText}>Total</DataTable.Title>
                                </DataTable.Header>

                                {rankingData.map((item, index) => (
                                    <TouchableRipple
                                        key={index}
                                        onLongPress={() => handleRowLongPress(item)}
                                        rippleColor="rgba(0, 0, 0, .1)"
                                    >
                                        <DataTable.Row style={styles.tableRow}>
                                            <DataTable.Cell style={styles.widthComp} textStyle={styles.cellText}>{item.tipo}</DataTable.Cell>
                                            <DataTable.Cell style={styles.widthCliente} textStyle={styles.cellText}>{item.cliente}</DataTable.Cell>
                                            <DataTable.Cell style={styles.widthNro} textStyle={styles.cellText}>{item.nro}</DataTable.Cell>
                                            <DataTable.Cell numeric style={styles.widthTotal} textStyle={styles.valueText}>{parseFloat(item.total).toFixed(2)}</DataTable.Cell>
                                        </DataTable.Row>
                                    </TouchableRipple>
                                ))}
                            </DataTable>
                        </View>
                    </ScrollView>
                </Surface>

                <Surface style={[styles.totalSurface, { backgroundColor: ImporteColor, marginTop: 16 }]} elevation={2}>
                    <View style={styles.totalHeader}>
                        <Icon source="currency-usd" size={24} color="#fff" />
                        <Text variant="titleMedium" style={styles.totalLabel}>IMPORTE DE VENTAS</Text>
                    </View>
                    <TextInput
                        mode="flat"
                        value={importeVentas}
                        onChangeText={setImporteVentas}
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
    subtitle: {
        color: '#666',
        marginTop: 4,
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
    smallCol: {
        maxWidth: 40,
    },
    widthComp: {
        width: 70,
        flex: 0,
    },
    widthCliente: {
        width: 180,
        flex: 0,
    },
    widthNro: {
        width: 40,
        flex: 0,
    },
    widthTotal: {
        width: 105,
        flex: 0,
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
    modalContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalSurface: {
        width: '100%',
        maxHeight: '85%',
        borderRadius: 24,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    modalScrollContent: {
        padding: 20,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#9A1115',
        fontSize: 16,
        fontWeight: '500',
    },
    errorContainer: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        marginTop: 16,
        color: '#c62828',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    headerTitleText: {
        flex: 1,
    },
    modalTitle: {
        fontWeight: 'bold',
        color: '#333',
    },
    modalSubtitle: {
        color: '#666',
        marginTop: 2,
    },
    modalDivider: {
        marginVertical: 16,
        backgroundColor: '#e0e0e0',
    },
    infoSection: {
        gap: 4,
    },
    sectionLabel: {
        color: '#9A1115',
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    clientName: {
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    clientCuit: {
        color: '#555',
    },
    clientIva: {
        color: '#555',
    },
    clientDir: {
        color: '#555',
    },
    invoiceDate: {
        color: '#777',
        marginTop: 4,
        fontStyle: 'italic',
    },
    productsSection: {
        marginTop: 4,
    },
    productsTableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingBottom: 6,
        marginBottom: 8,
    },
    headerCell: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#777',
    },
    productRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        alignItems: 'center',
    },
    productCell: {
        fontSize: 14,
        color: '#333',
    },
    cellCant: {
        width: 50,
    },
    cellDetalle: {
        width: 240,
        paddingRight: 8,
    },
    cellPrecio: {
        width: 80,
    },
    cellCambio: {
        width: 80,
    },
    cellTotal: {
        width: 90,
    },
    summarySection: {
        marginBottom: 20,
        gap: 16,
    },
    financialContainer: {
        width: '100%',
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 16,
    },
    financialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    financialLabel: {
        color: '#666',
        fontSize: 14,
    },
    financialValue: {
        color: '#333',
        fontWeight: '600',
        fontSize: 14,
    },
    caeContainer: {
        gap: 2,
        alignItems: 'center',
        width: '100%',
        marginTop: 8,
    },
    caeText: {
        color: '#777',
        fontSize: 12,
    },
    totalLabelText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 15,
    },
    totalValueText: {
        color: '#9A1115',
        fontWeight: 'bold',
        fontSize: 20,
    },
    closeButton: {
        borderRadius: 12,
        marginTop: 8,
    },
    deleteButton: {
        borderRadius: 12,
        marginTop: 8,
    },
    scrollIndicatorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FCE4E4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    scrollIndicatorText: {
        fontSize: 11,
        color: '#9A1115',
        fontWeight: 'bold',
    },
});
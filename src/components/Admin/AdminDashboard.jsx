'use client'
import React, { useState, useEffect } from 'react'
import { auth, db } from '../../lib/firebase'
import { signOut } from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore'
import { RESTAURANTS } from '../../lib/data'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import BottleDetailModal from './BottleDetailModal'
import EditBottleWeightModal from './EditBottleWeightModal'
import '../../styles/Dashboard.css'

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '1rem',
  background: 'white',
  fontSize: '0.9rem'
}
const thStyle = {
  background: '#2c3e50',
  color: 'white',
  padding: '10px',
  textAlign: 'left'
}
const tdStyle = { borderBottom: '1px solid #ddd', padding: '10px' }

export default function AdminDashboard () {
  // Función para obtener la fecha del turno (4pm-3am) - debe estar antes de useState
  const getShiftDateInitial = () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 16) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    return now.toISOString().split('T')[0];
  };

  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [date, setDate] = useState(getShiftDateInitial()) // Inicializar con fecha del turno actual
  const [activeTab, setActiveTab] = useState('sales')

  const [salesData, setSalesData] = useState([])
  const [movementsData, setMovementsData] = useState([])
  const [cierreData, setCierreData] = useState([])
  const [currentInventory, setCurrentInventory] = useState({})
  const [loading, setLoading] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [selectedBottleDetail, setSelectedBottleDetail] = useState(null)
  const [selectedBottleForEdit, setSelectedBottleForEdit] = useState(null)

  // Función para obtener la fecha del turno (4pm-3am)
  // Un turno empieza a las 4pm de un día y termina a las 3am del día siguiente
  const getShiftDate = (timestamp = null) => {
    const now = timestamp ? new Date(timestamp) : new Date();
    const hour = now.getHours();
    
    // Si es antes de las 4pm (16:00), pertenece al turno del día anterior
    if (hour < 16) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    // Si es 4pm o después, pertenece al turno del día actual
    return now.toISOString().split('T')[0];
  };

  // Obtener el rango de timestamps para un turno específico
  const getShiftDateRange = (dateString) => {
    const selectedDate = new Date(dateString);
    selectedDate.setHours(16, 0, 0, 0); // Inicio del turno: 4pm del día seleccionado
    
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(3, 0, 0, 0); // Fin del turno: 3am del día siguiente
    
    return {
      start: selectedDate,
      end: endDate
    };
  };

  // Verificar si un movimiento está dentro del horario operativo (4pm-3am)
  const isWithinOperatingHours = (timestamp) => {
    if (!timestamp || !timestamp.seconds) return false
    const date = new Date(timestamp.seconds * 1000)
    const hour = date.getHours()
    // Horario: 16:00 (4pm) a 03:00 (3am del día siguiente)
    return hour >= 16 || hour < 3
  }

  const fetchReport = async () => {
    if (!selectedRestaurantId) return
    setLoading(true)
    setSalesData([])
    setMovementsData([])
    setCierreData([])
    setAlerts([])

    try {
      // VENTAS (Snapshot diario)
      const salesQuery = query(
        collection(db, 'daily_reports'),
        where('restaurante_id', '==', selectedRestaurantId),
        where('fecha', '==', date)
      )
      const salesSnap = await getDocs(salesQuery)
      const sales = []
      salesSnap.forEach(doc => sales.push({ id: doc.id, ...doc.data() }))
      setSalesData(sales)

      // MOVIMIENTOS (Logs transaccionales)
      // Buscar por fecha_string (ya está guardado con la fecha del turno)
      const logsQuery = query(
        collection(db, 'stock_logs'),
        where('restaurante_id', '==', selectedRestaurantId),
        where('fecha_string', '==', date)
      )
      const logsSnap = await getDocs(logsQuery)
      const logs = []
      logsSnap.forEach(doc => {
        const data = doc.data()
        const fechaTimestamp = data.fecha?.seconds ? new Date(data.fecha.seconds * 1000) : null
        
        logs.push({ 
          id: doc.id, 
          ...data,
          fechaTimestamp: fechaTimestamp
        })
      })
      // Ordenar por fecha descendente
      logs.sort((a, b) => {
        const dateA = a.fechaTimestamp || (a.fecha?.seconds ? new Date(a.fecha.seconds * 1000) : new Date(0))
        const dateB = b.fechaTimestamp || (b.fecha?.seconds ? new Date(b.fecha.seconds * 1000) : new Date(0))
        return dateB - dateA
      })
      setMovementsData(logs)

      // CIERRES DE TURNO
      if (activeTab === 'cierre') {
        const cierreQuery = query(
          collection(db, 'cierre_turno'),
          where('restaurante_id', '==', selectedRestaurantId),
          where('fecha_turno', '==', date)
        )
        const cierreSnap = await getDocs(cierreQuery)
        const cierres = []
        cierreSnap.forEach(doc => {
          const data = doc.data()
          cierres.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : null
          })
        })
        // Ordenar por timestamp descendente
        cierres.sort((a, b) => {
          const dateA = a.timestamp || new Date(0)
          const dateB = b.timestamp || new Date(0)
          return dateB - dateA
        })
        setCierreData(cierres)
      }

      // STOCK ACTUAL
      if (activeTab === 'inventory') {
        const invRef = doc(db, 'inventories', selectedRestaurantId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) setCurrentInventory(invSnap.data())
        else setCurrentInventory({})
      }

      // GENERAR ALERTAS
      generateAlerts(sales, logs)
      
      toast.success('Datos actualizados')
    } catch (error) {
      console.error(error)
      toast.error('Error al obtener datos')
    } finally {
      setLoading(false)
    }
  }

  const generateAlerts = (sales, movements) => {
    const newAlerts = []

    // 1. Alertas de botellas con peso inicial 0 (deberían estar dadas de baja)
    sales.forEach(item => {
      if (item.peso_inicio === 0 || item.peso_inicio === null || item.peso_inicio === undefined) {
        newAlerts.push({
          type: 'zero_initial_weight',
          severity: 'high',
          message: `🚨 Botella con peso inicial 0: ${item.botella} - Debe estar dada de baja. Peso final: ${item.peso_fin?.toFixed(2) || 0}`,
          botella: item.botella,
          data: item
        })
      }
    })

    // 2. Alertas de pesos sospechosos (peso final > inicial, SOLO si peso inicial > 0)
    sales.forEach(item => {
      if (item.peso_inicio > 0 && item.peso_fin > item.peso_inicio) {
        newAlerts.push({
          type: 'suspicious_weight',
          severity: 'high',
          message: `⚠️ Peso sospechoso: ${item.botella} - Peso final (${item.peso_fin.toFixed(2)}) mayor que inicial (${item.peso_inicio.toFixed(2)})`,
          botella: item.botella,
          data: item
        })
      }
    })

    // 3. Alertas de consumos sin comprobante
    movements.forEach(log => {
      if ((log.accion === 'CONSUMO' || log.accion === 'AJUSTE') && !log.comprobante_url) {
        newAlerts.push({
          type: 'no_proof',
          severity: 'medium',
          message: `📸 Sin comprobante: ${log.botella} - ${log.accion} registrado por ${log.usuario} sin foto`,
          botella: log.botella,
          data: log
        })
      }
    })

    // 4. Alerta si no hay movimientos en el turno (solo si es el turno actual)
    const currentShift = getShiftDate()
    if (date === currentShift && movements.length === 0) {
      newAlerts.push({
        type: 'no_movements',
        severity: 'high',
        message: `🚨 Sin movimientos: No se han registrado movimientos en ${selectedRestaurantId} en el turno actual (4pm-3am)`,
        botella: null,
        data: null
      })
    }

    // 5. Verificar movimientos fuera de horario operativo
    movements.forEach(log => {
      if (log.fecha && !isWithinOperatingHours(log.fecha)) {
        const logDate = log.fecha.seconds ? new Date(log.fecha.seconds * 1000) : new Date()
        newAlerts.push({
          type: 'outside_hours',
          severity: 'low',
          message: `⏰ Fuera de horario: ${log.botella} - Movimiento registrado a las ${logDate.toLocaleTimeString('es-MX')}`,
          botella: log.botella,
          data: log
        })
      }
    })

    // 6. Alertas de discrepancias en cierres (comparar con último movimiento)
    if (activeTab === 'cierre' && cierreData.length > 0) {
      cierreData.forEach(cierre => {
        const movimientosBotella = movements
          .filter(m => m.botella === cierre.botella)
          .sort((a, b) => {
            const dateA = a.fechaTimestamp || (a.fecha?.seconds ? new Date(a.fecha.seconds * 1000) : new Date(0))
            const dateB = b.fechaTimestamp || (b.fecha?.seconds ? new Date(b.fecha.seconds * 1000) : new Date(0))
            return dateB - dateA
          })
        const ultimoMovimiento = movimientosBotella[0]
        const pesoUltimoMovimiento = ultimoMovimiento?.peso_nuevo !== null && ultimoMovimiento?.peso_nuevo !== undefined 
          ? ultimoMovimiento.peso_nuevo 
          : (ultimoMovimiento?.peso_registrado || null)
        
        const pesoFinalRegistrado = cierre.peso_final_registrado || 0
        
        if (pesoUltimoMovimiento !== null) {
          const diferencia = Math.abs(pesoUltimoMovimiento - pesoFinalRegistrado)
          if (diferencia > 5) {
            newAlerts.push({
              type: 'cierre_discrepancy',
              severity: 'high',
              message: `🚨 Discrepancia en cierre: ${cierre.botella} - Peso del cierre (${pesoFinalRegistrado.toFixed(2)}gr) difiere ${diferencia.toFixed(2)}gr del último movimiento (${pesoUltimoMovimiento.toFixed(2)}gr)`,
              botella: cierre.botella,
              data: cierre
            })
          }
        }
      })
    }

    setAlerts(newAlerts)
  }

  useEffect(() => {
    if (selectedRestaurantId) fetchReport()
  }, [selectedRestaurantId, date, activeTab])

  // Regenerar alertas cuando cambien los datos de cierre para detectar discrepancias
  useEffect(() => {
    if (activeTab === 'cierre' && cierreData.length > 0 && movementsData.length > 0) {
      generateAlerts(salesData, movementsData)
    }
  }, [cierreData, movementsData, activeTab, salesData])

  const calculateConsumption = item => {
    const diff = parseFloat(item.consumo_peso || 0)
    const unitCategories = [
      'CERVEZAS',
      'REFRESCOS',
      'ENERGIZANTES',
      'AGUAS IMPORTADAS',
      'VINO ESPUMOSO'
    ]
    if (diff <= 0) return <span style={{ color: '#95a5a6' }}>Sin consumo</span>
    if (unitCategories.includes(item.categoria))
      return <b>{diff.toFixed(0)} Unidades</b>
    return <b>{(diff / 1.5).toFixed(1)} Tragos (1.5oz)</b>
  }

  const exportToExcel = () => {
    if (activeTab === 'sales' && salesData.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }
    if (activeTab === 'movements' && movementsData.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    let dataToExport = []
    let fileName = ''

    if (activeTab === 'sales') {
      fileName = `Ventas_${selectedRestaurantId}_${date}.xlsx`
      dataToExport = salesData.map(item => {
        const diff = parseFloat(item.consumo_peso || 0)
        const unitCategories = ['CERVEZAS', 'REFRESCOS', 'ENERGIZANTES', 'AGUAS IMPORTADAS', 'VINO ESPUMOSO']
        let ventaEstimada = 'Sin consumo'
        if (diff > 0) {
          if (unitCategories.includes(item.categoria)) {
            ventaEstimada = `${diff.toFixed(0)} Unidades`
          } else {
            ventaEstimada = `${(diff / 1.5).toFixed(1)} Tragos (1.5oz)`
          }
        }
        return {
          Botella: item.botella,
          Categoría: item.categoria,
          'Peso Inicial': item.peso_inicio?.toFixed(2) || 0,
          'Peso Final': item.peso_fin?.toFixed(2) || 0,
          'Consumo (gr)': item.consumo_peso?.toFixed(2) || 0,
          'Venta Estimada': ventaEstimada,
          'Stock Actual': item.stock_actual || 0,
          'Comprobante': item.comprobante_url ? 'Sí' : 'No',
          Usuario: item.usuario || '--',
          Fecha: item.fecha || date
        }
      })
    } else if (activeTab === 'movements') {
      fileName = `Movimientos_${selectedRestaurantId}_${date}.xlsx`
      dataToExport = movementsData.map(log => ({
        'Fecha y Hora': log.fechaTimestamp 
          ? log.fechaTimestamp.toLocaleString('es-MX')
          : (log.fecha?.seconds ? new Date(log.fecha.seconds * 1000).toLocaleString('es-MX') : '--'),
        Acción: log.accion,
        Botella: log.botella,
        'ID Botella': log.bottle_id || '--',
        'Peso Anterior': log.peso_anterior !== null && log.peso_anterior !== undefined ? log.peso_anterior.toFixed(2) : '--',
        'Peso Nuevo': log.peso_nuevo !== null && log.peso_nuevo !== undefined ? log.peso_nuevo.toFixed(2) : '--',
        'Diferencia': log.peso_anterior !== null && log.peso_nuevo !== null
          ? (log.peso_nuevo - log.peso_anterior).toFixed(2)
          : (log.peso_registrado || log.cantidad_movida || '--'),
        Cantidad: log.cantidad_movida || '--',
        Usuario: log.usuario || '--',
        'Comprobante': log.comprobante_url ? 'Sí' : 'No',
        'URL Comprobante': log.comprobante_url || '--'
      }))
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'sales' ? 'Ventas' : 'Movimientos')
    XLSX.writeFile(wb, fileName)
    toast.success('Archivo Excel exportado')
  }

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'high': return '#e74c3c'
      case 'medium': return '#f39c12'
      case 'low': return '#3498db'
      default: return '#95a5a6'
    }
  }

  return (
    <div className='dashboard'>
      <Toaster />
      <header
        className='dashboard__header'
        style={{ background: '#2c3e50', color: 'white', padding: '1rem' }}
      >
        <div>
          <h1 className='dashboard__title' style={{ color: 'white' }}>
            Admin Panel
          </h1>
          <small>{auth.currentUser?.email}</small>
        </div>
        <button className='dashboard__logout' onClick={() => signOut(auth)}>
          Salir
        </button>
      </header>

      {/* ALERTAS */}
      {alerts.length > 0 && (
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h3 style={{ marginTop: 0, color: '#856404' }}>
            Alertas ({alerts.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px',
                  background: 'white',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${getAlertColor(alert.severity)}`,
                  fontSize: '0.9rem'
                }}
              >
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'end',
          border: '1px solid #ddd'
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 'bold' }}>Restaurante:</label>
          <select
            style={{ width: '100%', padding: '10px' }}
            value={selectedRestaurantId}
            onChange={e => setSelectedRestaurantId(e.target.value)}
          >
            <option value=''>-- Selecciona --</option>
            {RESTAURANTS.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 'bold' }}>Fecha:</label>
          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
            <button
              onClick={() => {
                const todayShift = getShiftDate()
                setDate(todayShift)
              }}
              style={{
                padding: '8px 12px',
                background: date === getShiftDate() ? '#3498db' : '#ecf0f1',
                color: date === getShiftDate() ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold'
              }}
            >
              Turno Actual
            </button>
            <button
              onClick={() => {
                const todayShift = getShiftDate()
                const yesterdayShift = new Date(todayShift)
                yesterdayShift.setDate(yesterdayShift.getDate() - 1)
                setDate(yesterdayShift.toISOString().split('T')[0])
              }}
              style={{
                padding: '8px 12px',
                background: '#ecf0f1',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold'
              }}
            >
              Turno Anterior
            </button>
            <input
              type='date'
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              value={date}
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]} // No permitir fechas futuras
            />
          </div>
          <small style={{ color: '#7f8c8d', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            Un turno va de 4pm a 3am del día siguiente. Selecciona la fecha del inicio del turno (4pm).
          </small>
        </div>
        <button
          onClick={fetchReport}
          style={{
            padding: '10px 20px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Ver Reporte
        </button>
        {(activeTab === 'sales' || activeTab === 'movements') && (
          <button
            onClick={exportToExcel}
            style={{
              padding: '10px 20px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Exportar Excel 📊
          </button>
        )}
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '5px' }}>
        <button
          onClick={() => setActiveTab('sales')}
          style={{
            padding: '10px',
            background: activeTab === 'sales' ? '#3498db' : '#ecf0f1',
            color: activeTab === 'sales' ? 'white' : '#333'
          }}
        >
          Ventas (Cortes)
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          style={{
            padding: '10px',
            background: activeTab === 'movements' ? '#3498db' : '#ecf0f1',
            color: activeTab === 'movements' ? 'white' : '#333'
          }}
        >
          Movimientos
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '10px',
            background: activeTab === 'inventory' ? '#3498db' : '#ecf0f1',
            color: activeTab === 'inventory' ? 'white' : '#333'
          }}
        >
          Stock Total
        </button>
        <button
          onClick={() => setActiveTab('cierre')}
          style={{
            padding: '10px',
            background: activeTab === 'cierre' ? '#3498db' : '#ecf0f1',
            color: activeTab === 'cierre' ? 'white' : '#333'
          }}
        >
          Cierres de Turno
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          {/* Indicador de fecha consultada */}
          <div style={{
            background: '#e8f4f8',
            padding: '10px 15px',
            borderRadius: '6px',
            marginBottom: '1rem',
            borderLeft: '4px solid #3498db'
          }}>
            <strong style={{ color: '#2c3e50' }}>
              📅 Consultando turno del: {new Date(date).toLocaleDateString('es-MX', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} (4pm - 3am)
            </strong>
            {activeTab === 'sales' && salesData.length > 0 && (
              <span style={{ marginLeft: '15px', color: '#7f8c8d' }}>
                ({salesData.length} {salesData.length === 1 ? 'botella registrada' : 'botellas registradas'})
              </span>
            )}
            {activeTab === 'movements' && movementsData.length > 0 && (
              <span style={{ marginLeft: '15px', color: '#7f8c8d' }}>
                ({movementsData.length} {movementsData.length === 1 ? 'movimiento registrado' : 'movimientos registrados'})
              </span>
            )}
          </div>

          {activeTab === 'sales' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Botella</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Peso Inicial</th>
                    <th style={thStyle}>Peso Final</th>
                    <th style={thStyle}>Consumo</th>
                    <th style={thStyle}>Venta Est.</th>
                    <th style={thStyle}>Comprobante</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map(item => {
                    const isSuspicious = item.peso_fin > item.peso_inicio
                    return (
                      <tr 
                        key={item.id}
                        style={{
                          background: isSuspicious ? '#ffe6e6' : 'transparent'
                        }}
                      >
                        <td style={tdStyle}>
                          <b>{item.botella}</b>
                          {isSuspicious && (
                            <span style={{ color: '#e74c3c', marginLeft: '8px' }}>⚠️</span>
                          )}
                        </td>
                        <td style={tdStyle}>{item.categoria}</td>
                        <td style={tdStyle}>{item.peso_inicio?.toFixed(2) || 0}</td>
                        <td style={tdStyle}>
                          <span style={{ 
                            color: isSuspicious ? '#e74c3c' : '#2c3e50',
                            fontWeight: isSuspicious ? 'bold' : 'normal'
                          }}>
                            {item.peso_fin?.toFixed(2) || 0}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {(item.consumo_peso || 0).toFixed(2)}
                        </td>
                        <td style={tdStyle}>
                          {calculateConsumption(item)}
                        </td>
                        <td style={tdStyle}>
                          {item.comprobante_url ? (
                            <a
                              href={item.comprobante_url}
                              target='_blank'
                              style={{ color: '#3498db', fontWeight: 'bold' }}
                            >
                              Ver Foto 📸
                            </a>
                          ) : (
                            <span style={{ color: '#e74c3c' }}>Sin comprobante</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => setSelectedBottleDetail({
                              bottleName: item.botella,
                              restaurantId: selectedRestaurantId,
                              date: date
                            })}
                            style={{
                              padding: '4px 12px',
                              background: '#3498db',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            Ver Historial
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'movements' && (
            <div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Hora</th>
                    <th style={thStyle}>Acción</th>
                    <th style={thStyle}>Botella</th>
                    <th style={thStyle}>Peso Anterior</th>
                    <th style={thStyle}>Peso Nuevo</th>
                    <th style={thStyle}>Diferencia</th>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Comprobante</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsData.map(log => {
                    const hasNoProof = (log.accion === 'CONSUMO' || log.accion === 'AJUSTE') && !log.comprobante_url
                    const isOutsideHours = log.fecha && !isWithinOperatingHours(log.fecha)
                    const isTrago = log.accion === 'TRAGO'
                    return (
                      <tr 
                        key={log.id}
                        style={{
                          background: hasNoProof ? '#fff3cd' : (isOutsideHours ? '#e8f4f8' : (isTrago ? '#e8f4f8' : 'transparent'))
                        }}
                      >
                        <td style={tdStyle}>
                          {log.fechaTimestamp 
                            ? log.fechaTimestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                            : (log.fecha?.seconds 
                              ? new Date(log.fecha.seconds * 1000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                              : '--')}
                          {isOutsideHours && <span style={{ color: '#3498db', marginLeft: '4px' }}>⏰</span>}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: 'white',
                              background:
                                log.accion === 'ALTA'
                                  ? '#27ae60'
                                  : log.accion === 'CONSUMO'
                                  ? '#f39c12'
                                  : log.accion === 'TRAGO'
                                  ? '#3498db'
                                  : '#c0392b'
                            }}
                          >
                            {log.accion === 'TRAGO' ? '🍹 TRAGO' : log.accion}
                          </span>
                          {log.accion === 'TRAGO' && log.trago_info && (
                            <div style={{ fontSize: '0.75rem', color: '#7f8c8d', marginTop: '2px' }}>
                              Botellas: {log.trago_info.botellas_usadas?.join(', ') || 'N/A'}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {log.botella}
                        </td>
                        <td style={tdStyle}>
                          {log.bottle_id ? (
                            <span style={{ fontWeight: 'bold', color: '#3498db' }}>ID: {log.bottle_id}</span>
                          ) : (
                            <span style={{ color: '#95a5a6' }}>--</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {log.peso_anterior !== null && log.peso_anterior !== undefined
                            ? `${log.peso_anterior.toFixed(2)}`
                            : '--'}
                        </td>
                        <td style={tdStyle}>
                          {log.peso_nuevo !== null && log.peso_nuevo !== undefined
                            ? `${log.peso_nuevo.toFixed(2)}`
                            : '--'}
                        </td>
                        <td style={tdStyle}>
                          {log.peso_anterior !== null && log.peso_nuevo !== null ? (
                            <span style={{
                              color: log.peso_nuevo < log.peso_anterior ? '#e74c3c' : '#27ae60',
                              fontWeight: 'bold'
                            }}>
                              {log.peso_nuevo < log.peso_anterior ? '-' : '+'}
                              {Math.abs(log.peso_nuevo - log.peso_anterior).toFixed(2)}
                            </span>
                          ) : (
                            log.accion === 'CONSUMO' || log.accion === 'AJUSTE'
                              ? log.peso_registrado
                              : log.cantidad_movida || '--'
                          )}
                        </td>
                        <td style={tdStyle}>{log.usuario}</td>
                        <td style={tdStyle}>
                          {log.comprobante_url ? (
                            <a
                              href={log.comprobante_url}
                              target='_blank'
                              rel='noopener noreferrer'
                              style={{ color: '#3498db', fontWeight: 'bold' }}
                            >
                              Ver Foto 📸
                            </a>
                          ) : (
                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                              Sin comprobante {hasNoProof && '⚠️'}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => setSelectedBottleDetail({
                              bottleName: log.botella,
                              restaurantId: selectedRestaurantId,
                              date: date
                            })}
                            style={{
                              padding: '4px 12px',
                              background: '#3498db',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            Ver Historial
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'cierre' && (
            <div>
              {loading ? (
                <p>Cargando cierres...</p>
              ) : cierreData.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d', padding: '2rem' }}>
                  No hay cierres registrados para este turno.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {cierreData.map((cierre, idx) => {
                    // Buscar el último movimiento registrado para esta botella en el turno
                    const movimientosBotella = movementsData
                      .filter(m => m.botella === cierre.botella)
                      .sort((a, b) => {
                        const dateA = a.fechaTimestamp || (a.fecha?.seconds ? new Date(a.fecha.seconds * 1000) : new Date(0))
                        const dateB = b.fechaTimestamp || (b.fecha?.seconds ? new Date(b.fecha.seconds * 1000) : new Date(0))
                        return dateB - dateA
                      })
                    const ultimoMovimiento = movimientosBotella[0]
                    const pesoUltimoMovimiento = ultimoMovimiento?.peso_nuevo !== null && ultimoMovimiento?.peso_nuevo !== undefined 
                      ? ultimoMovimiento.peso_nuevo 
                      : (ultimoMovimiento?.peso_registrado || null)
                    
                    const pesoFinalRegistrado = cierre.peso_final_registrado || 0
                    
                    // Comparar con el último movimiento (si existe)
                    const diferenciaConMovimiento = pesoUltimoMovimiento !== null 
                      ? Math.abs(pesoUltimoMovimiento - pesoFinalRegistrado)
                      : null
                    const tieneDiscrepancia = diferenciaConMovimiento !== null && diferenciaConMovimiento > 5 // Más de 5gr de diferencia
                    
                    return (
                      <div
                        key={cierre.id || idx}
                        style={{
                          background: 'white',
                          padding: '1.5rem',
                          borderRadius: '8px',
                          border: `2px solid ${tieneDiscrepancia ? '#e74c3c' : '#27ae60'}`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#2c3e50' }}>
                          {cierre.botella}
                        </h3>
                        
                        {/* Foto del pesaje */}
                        {cierre.foto_pesaje_url && (
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#34495e' }}>
                              Foto del Pesaje:
                            </label>
                            <img
                              src={cierre.foto_pesaje_url}
                              alt={`Pesaje ${cierre.botella}`}
                              style={{
                                width: '100%',
                                maxHeight: '250px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                background: '#f8f9fa'
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Comparación de pesos */}
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>Peso registrado en cierre:</span>
                            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#3498db' }}>
                              {pesoFinalRegistrado.toFixed(2)} gr
                            </span>
                          </div>
                          
                          {ultimoMovimiento && pesoUltimoMovimiento !== null ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                                  Último movimiento ({ultimoMovimiento.accion}):
                                </span>
                                <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2c3e50' }}>
                                  {pesoUltimoMovimiento.toFixed(2)} gr
                                </span>
                              </div>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                padding: '8px',
                                background: tieneDiscrepancia ? '#fee' : '#efe',
                                borderRadius: '4px',
                                border: `1px solid ${tieneDiscrepancia ? '#e74c3c' : '#27ae60'}`
                              }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: tieneDiscrepancia ? '#e74c3c' : '#27ae60' }}>
                                  Diferencia:
                                </span>
                                <span style={{ fontSize: '1rem', fontWeight: 'bold', color: tieneDiscrepancia ? '#e74c3c' : '#27ae60' }}>
                                  {diferenciaConMovimiento.toFixed(2)} gr
                                  {tieneDiscrepancia && ' ⚠️'}
                                </span>
                              </div>
                              {tieneDiscrepancia && (
                                <div style={{
                                  marginTop: '0.5rem',
                                  padding: '10px',
                                  background: '#fff3cd',
                                  border: '2px solid #ffc107',
                                  borderRadius: '4px',
                                  color: '#856404',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold'
                                }}>
                                  ⚠️ ALERTA: El peso del cierre no coincide con el último movimiento registrado
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ 
                              padding: '8px',
                              background: '#fff3cd',
                              borderRadius: '4px',
                              border: '1px solid #ffc107',
                              color: '#856404',
                              fontSize: '0.85rem'
                            }}>
                              ⓘ No hay movimientos registrados para comparar
                            </div>
                          )}
                        </div>
                        
                        {/* Información adicional */}
                        <div style={{ fontSize: '0.85rem', color: '#7f8c8d', borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
                          <div>Usuario: {cierre.usuario}</div>
                          {cierre.timestamp && (
                            <div>Fecha: {cierre.timestamp.toLocaleString('es-MX')}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '1rem'
              }}
            >
              {Object.values(currentInventory)
                .filter(b => b.cantidad > 0)
                .map((bottle, idx) => {
                  const totalWeight = (bottle.botellas || []).reduce((acc, b) => acc + parseFloat(b.peso || 0), 0)
                  const restaurantName = salesData.length > 0 
                    ? salesData[0].restaurante_nombre 
                    : selectedRestaurantId
                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'white',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #eee',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <h4 style={{ marginBottom: '0', marginTop: '0' }}>{bottle.name}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#27ae60' }}>
                          Stock: {bottle.cantidad}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                          Peso: {totalWeight.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={() => setSelectedBottleDetail({
                            bottleName: bottle.name,
                            restaurantId: selectedRestaurantId,
                            date: date
                          })}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold'
                          }}
                        >
                          Ver Historial
                        </button>
                        <button
                          onClick={() => setSelectedBottleForEdit({
                            ...bottle,
                            restaurantId: selectedRestaurantId,
                            restaurantName: restaurantName
                          })}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: '#f39c12',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold'
                          }}
                        >
                          Editar Pesos
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {/* MODAL DE DETALLES DE BOTELLA */}
      {selectedBottleDetail && (
        <BottleDetailModal
          bottleName={selectedBottleDetail.bottleName}
          restaurantId={selectedBottleDetail.restaurantId}
          date={selectedBottleDetail.date}
          onClose={() => setSelectedBottleDetail(null)}
        />
      )}

      {/* MODAL DE EDICIÓN DE PESOS */}
      {selectedBottleForEdit && (
        <EditBottleWeightModal
          bottle={selectedBottleForEdit}
          restaurantId={selectedBottleForEdit.restaurantId}
          restaurantName={selectedBottleForEdit.restaurantName}
          onClose={() => {
            setSelectedBottleForEdit(null)
            // Refrescar inventario después de editar
            if (activeTab === 'inventory') {
              fetchReport()
            }
          }}
          onUpdate={() => {
            // Refrescar inventario después de actualizar
            if (activeTab === 'inventory') {
              fetchReport()
            }
          }}
        />
      )}
    </div>
  )
}

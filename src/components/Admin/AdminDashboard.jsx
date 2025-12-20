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
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('sales')

  const [salesData, setSalesData] = useState([])
  const [movementsData, setMovementsData] = useState([])
  const [currentInventory, setCurrentInventory] = useState({})
  const [loading, setLoading] = useState(false)

  const fetchReport = async () => {
    if (!selectedRestaurantId) return
    setLoading(true)
    setSalesData([])
    setMovementsData([])

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
      const logsQuery = query(
        collection(db, 'stock_logs'),
        where('restaurante_id', '==', selectedRestaurantId),
        where('fecha_string', '==', date)
      )
      const logsSnap = await getDocs(logsQuery)
      const logs = []
      logsSnap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }))
      setMovementsData(logs)

      // STOCK ACTUAL
      if (activeTab === 'inventory') {
        const invRef = doc(db, 'inventories', selectedRestaurantId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) setCurrentInventory(invSnap.data())
        else setCurrentInventory({})
      }
      toast.success('Datos actualizados')
    } catch (error) {
      console.error(error)
      toast.error('Error al obtener datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedRestaurantId) fetchReport()
  }, [selectedRestaurantId, date, activeTab])

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
          <input
            type='date'
            style={{ width: '100%', padding: '10px' }}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
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
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          {activeTab === 'sales' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Botella</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Consumo</th>
                    <th style={thStyle}>Venta Est.</th>
                    <th style={thStyle}>Comprobante (Cierre)</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map(item => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        <b>{item.botella}</b>
                      </td>
                      <td style={tdStyle}>{item.categoria}</td>
                      <td style={tdStyle}>
                        {(item.consumo_peso || 0).toFixed(2)}
                      </td>
                      <td style={tdStyle} >
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
                          '--'
                        )}
                      </td>
                    </tr>
                  ))}
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
                    <th style={thStyle}>Cant./Dif</th>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsData.map(log => (
                    <tr key={log.id}>
                      <td style={tdStyle}>
                        {new Date(log.fecha.seconds * 1000).toLocaleTimeString(
                          [],
                          { hour: '2-digit', minute: '2-digit' }
                        )}
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
                                : '#c0392b'
                          }}
                        >
                          {log.accion}
                        </span>
                      </td>
                      <td style={tdStyle}>{log.botella}</td>
                      <td style={tdStyle}>
                        {log.accion === 'CONSUMO' || log.accion === 'AJUSTE'
                          ? log.peso_registrado
                          : log.cantidad_movida}
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
                          <span style={{ color: '#ccc' }}>--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '1rem'
              }}
            >
              {Object.values(currentInventory)
                .filter(b => b.cantidad > 0)
                .map((bottle, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid #eee'
                    }}
                  >
                    <h4 style={{ marginBottom: '0.5rem' }}>{bottle.name}</h4>
                    <span
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#27ae60'
                      }}
                    >
                      Stock: {bottle.cantidad}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'
import React, { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import toast from 'react-hot-toast'

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
}

const modalContentStyle = {
  background: 'white',
  borderRadius: '12px',
  padding: '2rem',
  maxWidth: '900px',
  width: '90%',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '1rem',
  fontSize: '0.9rem'
}

const thStyle = {
  background: '#2c3e50',
  color: 'white',
  padding: '10px',
  textAlign: 'left',
  position: 'sticky',
  top: 0
}

const tdStyle = {
  borderBottom: '1px solid #ddd',
  padding: '10px'
}

export default function BottleDetailModal({ bottleName, restaurantId, date, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (bottleName && restaurantId) {
      fetchHistory()
    }
  }, [bottleName, restaurantId, date])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      // Obtener todos los movimientos de esta botella en el restaurante
      const logsQuery = query(
        collection(db, 'stock_logs'),
        where('restaurante_id', '==', restaurantId),
        where('botella', '==', bottleName)
      )
      const logsSnap = await getDocs(logsQuery)
      const logs = []
      logsSnap.forEach(doc => {
        const data = doc.data()
        logs.push({
          id: doc.id,
          ...data,
          fechaTimestamp: data.fecha?.seconds ? new Date(data.fecha.seconds * 1000) : new Date()
        })
      })
      // Ordenar por fecha descendente en memoria
      logs.sort((a, b) => {
        const dateA = a.fechaTimestamp || (a.fecha?.seconds ? new Date(a.fecha.seconds * 1000) : new Date(0))
        const dateB = b.fechaTimestamp || (b.fecha?.seconds ? new Date(b.fecha.seconds * 1000) : new Date(0))
        return dateB - dateA
      })
      setHistory(logs)
    } catch (error) {
      console.error(error)
      toast.error('Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '--'
    const date = timestamp.fechaTimestamp || (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date())
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionColor = (accion) => {
    switch (accion) {
      case 'ALTA': return '#27ae60'
      case 'CONSUMO': return '#f39c12'
      case 'AJUSTE': return '#e74c3c'
      case 'BAJA': return '#c0392b'
      default: return '#95a5a6'
    }
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>
            Historial: {bottleName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Cerrar ✕
          </button>
        </div>

        {loading ? (
          <p>Cargando historial...</p>
        ) : history.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#95a5a6', padding: '2rem' }}>
            No hay movimientos registrados para esta botella
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                  <tr>
                    <th style={thStyle}>Fecha y Hora</th>
                    <th style={thStyle}>Acción</th>
                    <th style={thStyle}>ID Botella</th>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Peso Anterior</th>
                    <th style={thStyle}>Peso Nuevo</th>
                    <th style={thStyle}>Diferencia</th>
                    <th style={thStyle}>Cantidad</th>
                    <th style={thStyle}>Comprobante</th>
                  </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id}>
                    <td style={tdStyle}>{formatDateTime(log)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          color: 'white',
                          background: getActionColor(log.accion),
                          fontWeight: 'bold',
                          fontSize: '0.85rem'
                        }}
                      >
                        {log.accion}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {log.bottle_id ? (
                        <span style={{ fontWeight: 'bold', color: '#3498db' }}>ID: {log.bottle_id}</span>
                      ) : (
                        <span style={{ color: '#95a5a6' }}>--</span>
                      )}
                    </td>
                    <td style={tdStyle}>{log.usuario || '--'}</td>
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
                      {log.peso_anterior !== null && log.peso_nuevo !== null
                        ? (
                          <span style={{
                            color: log.peso_nuevo < log.peso_anterior ? '#e74c3c' : '#27ae60',
                            fontWeight: 'bold'
                          }}>
                            {log.peso_nuevo < log.peso_anterior ? '-' : '+'}
                            {Math.abs(log.peso_nuevo - log.peso_anterior).toFixed(2)}
                          </span>
                        )
                        : log.peso_registrado !== undefined
                        ? `${log.peso_registrado > 0 ? '+' : ''}${log.peso_registrado.toFixed(2)}`
                        : log.cantidad_movida || '--'}
                    </td>
                    <td style={tdStyle}>
                      {log.cantidad_movida ? log.cantidad_movida : '--'}
                    </td>
                    <td style={tdStyle}>
                      {log.comprobante_url ? (
                        <a
                          href={log.comprobante_url}
                          target='_blank'
                          rel='noopener noreferrer'
                          style={{ color: '#3498db', fontWeight: 'bold' }}
                        >
                          Ver 📸
                        </a>
                      ) : (
                        <span style={{ color: '#e74c3c' }}>Sin comprobante</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


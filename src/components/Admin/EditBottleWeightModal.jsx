'use client'
import React, { useState } from 'react'
import { auth, db } from '../../lib/firebase'
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
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
  maxWidth: '600px',
  width: '90%',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
}

export default function EditBottleWeightModal({ bottle, restaurantId, restaurantName, onClose, onUpdate }) {
  const [bottlesList, setBottlesList] = useState(bottle.botellas || [])
  const [editingIndex, setEditingIndex] = useState(null)
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)

  // Función para obtener la fecha del turno (4pm-3am)
  const getShiftDate = () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 16) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    return now.toISOString().split('T')[0];
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index)
    setNewWeight(bottlesList[index]?.peso || '')
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setNewWeight('')
  }

  const handleSaveWeight = async (index) => {
    const weight = parseFloat(newWeight)
    if (isNaN(weight)) {
      toast.error('Peso inválido')
      return
    }

    const bottleToEdit = bottlesList[index]
    const previousWeight = bottleToEdit?.peso || 0
    const diff = previousWeight - weight

    if (diff === 0) {
      toast('Sin cambios', { icon: 'ℹ️' })
      handleCancelEdit()
      return
    }

    setSaving(true)
    try {
      // Actualizar el peso en la lista local
      const updatedList = [...bottlesList]
      updatedList[index] = {
        ...bottleToEdit,
        peso: weight
      }
      setBottlesList(updatedList)

      // Calcular peso total
      const totalWeight = updatedList.reduce((acc, b) => acc + parseFloat(b.peso || 0), 0)

      // Actualizar inventario en Firestore
      const invRef = doc(db, 'inventories', restaurantId)
      const invSnap = await getDoc(invRef)
      const inventory = invSnap.exists() ? invSnap.data() : {}
      
      const updatedBottle = {
        ...bottle,
        botellas: updatedList,
        cantidad: updatedList.length,
        peso_fin: totalWeight
      }

      await setDoc(invRef, {
        ...inventory,
        [bottle.name]: updatedBottle
      }, { merge: true })

      // Registrar el ajuste en stock_logs
      const shiftDate = getShiftDate()
      await addDoc(collection(db, 'stock_logs'), {
        restaurante_id: restaurantId,
        restaurante_nombre: restaurantName,
        usuario: 'ADMIN - ' + (auth?.currentUser?.email || 'Sistema'),
        botella: bottle.name,
        categoria: bottle.categoria || '',
        accion: 'AJUSTE',
        cantidad_movida: 0,
        peso_registrado: Math.abs(diff),
        peso_anterior: previousWeight,
        peso_nuevo: weight,
        bottle_id: bottleToEdit?.bottleId || null,
        comprobante_url: null, // Admin no requiere comprobante
        fecha: serverTimestamp(),
        fecha_string: shiftDate
      })

      toast.success(`Peso actualizado: ${previousWeight.toFixed(2)} → ${weight.toFixed(2)}`)
      handleCancelEdit()
      
      // Notificar al componente padre para refrescar datos
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error(error)
      toast.error('Error al actualizar peso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>
            Editar Pesos: {bottle.name}
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

        {bottlesList.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#95a5a6', padding: '2rem' }}>
            No hay botellas cargadas
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#2c3e50', color: 'white' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>ID Botella</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Peso Actual</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Nuevo Peso</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bottlesList.map((b, index) => (
                  <tr key={b.id || index} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>
                      <strong style={{ color: '#3498db' }}>
                        {b.bottleId || `Botella ${index + 1}`}
                      </strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {b.peso?.toFixed(2) || '0.00'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {editingIndex === index ? (
                        <input
                          type="number"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          style={{
                            width: '100px',
                            padding: '5px',
                            border: '1px solid #27ae60',
                            borderRadius: '4px',
                            fontSize: '0.9rem'
                          }}
                          autoFocus
                        />
                      ) : (
                        <span style={{ color: '#95a5a6' }}>--</span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {editingIndex === index ? (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => handleSaveWeight(index)}
                            disabled={saving}
                            style={{
                              padding: '5px 12px',
                              background: '#27ae60',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              fontSize: '0.85rem',
                              opacity: saving ? 0.6 : 1
                            }}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            style={{
                              padding: '5px 12px',
                              background: '#95a5a6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(index)}
                          style={{
                            padding: '5px 12px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '1rem', padding: '10px', background: '#e8f4f8', borderRadius: '6px' }}>
          <small style={{ color: '#2c3e50', fontSize: '0.85rem' }}>
            💡 Como administrador, puedes modificar el peso de cualquier botella. Los cambios se registrarán como AJUSTE en el historial.
          </small>
        </div>
      </div>
    </div>
  )
}


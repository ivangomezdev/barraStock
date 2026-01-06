import React, { useState, useEffect } from 'react'
import { db, auth } from '../../lib/firebase'
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore'
import { BOTTLE_DATA } from '../../lib/data'
import toast from 'react-hot-toast'

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

export default function NuevoTrago({ restaurantId, restaurantName, inventory, onClose, onInventoryUpdate }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBottles, setSelectedBottles] = useState([]) // Array de { name, category, currentWeight, newWeight, bottleId }
  const [saving, setSaving] = useState(false)

  // Obtener botellas con stock disponible
  const getAvailableBottles = () => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return []

    let results = []
    
    // Buscar en todas las categorías
    Object.entries(BOTTLE_DATA).forEach(([category, bottleList]) => {
      bottleList.forEach(bottleName => {
        if (bottleName.toLowerCase().includes(term)) {
          const bottleData = inventory[bottleName]
          const stock = bottleData?.cantidad || 0
          
          // Solo mostrar botellas con stock > 0
          if (stock > 0) {
            // Obtener el peso actual de la primera botella disponible
            const botellas = bottleData?.botellas || []
            let currentWeight = 0
            let bottleId = null
            
            if (botellas.length > 0) {
              // Buscar la primera botella con peso > 0, o usar la primera disponible
              const firstBottleWithWeight = botellas.find(b => parseFloat(b.peso || 0) > 0) || botellas[0]
              currentWeight = parseFloat(firstBottleWithWeight.peso || 0)
              bottleId = firstBottleWithWeight.bottleId || null
            } else {
              // Si no hay botellas en el array, usar peso_fin o peso_inicio
              currentWeight = parseFloat(bottleData?.peso_fin || bottleData?.peso_inicio || 0)
            }
            
            results.push({
              name: bottleName,
              category: category,
              stock: stock,
              currentWeight: currentWeight,
              bottleId: bottleId,
              bottleData: bottleData
            })
          }
        }
      })
    })
    
    return results
  }

  const availableBottles = getAvailableBottles()

  const handleBottleSelect = (bottle) => {
    // Verificar si ya está seleccionada
    const isSelected = selectedBottles.some(b => b.name === bottle.name)
    
    if (isSelected) {
      // Remover de seleccionadas
      setSelectedBottles(prev => prev.filter(b => b.name !== bottle.name))
    } else {
      // Agregar a seleccionadas con peso actual
      setSelectedBottles(prev => [...prev, {
        name: bottle.name,
        category: bottle.category,
        currentWeight: bottle.currentWeight,
        newWeight: '',
        bottleId: bottle.bottleId,
        bottleData: bottle.bottleData
      }])
    }
  }

  const handleWeightChange = (bottleName, newWeight) => {
    setSelectedBottles(prev => prev.map(b => 
      b.name === bottleName 
        ? { ...b, newWeight: newWeight }
        : b
    ))
  }

  const handleSave = async () => {
    // Validar que todas las botellas seleccionadas tengan peso nuevo
    const missingWeights = selectedBottles.filter(b => !b.newWeight || parseFloat(b.newWeight) < 0)
    
    if (missingWeights.length > 0) {
      toast.error(`Falta ingresar el peso actual para: ${missingWeights.map(b => b.name).join(', ')}`)
      return
    }

    setSaving(true)
    try {
      const shiftDate = getShiftDate()
      
      // Cargar inventario actualizado
      const inventoryRef = doc(db, "inventories", restaurantId)
      const inventorySnap = await getDoc(inventoryRef)
      const currentInventory = inventorySnap.exists() ? inventorySnap.data() : {}
      const updatedInventory = { ...currentInventory }

      // Procesar cada botella seleccionada
      for (const selectedBottle of selectedBottles) {
        const bottleName = selectedBottle.name
        const previousWeight = parseFloat(selectedBottle.currentWeight)
        const newWeight = parseFloat(selectedBottle.newWeight)
        const diff = previousWeight - newWeight

        if (diff <= 0) {
          toast.error(`${bottleName}: El peso nuevo debe ser menor que el actual`)
          setSaving(false)
          return
        }

        // Actualizar el inventario
        const bottleData = updatedInventory[bottleName] || {
          name: bottleName,
          categoria: selectedBottle.category,
          cantidad: 0,
          botellas: [],
          peso_inicio: 0,
          peso_fin: 0
        }

        // Mantener peso_inicio si ya existe
        if (!bottleData.peso_inicio || bottleData.peso_inicio === 0) {
          // Si no hay peso_inicio, usar el peso anterior como referencia
          bottleData.peso_inicio = previousWeight
        }

        // Actualizar el peso de la botella específica
        if (bottleData.botellas && bottleData.botellas.length > 0) {
          // Si tenemos bottleId, buscar esa botella específica
          if (selectedBottle.bottleId) {
            const bottleIndex = bottleData.botellas.findIndex(b => 
              b.bottleId && b.bottleId.toString() === selectedBottle.bottleId.toString()
            )
            if (bottleIndex >= 0) {
              bottleData.botellas[bottleIndex].peso = newWeight
            } else {
              // Si no encontramos por bottleId, actualizar la primera
              bottleData.botellas[0].peso = newWeight
            }
          } else {
            // Si no hay bottleId, actualizar la primera botella
            bottleData.botellas[0].peso = newWeight
          }
          
          // Recalcular peso_fin
          bottleData.peso_fin = bottleData.botellas.reduce((acc, b) => acc + parseFloat(b.peso || 0), 0)
        }

        updatedInventory[bottleName] = bottleData

        // Registrar en stock_logs como TRAGO
        await addDoc(collection(db, "stock_logs"), {
          restaurante_id: restaurantId,
          restaurante_nombre: restaurantName,
          usuario: auth.currentUser.email,
          botella: bottleName,
          categoria: selectedBottle.category,
          accion: 'TRAGO',
          cantidad_movida: 0,
          peso_registrado: newWeight,
          peso_anterior: previousWeight,
          peso_nuevo: newWeight,
          bottle_id: selectedBottle.bottleId,
          comprobante_url: null,
          fecha: serverTimestamp(),
          fecha_string: shiftDate,
          trago_info: {
            botellas_usadas: selectedBottles.map(b => b.name),
            peso_consumido: diff
          }
        })
      }

      // Guardar inventario actualizado
      await setDoc(inventoryRef, updatedInventory, { merge: true })
      
      // Actualizar el inventario en el componente padre
      if (onInventoryUpdate) {
        onInventoryUpdate(updatedInventory)
      }

      toast.success(`Trago registrado: ${selectedBottles.length} botella${selectedBottles.length > 1 ? 's' : ''} actualizada${selectedBottles.length > 1 ? 's' : ''}`)
      onClose()
    } catch (error) {
      console.error('Error guardando trago:', error)
      toast.error('Error al guardar el trago')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>🍹 Nuevo Trago</h2>
          <button
            onClick={onClose}
            style={{
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        </div>

        <p style={{ color: '#7f8c8d', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Busca las botellas que usaste para preparar el trago y registra el peso actual después de servir.
        </p>

        {/* Búsqueda de botellas */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#34495e' }}>
            🔍 Buscar Botella:
          </label>
          <input
            type="text"
            placeholder="Ej: Gin, Tónica, Vodka..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Lista de botellas disponibles */}
        {searchTerm && availableBottles.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#2c3e50', fontSize: '1rem' }}>
              Botellas Disponibles (Stock &gt; 0):
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.5rem',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '10px',
              border: '1px solid #eee',
              borderRadius: '4px'
            }}>
              {availableBottles.map(bottle => {
                const isSelected = selectedBottles.some(b => b.name === bottle.name)
                return (
                  <div
                    key={bottle.name}
                    onClick={() => handleBottleSelect(bottle)}
                    style={{
                      padding: '10px',
                      border: `2px solid ${isSelected ? '#27ae60' : '#ddd'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isSelected ? '#e8f5e9' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{bottle.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#7f8c8d' }}>
                      {bottle.category} • Stock: {bottle.stock}
                    </div>
                    {isSelected && (
                      <div style={{ fontSize: '0.75rem', color: '#27ae60', marginTop: '5px' }}>
                        ✓ Seleccionada
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {searchTerm && availableBottles.length === 0 && (
          <div style={{ 
            padding: '1rem', 
            background: '#fff3cd', 
            borderRadius: '4px', 
            marginBottom: '1.5rem',
            color: '#856404'
          }}>
            No se encontraron botellas con stock disponible que coincidan con "{searchTerm}"
          </div>
        )}

        {/* Botellas seleccionadas */}
        {selectedBottles.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>
              Botellas Seleccionadas ({selectedBottles.length}):
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedBottles.map(bottle => (
                <div
                  key={bottle.name}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: '#f8f9fa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#2c3e50' }}>{bottle.name}</h4>
                      <small style={{ color: '#7f8c8d' }}>{bottle.category}</small>
                    </div>
                    <button
                      onClick={() => handleBottleSelect({ name: bottle.name })}
                      style={{
                        background: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#7f8c8d' }}>
                        Peso Anterior:
                      </label>
                      <input
                        type="number"
                        value={bottle.currentWeight}
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          background: '#f5f5f5',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#34495e' }}>
                        Peso Actual (después de servir) *:
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 850"
                        value={bottle.newWeight}
                        onChange={(e) => handleWeightChange(bottle.name, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                  </div>
                  
                  {bottle.newWeight && parseFloat(bottle.newWeight) >= 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#27ae60' }}>
                      Consumo: {(bottle.currentWeight - parseFloat(bottle.newWeight)).toFixed(2)} gr
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedBottles.length === 0}
            style={{
              padding: '12px 24px',
              background: (saving || selectedBottles.length === 0) ? '#95a5a6' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (saving || selectedBottles.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {saving ? 'Guardando...' : `Guardar Trago (${selectedBottles.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}


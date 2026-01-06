import React, { useState, useEffect } from 'react'
import { db, auth } from '../../lib/firebase'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'

// --- CONFIGURACIÓN IMGBB ---
const IMGBB_API_KEY = 'e69966f319cd4a033a3a6eb09c8df789';

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

const uploadImage = async (file) => {
  if (!file) return null;
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.success) {
      return data.data.url;
    }
    return null;
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    return null;
  }
};

export default function CierreTurno({ restaurantId, restaurantName, onClose }) {
  const [bottlesWithMovements, setBottlesWithMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bottleWeights, setBottleWeights] = useState({}) // { botellaName: { peso: '', foto: null } }
  const [uploadingPhotos, setUploadingPhotos] = useState({}) // { botellaName: true/false }

  useEffect(() => {
    fetchBottlesWithMovements()
  }, [restaurantId])

  const fetchBottlesWithMovements = async () => {
    if (!restaurantId) return
    setLoading(true)
    try {
      const shiftDate = getShiftDate()
      // Obtener todos los movimientos del turno actual
      const logsQuery = query(
        collection(db, 'stock_logs'),
        where('restaurante_id', '==', restaurantId),
        where('fecha_string', '==', shiftDate)
      )
      const logsSnap = await getDocs(logsQuery)
      
      // Obtener botellas únicas que tuvieron movimientos
      const uniqueBottles = new Set()
      logsSnap.forEach(doc => {
        const data = doc.data()
        if (data.botella) {
          uniqueBottles.add(data.botella)
        }
      })
      
      const bottlesArray = Array.from(uniqueBottles).map(botellaName => ({
        name: botellaName,
        peso: '',
        foto: null,
        fotoUrl: null
      }))
      
      setBottlesWithMovements(bottlesArray)
      
      // Inicializar estados de pesos y fotos
      const initialWeights = {}
      bottlesArray.forEach(b => {
        initialWeights[b.name] = { peso: '', foto: null, fotoUrl: null }
      })
      setBottleWeights(initialWeights)
    } catch (error) {
      console.error('Error obteniendo botellas con movimientos:', error)
      toast.error('Error al cargar botellas con movimientos')
    } finally {
      setLoading(false)
    }
  }

  const handleWeightChange = (botellaName, value) => {
    setBottleWeights(prev => ({
      ...prev,
      [botellaName]: {
        ...prev[botellaName],
        peso: value
      }
    }))
  }

  const handlePhotoChange = async (botellaName, file) => {
    if (!file) return
    
    setUploadingPhotos(prev => ({ ...prev, [botellaName]: true }))
    
    const imageUrl = await uploadImage(file)
    
    setUploadingPhotos(prev => ({ ...prev, [botellaName]: false }))
    
    if (imageUrl) {
      setBottleWeights(prev => ({
        ...prev,
        [botellaName]: {
          ...prev[botellaName],
          foto: file,
          fotoUrl: imageUrl
        }
      }))
      toast.success(`Foto de ${botellaName} subida correctamente`)
    } else {
      toast.error(`Error al subir foto de ${botellaName}`)
    }
  }

  const handleSaveCierre = async () => {
    // Validar que todas las botellas tengan peso y foto
    const missingData = []
    bottlesWithMovements.forEach(bottle => {
      const data = bottleWeights[bottle.name]
      if (!data || !data.peso || parseFloat(data.peso) < 0) {
        missingData.push(`${bottle.name} (falta peso)`)
      }
      if (!data || !data.fotoUrl) {
        missingData.push(`${bottle.name} (falta foto)`)
      }
    })

    if (missingData.length > 0) {
      toast.error(`Faltan datos: ${missingData.join(', ')}`)
      return
    }

    setSaving(true)
    try {
      const shiftDate = getShiftDate()
      
      // Guardar cada registro de cierre
      for (const bottle of bottlesWithMovements) {
        const data = bottleWeights[bottle.name]
        await addDoc(collection(db, 'cierre_turno'), {
          restaurante_id: restaurantId,
          restaurante_nombre: restaurantName,
          usuario: auth.currentUser.email,
          botella: bottle.name,
          peso_final_registrado: parseFloat(data.peso),
          foto_pesaje_url: data.fotoUrl,
          fecha_turno: shiftDate,
          timestamp: serverTimestamp()
        })
      }

      toast.success(`Cierre guardado para ${bottlesWithMovements.length} botella${bottlesWithMovements.length > 1 ? 's' : ''}`)
      onClose()
    } catch (error) {
      console.error('Error guardando cierre:', error)
      toast.error('Error al guardar el cierre')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p>Cargando botellas con movimientos...</p>
        </div>
      </div>
    )
  }

  if (bottlesWithMovements.length === 0) {
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
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '90%'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#2c3e50' }}>Cierre de Turno</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '1.5rem' }}>
            No hay botellas con movimientos en el turno actual.
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              width: '100%'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    )
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
          <h2 style={{ margin: 0, color: '#2c3e50' }}>Cierre de Turno</h2>
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
          Sube la foto del pesaje y registra el peso final de cada botella que tuvo movimientos en el turno.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {bottlesWithMovements.map(bottle => {
            const bottleData = bottleWeights[bottle.name] || { peso: '', foto: null, fotoUrl: null }
            const isUploading = uploadingPhotos[bottle.name] || false
            
            return (
              <div
                key={bottle.name}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  background: bottleData.fotoUrl && bottleData.peso ? '#f8f9fa' : 'white'
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#2c3e50' }}>{bottle.name}</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Campo de peso */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#34495e' }}>
                      Peso Final (gr/oz):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej: 1000"
                      value={bottleData.peso}
                      onChange={(e) => handleWeightChange(bottle.name, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>

                  {/* Campo de foto */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#34495e' }}>
                      Foto del Pesaje (Obligatorio):
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          handlePhotoChange(bottle.name, file)
                        }
                      }}
                      disabled={isUploading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}
                    />
                    {isUploading && (
                      <p style={{ margin: '5px 0', color: '#3498db', fontSize: '0.85rem' }}>
                        Subiendo foto...
                      </p>
                    )}
                    {bottleData.fotoUrl && (
                      <div style={{ marginTop: '10px' }}>
                        <img
                          src={bottleData.fotoUrl}
                          alt={`Pesaje ${bottle.name}`}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        />
                        <p style={{ margin: '5px 0', color: '#27ae60', fontSize: '0.85rem' }}>
                          ✓ Foto subida correctamente
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

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
            onClick={handleSaveCierre}
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: saving ? '#95a5a6' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {saving ? 'Guardando...' : `Guardar Cierre (${bottlesWithMovements.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}


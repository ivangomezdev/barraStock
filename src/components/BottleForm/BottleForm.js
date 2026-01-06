import React, { useState } from 'react';
import toast from 'react-hot-toast';

// --- CONFIGURACIÓN IMGBB ---
const IMGBB_API_KEY = 'e69966f319cd4a033a3a6eb09c8df789'; // <--- ¡RECUERDA TU API KEY!

export default function BottleForm({ bottle, onSave, onStockTransaction, onCancel }) {
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  // INICIALIZACIÓN
  const [bottlesList, setBottlesList] = useState(() => {
    if (bottle.botellas && Array.isArray(bottle.botellas)) {
      // Mantener los bottleId existentes, no asignar automáticamente
      return bottle.botellas.map((b, index) => ({
        ...b,
        id: b.id || Date.now() + index,
        bottleId: b.bottleId || null // Si no tiene bottleId, dejarlo como null (debe ingresarse)
      }));
    } else {
      return Array(bottle.cantidad || 0).fill(null).map((_, i) => ({
        id: Date.now() + i,
        bottleId: null, // Sin código hasta que se ingrese
        peso: 0 
      }));
    }
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [selectedBottleIndex, setSelectedBottleIndex] = useState(null); 
  const [editWeight, setEditWeight] = useState('');
  
  // Función para obtener el bottleId de una botella por índice
  const getBottleId = (index) => {
    if (index === null || index === undefined) return null;
    return bottlesList[index]?.bottleId || null; // Retornar null si no tiene código
  };
  
  // Guardamos la última URL de comprobante para enviarla al guardar todo
  const [lastProofUrl, setLastProofUrl] = useState(null);

  // Estados Modal
  const [modalType, setModalType] = useState(null); 
  const [inputQty, setInputQty] = useState('');
  const [inputWeight, setInputWeight] = useState('');
  const [inputBottleIds, setInputBottleIds] = useState(['']); // Array de códigos de barras para múltiples botellas 
  
  // ESTADO PARA FOTO
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- SUBIDA DE IMAGEN ---
  const uploadImage = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST', body: formData,
      });
      const data = await response.json();
      return data.success ? data.data.url : null;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error subiendo imagen");
      return null;
    }
  };

  const handleSelectBottle = (index) => {
    if (selectedBottleIndex === index) {
      setSelectedBottleIndex(null);
      setEditWeight('');
      setSelectedFile(null); // Limpiar archivo al deseleccionar
    } else {
      setSelectedBottleIndex(index);
      // No mostrar el peso anterior, solo permitir ingresar uno nuevo
      setEditWeight('');
      setSelectedFile(null);
    }
  };

  const handleCancelRequest = () => {
    if (hasChanges) setModalType('CONFIRM_EXIT');
    else onCancel();
  };

  const openAddModal = () => { 
    setModalType('ADD'); 
    setInputQty('1'); 
    setInputWeight(''); 
    setInputBottleIds(['']); // Inicializar con un campo vacío
    setSelectedFile(null); 
  };
  const openRemoveModal = () => { setModalType('REMOVE'); setInputQty(''); setSelectedFile(null); };
  
  // --- TRANSACCIÓN MASIVA (Alta/Baja) ---
  const handleConfirmTransaction = async () => {
    const qty = parseInt(inputQty);
    const weight = parseFloat(inputWeight);

    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    
    // Comprobante solo obligatorio para BAJA, no para ALTA
    if (modalType === 'REMOVE' && !selectedFile) {
      return toast.error("Debes subir comprobante para dar de baja");
    }

    let imageUrl = null;
    // Solo subir imagen si hay archivo seleccionado (para BAJA)
    if (selectedFile) {
      setIsUploading(true);
      imageUrl = await uploadImage(selectedFile);
      setIsUploading(false);
      if (!imageUrl) {
        toast.error("Error al subir comprobante");
        return;
      }
    }

    let newList = [...bottlesList];

    if (modalType === 'ADD') {
      if (!weight && weight !== 0) return toast.error("Indica peso");
      
      // Validar que todos los códigos de barras estén ingresados
      const bottleIdsToUse = inputBottleIds.slice(0, qty);
      const emptyIds = bottleIdsToUse.filter(id => !id || id.trim() === '');
      if (emptyIds.length > 0) {
        return toast.error(`Debes ingresar el código de barras para todas las ${qty} botella${qty > 1 ? 's' : ''}`);
      }
      
      // Validar que no haya códigos duplicados en la entrada
      const uniqueIds = new Set(bottleIdsToUse);
      if (uniqueIds.size !== bottleIdsToUse.length) {
        return toast.error("Los códigos de barras no pueden estar duplicados");
      }
      
      // Validar que los códigos no existan ya en las botellas existentes
      const existingIds = new Set(newList.map(b => b.bottleId?.toString().toLowerCase()));
      const duplicateIds = bottleIdsToUse.filter(id => existingIds.has(id.toString().toLowerCase()));
      if (duplicateIds.length > 0) {
        return toast.error(`El código de barras "${duplicateIds[0]}" ya existe. Cada botella debe tener un código único.`);
      }
      
      // Agregar las nuevas botellas con sus códigos de barras
      for (let i = 0; i < qty; i++) {
        newList.push({ 
          id: Date.now() + Math.random(), 
          bottleId: bottleIdsToUse[i].trim(), // Código de barras ingresado por el barman
          peso: weight 
        });
      }
      toast.success(`Agregadas ${qty} botella${qty > 1 ? 's' : ''} con sus códigos de barras`);
      // Para ALTA, pasamos el primer bottleId de las nuevas botellas
      const firstNewBottleId = bottleIdsToUse[0];
      onStockTransaction('ALTA', qty, weight, imageUrl, null, null, firstNewBottleId); 

    } else if (modalType === 'REMOVE') {
      if (qty > newList.length) return toast.error("Insuficientes botellas");
      newList.splice(newList.length - qty, qty);
      toast.success(`Baja registrada: ${qty}`);
      onStockTransaction('BAJA', qty, 0, imageUrl);
    }

    setBottlesList(newList);
    setHasChanges(true);
    setLastProofUrl(imageUrl); // Guardamos URL para el reporte
    setModalType(null);
    setSelectedBottleIndex(null);
  };

  // --- BORRADO INDIVIDUAL ---
  const handleDeleteSpecificBottle = async () => {
    if (selectedBottleIndex === null) return;
    if (!selectedFile) return toast.error("Sube foto para dar de baja");

    setIsUploading(true);
    const imageUrl = await uploadImage(selectedFile);
    setIsUploading(false);
    if (!imageUrl) return;

    const bottleToDelete = bottlesList[selectedBottleIndex];
    const newList = [...bottlesList];
    newList.splice(selectedBottleIndex, 1);
    
    setBottlesList(newList);
    setHasChanges(true);
    setLastProofUrl(imageUrl);
    setSelectedBottleIndex(null);
    setModalType(null);

    const bottleId = getBottleId(selectedBottleIndex);
    onStockTransaction('BAJA', 1, bottleToDelete.peso || 0, imageUrl, null, null, bottleId);
    toast.success("Botella dada de baja");
  };

  // --- ACTUALIZACION PESO (VENTA) ---
  const handleWeightUpdate = async () => {
    if (selectedBottleIndex === null) return;
    const newWeight = parseFloat(editWeight);
    if (isNaN(newWeight)) return;

    // VALIDACIÓN: FOTO OBLIGATORIA PARA CAMBIO DE PESO
    if (!selectedFile) {
        return toast.error("Sube el comprobante del consumo/venta");
    }

    setIsUploading(true);
    const imageUrl = await uploadImage(selectedFile);
    setIsUploading(false);
    
    if (!imageUrl) {
        toast.error("No se pudo subir la imagen. Intenta de nuevo.");
        return;
    }

    const newList = [...bottlesList];
    const previousWeight = newList[selectedBottleIndex].peso;
    newList[selectedBottleIndex].peso = newWeight;
    setBottlesList(newList);
    setHasChanges(true);
    setLastProofUrl(imageUrl); // Importante para que saveDailyWeights lo tenga
    
    const diff = previousWeight - newWeight;
    
    // REGISTRAMOS EL LOG DE CONSUMO CON LA FOTO
    if (diff !== 0) {
        // Log como 'CONSUMO' si bajó, o 'AJUSTE' si subió
        const actionType = diff > 0 ? 'CONSUMO' : 'AJUSTE';
        const bottleId = getBottleId(selectedBottleIndex);
        onStockTransaction(actionType, 0, diff, imageUrl, previousWeight, newWeight, bottleId);
        toast.success(diff > 0 ? `Consumo registrado: ${diff.toFixed(2)}` : `Peso ajustado`);
    } else {
        toast('Peso actualizado sin cambios', { icon: 'ℹ️' });
    }
    
    setSelectedBottleIndex(null); 
  };

  const handleDailySave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const totalStock = bottlesList.length;
    const totalWeight = bottlesList.reduce((acc, curr) => acc + (parseFloat(curr.peso)||0), 0);

    onSave({
      ...bottle,
      cantidad: totalStock,
      botellas: bottlesList,
      peso_fin: totalWeight,
      ultima_actualizacion: new Date().toISOString(),
      comprobante_url: lastProofUrl // Pasamos la URL al dashboard
    });
  };

  return (
    <div style={{position: 'relative'}}>
      
      {/* MODALES ALTA/BAJA/BORRADO */}
      {(modalType === 'ADD' || modalType === 'REMOVE' || modalType === 'CONFIRM_DELETE') && (
        <div className="sub-modal-overlay">
          <div className="sub-modal" style={{borderColor: modalType==='ADD'?'#ddd':'#e74c3c'}}>
            <h4>
                {modalType === 'ADD' && 'Ingreso de Stock'}
                {modalType === 'REMOVE' && 'Baja Masiva'}
                {modalType === 'CONFIRM_DELETE' && 'Baja Individual'}
            </h4>
            
            {(modalType === 'ADD' || modalType === 'REMOVE') && (
                <>
                    <label style={{display:'block', textAlign:'left'}}>Cantidad:</label>
                    <input 
                      type="number" 
                      value={inputQty} 
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 1;
                        setInputQty(e.target.value);
                        // Ajustar el array de códigos cuando cambia la cantidad
                        if (modalType === 'ADD') {
                          const newIds = Array(Math.max(1, newQty)).fill('').map((_, i) => inputBottleIds[i] || '');
                          setInputBottleIds(newIds);
                        }
                      }} 
                      autoFocus 
                      min="1"
                    />
                </>
            )}
            
            {modalType === 'ADD' && (
              <>
                <label style={{display:'block', textAlign:'left', marginTop:'10px'}}>Peso por botella:</label>
                <input type="number" placeholder="Ej: 1000" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} />
                
                <label style={{display:'block', textAlign:'left', marginTop:'15px', fontWeight:'bold', color:'#2c3e50'}}>
                  Códigos de Barras (Obligatorio - Uno por botella):
                </label>
                <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #ddd', borderRadius:'4px', padding:'10px', background:'#f8f9fa'}}>
                  {Array.from({ length: parseInt(inputQty) || 1 }).map((_, index) => (
                    <div key={index} style={{marginBottom:'8px'}}>
                      <label style={{display:'block', fontSize:'0.85rem', color:'#7f8c8d', marginBottom:'4px'}}>
                        Botella {index + 1}:
                      </label>
                      <input 
                        type="text" 
                        placeholder={`Ingresa código de barras ${index + 1}`}
                        value={inputBottleIds[index] || ''}
                        onChange={(e) => {
                          const newIds = [...inputBottleIds];
                          newIds[index] = e.target.value;
                          // Asegurar que el array tenga la longitud correcta
                          while (newIds.length < (parseInt(inputQty) || 1)) {
                            newIds.push('');
                          }
                          setInputBottleIds(newIds);
                        }}
                        style={{
                          width:'100%',
                          padding:'8px',
                          border:'1px solid #ccc',
                          borderRadius:'4px',
                          fontSize:'0.9rem',
                          background:'white'
                        }}
                      />
                    </div>
                  ))}
                </div>
                <small style={{display:'block', marginTop:'8px', color:'#e74c3c', fontSize:'0.8rem'}}>
                  ⚠️ El código de barras no se puede cambiar después de guardar. Verifica que sea correcto.
                </small>
              </>
            )}

            {/* INPUT FILE GENERAL - Solo para BAJA */}
            {modalType === 'REMOVE' && (
              <div style={{margin:'15px 0', textAlign:'left'}}>
                <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', color:'#e74c3c'}}>Comprobante (Obligatorio para baja):</label>
                <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} />
              </div>
            )}
            
            <div className="sub-modal-actions">
              <button className="btn btn--cancel" disabled={isUploading} onClick={() => setModalType(null)}>Cancelar</button>
              <button className="btn btn--save" disabled={isUploading} 
                onClick={modalType==='CONFIRM_DELETE' ? handleDeleteSpecificBottle : handleConfirmTransaction}
                style={{backgroundColor: modalType==='ADD'?'#27ae60':'#e74c3c'}}
              >
                {isUploading ? 'Subiendo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SALIDA */}
      {modalType === 'CONFIRM_EXIT' && (
        <div className="sub-modal-overlay">
          <div className="sub-modal" style={{borderColor: '#f39c12', maxWidth:'350px'}}>
            <h4 style={{color: '#f39c12'}}>Cambios sin guardar</h4>
            <p>¿Guardar antes de salir?</p>
            <div className="sub-modal-actions">
              <button className="btn" style={{backgroundColor: '#e74c3c', color: 'white'}} onClick={onCancel}>No</button>
              <button className="btn" style={{backgroundColor: '#27ae60', color: 'white'}} onClick={(e) => handleDailySave(e)}>Sí</button>
            </div>
          </div>
        </div>
      )}

      <form className="bottle-form" onSubmit={handleDailySave}>
        
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h3>{bottle.name}</h3>
          <p style={{ color: '#7f8c8d', fontSize:'0.9rem' }}>{fechaHoy}</p>
        </div>

        <div className="bottles-grid-container">
            {bottlesList.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '3rem 1rem',
                color: '#95a5a6',
                fontSize: '1.1rem'
              }}>
                No hay botellas cargadas
              </div>
            ) : (
              bottlesList.map((b, index) => {
                const bottleId = b.bottleId;
                return (
                  <div key={b.id || index} className={`bottle-square ${selectedBottleIndex === index ? 'selected' : ''}`} onClick={() => handleSelectBottle(index)}>
                      <div className="bottle-icon">🍾</div>
                      {/* Ocultar peso para prevenir fraudes - solo administración puede verlo */}
                      <span className="bottle-weight" style={{display: 'none'}}>{b.peso}</span>
                      <small style={{display: 'none'}}>gr/oz</small>
                      {bottleId ? (
                        <span className="bottle-index" style={{fontSize: '0.75rem', fontWeight: 'normal', color: '#7f8c8d'}}>{bottleId}</span>
                      ) : (
                        <span className="bottle-index" style={{fontSize: '0.7rem', fontWeight: 'normal', color: '#e74c3c'}}>Sin código</span>
                      )}
                  </div>
                );
              })
            )}
        </div>

        <div className="bottle-actions-area">
            {selectedBottleIndex !== null ? (
                <div className="edit-panel">
                    <label>
                      Registrar Consumo/Venta - Botella {bottlesList[selectedBottleIndex]?.bottleId ? `${bottlesList[selectedBottleIndex].bottleId}` : '(Sin código)'}
                    </label>
                    <div className="edit-controls">
                        <input type="number" className="edit-input" placeholder="Nuevo peso" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} autoFocus />
                        <button type="button" className="btn-ok" onClick={handleWeightUpdate}>
                            {isUploading ? '...' : 'OK'}
                        </button>
                    </div>
                    {/* INPUT DE FOTO PARA EDICION RAPIDA */}
                    <div style={{marginBottom:'10px', textAlign:'center'}}>
                        <label style={{fontSize:'0.8rem', color:'#e74c3c', display:'block'}}>Foto consumo:</label>
                        <input type="file" accept="image/*" style={{fontSize:'0.8rem', width:'180px'}} onChange={(e) => setSelectedFile(e.target.files[0])} />
                    </div>

                    <button type="button" className="btn-delete-item" onClick={() => { setSelectedFile(null); setModalType('CONFIRM_DELETE'); }}>Dar de Baja 🗑️</button>
                </div>
            ) : (
                <button type="button" className="btn-add-main" onClick={openAddModal}>+ Agregar Nueva Botella</button>
            )}
        </div>

        <div className="bottle-form__summary" style={{textAlign:'center', marginTop:'1rem'}}>
           <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'10px'}}>
               <button type="button" onClick={openRemoveModal} className="btn" style={{padding:'4px 10px', fontSize:'0.8rem', background:'#e74c3c', color:'white'}}>Baja Masiva</button>
               <label>Total: {bottlesList.length}</label>
            </div>
        </div>

        <div className="bottle-form__actions">
          <button type="submit" className="btn btn--save">Guardar Cambios</button>
          <button type="button" onClick={handleCancelRequest} className="btn btn--cancel">Volver</button>
        </div>
      </form>
    </div>
  );
}
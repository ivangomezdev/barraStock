import React, { useState } from 'react';
import toast from 'react-hot-toast';

// --- CONFIGURACIÓN IMGBB ---
const IMGBB_API_KEY = 'TU_API_KEY_IMGBB_AQUI'; // <--- ¡RECUERDA TU API KEY!

export default function BottleForm({ bottle, onSave, onStockTransaction, onCancel }) {
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  // INICIALIZACIÓN
  const [bottlesList, setBottlesList] = useState(() => {
    if (bottle.botellas && Array.isArray(bottle.botellas)) {
      return bottle.botellas;
    } else {
      return Array(bottle.cantidad || 0).fill(null).map((_, i) => ({
        id: Date.now() + i,
        peso: 0 
      }));
    }
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [selectedBottleIndex, setSelectedBottleIndex] = useState(null); 
  const [editWeight, setEditWeight] = useState('');
  
  // Guardamos la última URL de comprobante para enviarla al guardar todo
  const [lastProofUrl, setLastProofUrl] = useState(null);

  // Estados Modal
  const [modalType, setModalType] = useState(null); 
  const [inputQty, setInputQty] = useState('');
  const [inputWeight, setInputWeight] = useState(''); 
  
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
      setEditWeight(bottlesList[index].peso);
      setSelectedFile(null);
    }
  };

  const handleCancelRequest = () => {
    if (hasChanges) setModalType('CONFIRM_EXIT');
    else onCancel();
  };

  const openAddModal = () => { setModalType('ADD'); setInputQty('1'); setInputWeight(''); setSelectedFile(null); };
  const openRemoveModal = () => { setModalType('REMOVE'); setInputQty(''); setSelectedFile(null); };
  
  // --- TRANSACCIÓN MASIVA (Alta/Baja) ---
  const handleConfirmTransaction = async () => {
    const qty = parseInt(inputQty);
    const weight = parseFloat(inputWeight);

    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    if (!selectedFile) return toast.error("Debes subir comprobante");

    setIsUploading(true);
    const imageUrl = await uploadImage(selectedFile);
    setIsUploading(false);
    if (!imageUrl) return;

    let newList = [...bottlesList];

    if (modalType === 'ADD') {
      if (!weight && weight !== 0) return toast.error("Indica peso");
      for (let i = 0; i < qty; i++) newList.push({ id: Date.now() + Math.random(), peso: weight });
      toast.success(`Agregadas ${qty} botellas`);
      onStockTransaction('ALTA', qty, weight, imageUrl); 

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

    onStockTransaction('BAJA', 1, bottleToDelete.peso || 0, imageUrl);
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
        onStockTransaction(actionType, 0, diff, imageUrl);
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
                    <input type="number" value={inputQty} onChange={(e) => setInputQty(e.target.value)} autoFocus />
                </>
            )}
            
            {modalType === 'ADD' && (
              <>
                <label style={{display:'block', textAlign:'left'}}>Peso por botella:</label>
                <input type="number" placeholder="Ej: 1000" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} />
              </>
            )}

            {/* INPUT FILE GENERAL */}
            <div style={{margin:'15px 0', textAlign:'left'}}>
              <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', color:'#e74c3c'}}>Comprobante (Obligatorio):</label>
              <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} />
            </div>
            
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
            {bottlesList.map((b, index) => (
                <div key={b.id || index} className={`bottle-square ${selectedBottleIndex === index ? 'selected' : ''}`} onClick={() => handleSelectBottle(index)}>
                    <div className="bottle-icon">🍾</div>
                    <span className="bottle-weight">{b.peso}</span>
                    <small>gr/oz</small>
                    <span className="bottle-index">#{index + 1}</span>
                </div>
            ))}
        </div>

        <div className="bottle-actions-area">
            {selectedBottleIndex !== null ? (
                <div className="edit-panel">
                    <label>Editar Botella #{selectedBottleIndex + 1}</label>
                    <div className="edit-controls">
                        <input type="number" className="edit-input" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} autoFocus />
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
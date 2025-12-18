import React, { useState } from 'react';

export default function BottleForm({ bottle, onSave, onStockTransaction, onCancel }) {
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  // Estado para los pesos diarios
  const [pesoInicio, setPesoInicio] = useState(bottle.peso_inicio || 0);
  const [pesoFin, setPesoFin] = useState(bottle.peso_fin || 0);

  // Estados para manejar los POPUPS
  const [modalType, setModalType] = useState(null); // 'ADD' o 'REMOVE'
  const [inputQty, setInputQty] = useState('');
  const [inputWeight, setInputWeight] = useState('');

  // Abrir Popups
  const openAddModal = () => { setModalType('ADD'); setInputQty(''); setInputWeight(''); };
  const openRemoveModal = () => { setModalType('REMOVE'); setInputQty(''); };
  const closeModal = () => setModalType(null);

  // Confirmar acción del Popup
  const handleConfirmTransaction = () => {
    const qty = parseInt(inputQty);
    const weight = parseFloat(inputWeight);

    if (!qty || qty <= 0) {
      alert("Por favor ingrese una cantidad válida");
      return;
    }

    if (modalType === 'ADD') {
      if (!inputWeight) {
        alert("El peso es obligatorio para agregar stock.");
        return;
      }
      onStockTransaction('ALTA', qty, weight);
    } else {
      // Es BAJA
      if (qty > bottle.cantidad) {
        alert("No puedes dar de baja más botellas de las que tienes.");
        return;
      }
      onStockTransaction('BAJA', qty, 0);
    }
    closeModal();
  };

  const handleDailySave = (e) => {
    e.preventDefault();
    onSave({
      ...bottle,
      peso_inicio: pesoInicio,
      peso_fin: pesoFin,
      ultima_actualizacion: new Date().toISOString()
    });
  };

  return (
    <div style={{position: 'relative'}}>
      {/* --- POPUP MODAL PARA AGREGAR/QUITAR (Se superpone al formulario) --- */}
      {modalType && (
        <div className="sub-modal-overlay">
          <div className="sub-modal">
            <h4>{modalType === 'ADD' ? 'Agregar Stock (Entrada)' : 'Dar de Baja (Salida)'}</h4>
            
            <label style={{display:'block', textAlign:'left', marginBottom:'5px'}}>Cantidad:</label>
            <input 
              type="number" 
              placeholder="Ej: 3" 
              value={inputQty} 
              onChange={(e) => setInputQty(e.target.value)}
              autoFocus
            />

            {modalType === 'ADD' && (
              <>
                <label style={{display:'block', textAlign:'left', marginBottom:'5px'}}>Peso total (g/oz):</label>
                <input 
                  type="number" 
                  placeholder="Peso de verificación" 
                  value={inputWeight} 
                  onChange={(e) => setInputWeight(e.target.value)}
                />
              </>
            )}

            <div className="sub-modal-actions">
              <button className="btn btn--cancel" onClick={closeModal}>Cancelar</button>
              <button className="btn btn--save" onClick={handleConfirmTransaction}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULARIO PRINCIPAL --- */}
      <form className="bottle-form" onSubmit={handleDailySave}>
        <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <h3>{bottle.name}</h3>
          <p style={{ color: '#e74c3c', fontWeight: 'bold', textTransform: 'capitalize' }}>{fechaHoy}</p>
        </div>
        
        {/* Sección de Stock */}
        <div className="bottle-form__summary" style={{ textAlign: 'center' }}>
          <label style={{ display: 'block', marginBottom: '10px' }}>Stock en Almacén</label>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
            
            <button 
              type="button" 
              onClick={openRemoveModal} // Abre Popup
              className="btn"
              style={{ backgroundColor: '#e74c3c', color: 'white', padding: '5px 15px' }}
            >
              - Baja
            </button>

            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', minWidth: '40px' }}>
              {bottle.cantidad || 0}
            </span>

            <button 
              type="button" 
              onClick={openAddModal} // Abre Popup
              className="btn"
              style={{ backgroundColor: '#2980b9', color: 'white', padding: '5px 15px' }}
            >
              + Alta
            </button>
          </div>
          <small style={{ display: 'block', marginTop: '5px', color: '#7f8c8d' }}>
            Botellas cerradas disponibles
          </small>
        </div>

        {/* Sección de Pesaje Diario */}
        <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
          <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Control de Turno (Abierta)</h4>
          
          <div className="bottle-form__row">
            <label>Peso Inicial (Apertura):</label>
            <input 
              type="number" 
              step="0.01"
              className="bottle-form__input"
              value={pesoInicio}
              onChange={(e) => setPesoInicio(parseFloat(e.target.value))}
              placeholder="0.00"
            />
          </div>

          <div className="bottle-form__row" style={{ marginTop: '10px' }}>
            <label>Peso Final (Cierre):</label>
            <input 
              type="number" 
              step="0.01"
              className="bottle-form__input"
              value={pesoFin}
              onChange={(e) => setPesoFin(parseFloat(e.target.value))}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="bottle-form__actions">
          <button type="submit" className="btn btn--save">Guardar Corte</button>
          <button type="button" onClick={onCancel} className="btn btn--cancel">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
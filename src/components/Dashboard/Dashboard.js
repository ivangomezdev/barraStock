// src/components/Dashboard/Dashboard.js
'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
// IMPORTAMOS CATEGORY_IMAGES
import { BOTTLE_DATA, CATEGORY_IMAGES } from '../../lib/data';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast'; 
import BottleForm from '../BottleForm/BottleForm';
import CierreTurno from '../CierreTurno/CierreTurno';
import NuevoTrago from '../NuevoTrago/NuevoTrago';
import '../../styles/Dashboard.css';
import '../../styles/BottleList.css';

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBottle, setSelectedBottle] = useState(null);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [accessError, setAccessError] = useState('');

  // --- NUEVOS ESTADOS PARA FILTROS ---
  const [searchCategory, setSearchCategory] = useState('');
  const [searchBottle, setSearchBottle] = useState('');
  const [showCierreTurno, setShowCierreTurno] = useState(false);
  const [showNuevoTrago, setShowNuevoTrago] = useState(false);
  const [bottlesWithMovements, setBottlesWithMovements] = useState(new Set()); // Botellas con movimientos del turno

  // 1. CARGAR PERFIL
  useEffect(() => {
    const fetchUserAssignment = async () => {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          // Aceptar tanto restaurantId como restaurantID (compatibilidad)
          const restaurantIdValue = userData.restaurantId || userData.restaurantID;
          if (restaurantIdValue) {
            setRestaurantId(restaurantIdValue);
            setRestaurantName(userData.restaurantName || restaurantIdValue);
          } else {
            setAccessError("Tu usuario no tiene un restaurante asignado.");
            setLoading(false);
          }
        } else {
          setAccessError("Usuario no registrado en la base de datos de personal.");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error buscando usuario:", error);
        setAccessError("Error de conexión verificando permisos.");
        setLoading(false);
      }
    };
    fetchUserAssignment();
  }, []);

  // 2. CARGAR INVENTARIO
  useEffect(() => {
    const loadInventory = async () => {
      if (!restaurantId) return;
      try {
        const docRef = doc(db, "inventories", restaurantId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setInventory(docSnap.data());
        } else {
          setInventory({}); 
        }
      } catch (error) {
        console.error("Error cargando inventario:", error);
        toast.error("Error cargando inventario");
      } finally {
        setLoading(false);
      }
    };
    loadInventory();
  }, [restaurantId]);

  // 3. DETECTAR BOTELLAS CON MOVIMIENTOS DEL TURNO ACTUAL
  useEffect(() => {
    const fetchBottlesWithMovements = async () => {
      if (!restaurantId) return;
      try {
        const shiftDate = getShiftDate();
        const logsQuery = query(
          collection(db, 'stock_logs'),
          where('restaurante_id', '==', restaurantId),
          where('fecha_string', '==', shiftDate)
        );
        const logsSnap = await getDocs(logsQuery);
        
        // Obtener botellas únicas que tuvieron movimientos (excluir ALTA - carga nueva)
        const uniqueBottles = new Set();
        logsSnap.forEach(doc => {
          const data = doc.data();
          // Excluir operaciones de ALTA (carga nueva no requiere cierre)
          if (data.botella && data.accion !== 'ALTA') {
            uniqueBottles.add(data.botella);
          }
        });
        
        // Verificar si ya tienen cierre registrado
        const cierreQuery = query(
          collection(db, 'cierre_turno'),
          where('restaurante_id', '==', restaurantId),
          where('fecha_turno', '==', shiftDate)
        );
        const cierreSnap = await getDocs(cierreQuery);
        const bottlesWithCierre = new Set();
        cierreSnap.forEach(doc => {
          const data = doc.data();
          if (data.botella) {
            bottlesWithCierre.add(data.botella);
          }
        });
        
        // Solo incluir botellas que tienen movimientos pero NO tienen cierre
        const pendingBottles = new Set();
        uniqueBottles.forEach(bottle => {
          if (!bottlesWithCierre.has(bottle)) {
            pendingBottles.add(bottle);
          }
        });
        
        setBottlesWithMovements(pendingBottles);
      } catch (error) {
        console.error("Error obteniendo botellas con movimientos:", error);
      }
    };
    fetchBottlesWithMovements();
    
    // Refrescar cada 30 segundos para actualizar el estado
    const interval = setInterval(fetchBottlesWithMovements, 30000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  // Modificado: Acepta categoría opcional para búsquedas globales
  const handleBottleClick = (bottleName, categoryOverride = null) => {
    // Si venimos de una búsqueda global, selectedCategory es null, usamos el override
    let cat = categoryOverride || selectedCategory;

    // Fallback: si no tenemos categoría, la buscamos en BOTTLE_DATA
    if (!cat) {
      for (const [key, list] of Object.entries(BOTTLE_DATA)) {
        if (list.includes(bottleName)) {
          cat = key;
          break;
        }
      }
    }

    const bottleData = inventory[bottleName] || { 
      name: bottleName, 
      active: true, 
      peso_inicio: 0,
      peso_fin: 0,
      cantidad: 0,
      categoria: cat 
    };
    if (!bottleData.categoria) bottleData.categoria = cat;
    setSelectedBottle(bottleData);
  };

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

  const handleStockTransaction = async (type, quantity, weight, imageUrl = null, previousWeight = null, newWeight = null, bottleId = null) => {
    if (!selectedBottle || !restaurantId) return;

    try {
      const shiftDate = getShiftDate(); // Fecha del turno (no fecha calendario)
      await addDoc(collection(db, "stock_logs"), {
        restaurante_id: restaurantId,
        restaurante_nombre: restaurantName,
        usuario: auth.currentUser.email,
        botella: selectedBottle.name,
        categoria: selectedBottle.categoria, // Usar la categoría del objeto seleccionado
        accion: type,
        cantidad_movida: quantity,
        peso_registrado: weight || 0,
        peso_anterior: previousWeight !== null ? previousWeight : null,
        peso_nuevo: newWeight !== null ? newWeight : null,
        bottle_id: bottleId, // ID único de la botella física
        comprobante_url: imageUrl, 
        fecha: serverTimestamp(),
        fecha_string: shiftDate // Fecha del turno (4pm-3am)
      });
      // El toast ya lo maneja BottleForm
    } catch (error) {
      console.error(error);
      toast.error("Error guardando log.");
    }
  };

  const saveDailyWeights = async (updatedBottle) => {
    if (!restaurantId) return;
    
    const newInventory = { ...inventory, [updatedBottle.name]: updatedBottle };
    setInventory(newInventory);
    setSelectedBottle(null);
    // Limpiamos la búsqueda al guardar para volver al menú
    setSearchBottle('');
    
    await toast.promise(
      setDoc(doc(db, "inventories", restaurantId), newInventory, { merge: true }),
      {
        loading: 'Guardando...',
        success: '¡Guardado!',
        error: 'Error al guardar.',
      }
    );

    // GUARDAR REPORTE DIARIO
    const totalWeight = (updatedBottle.botellas || []).reduce((acc, b) => acc + parseFloat(b.peso || 0), 0);
    const pesoInicio = updatedBottle.peso_inicio || 0;
    
    // Validación: Si hay stock pero peso_inicio es 0, no crear reporte (botella debería estar dada de baja)
    if (updatedBottle.cantidad > 0 && pesoInicio === 0) {
      console.warn(`Botella ${updatedBottle.name} tiene stock pero peso_inicio es 0. No se creará reporte diario.`);
      toast.error(`⚠️ ${updatedBottle.name} tiene peso inicial 0. Debe estar dada de baja.`);
      return;
    }
    
    // Solo crear reporte si hay stock y peso_inicio válido
    if (updatedBottle.cantidad > 0 && pesoInicio > 0) {
      try {
        const shiftDate = getShiftDate(); // Fecha del turno (4pm-3am)
        await addDoc(collection(db, "daily_reports"), {
          restaurante_id: restaurantId,
          restaurante_nombre: restaurantName,
          fecha: shiftDate, // Fecha del turno, no fecha calendario
          timestamp: serverTimestamp(),
          usuario: auth.currentUser.email,
          botella: updatedBottle.name,
          categoria: updatedBottle.categoria || selectedCategory,
          peso_inicio: pesoInicio, 
          peso_fin: totalWeight,
          consumo_peso: pesoInicio - totalWeight, 
          stock_actual: updatedBottle.cantidad,
          comprobante_url: updatedBottle.comprobante_url || null 
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Función para guardar en cierre_turno cuando se registra peso final
  const handleCierreTurno = async (bottleName, pesoFinal, fotoUrl) => {
    if (!restaurantId) return;
    
    try {
      const shiftDate = getShiftDate();
      await addDoc(collection(db, 'cierre_turno'), {
        restaurante_id: restaurantId,
        restaurante_nombre: restaurantName,
        usuario: auth.currentUser.email,
        botella: bottleName,
        peso_final_registrado: parseFloat(pesoFinal),
        foto_pesaje_url: fotoUrl,
        fecha_turno: shiftDate,
        timestamp: serverTimestamp()
      });
      
      // Actualizar el estado para quitar la botella de las pendientes
      setBottlesWithMovements(prev => {
        const newSet = new Set(prev);
        newSet.delete(bottleName);
        return newSet;
      });
      
      toast.success(`Peso final registrado para ${bottleName}`);
    } catch (error) {
      console.error('Error guardando cierre:', error);
      toast.error('Error al guardar el peso final');
    }
  };

  // --- LÓGICA DE FILTRADO ---
  
  // 1. Filtrar Categorías (Keys de BOTTLE_DATA)
  const filteredCategories = Object.keys(BOTTLE_DATA).filter(cat => 
    cat.toLowerCase().includes(searchCategory.toLowerCase())
  );

  // 2. Filtrar Botellas (Búsqueda Global)
  // Devuelve un array de objetos: { name: 'Botella X', category: 'TEQUILA' }
  const getGlobalBottleResults = () => {
    if (!searchBottle) return [];
    const term = searchBottle.toLowerCase();
    let results = [];
    
    Object.entries(BOTTLE_DATA).forEach(([cat, list]) => {
      list.forEach(bottleName => {
        if (bottleName.toLowerCase().includes(term)) {
          results.push({ name: bottleName, category: cat });
        }
      });
    });
    return results;
  };

  const globalSearchResults = getGlobalBottleResults();
  const showSearchResults = searchBottle.length > 0;

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Cargando...</div>;
  if (accessError) return <div style={{padding:'2rem', textAlign:'center', color:'#c0392b'}}>{accessError}</div>;

  return (
    <div className="dashboard">
      <Toaster />
      <header className="dashboard__header">
        <div><h1 className="dashboard__title">Stock: {restaurantName}</h1><small>{auth.currentUser?.email}</small></div>
        <div className="dashboard__header-actions">
          {!selectedCategory && !selectedBottle && (
            <>
              <button
                onClick={() => setShowNuevoTrago(true)}
                className="dashboard__button dashboard__button--primary"
              >
                🍹 Nuevo Trago
              </button>
              <button
                onClick={() => setShowCierreTurno(true)}
                className="dashboard__button dashboard__button--success"
              >
                📋 Cierre de Turno
              </button>
            </>
          )}
          <button className="dashboard__logout" onClick={() => signOut(auth)}>Salir</button>
        </div>
      </header>

      {/* --- NUEVA BARRA DE BÚSQUEDA --- */}
      {!selectedCategory && !selectedBottle && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
             <input 
               type="text" 
               placeholder="🔍 Filtrar Categoría..." 
               value={searchCategory}
               onChange={(e) => setSearchCategory(e.target.value)}
               disabled={showSearchResults} // Desactivar si se busca por botella
               style={{
                 width: '100%', 
                 padding: '12px', 
                 borderRadius: '8px', 
                 border: '1px solid #ddd',
                 fontSize: '1rem',
                 opacity: showSearchResults ? 0.5 : 1
               }}
             />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
             <input 
               type="text" 
               placeholder="🍾 Buscar Botella..." 
               value={searchBottle}
               onChange={(e) => setSearchBottle(e.target.value)}
               style={{
                 width: '100%', 
                 padding: '12px', 
                 borderRadius: '8px', 
                 border: '1px solid #3498db',
                 fontSize: '1rem'
               }}
             />
          </div>
        </div>
      )}

      {/* --- VISTA PRINCIPAL --- */}
      {!selectedCategory && !selectedBottle && (
        <div className="dashboard__grid">
          
          {/* CASO 1: BÚSQUEDA GLOBAL DE BOTELLAS ACTIVA */}
          {showSearchResults ? (
             globalSearchResults.length > 0 ? (
               globalSearchResults.map((item) => {
                 const bottleData = inventory[item.name];
                 const currentStock = bottleData?.cantidad || 0;
                 // Reutilizamos estilos de item de botella pero en la grid principal
                 const hasMovements = bottlesWithMovements.has(item.name);
                 return (
                  <div 
                    key={item.name} 
                    className={hasMovements ? "bottle-item bottle-item--pending" : "bottle-item"}
                    style={{ minHeight: '120px', border: hasMovements ? '2px solid #f39c12' : '2px solid #3498db' }}
                    onClick={() => handleBottleClick(item.name, item.category)}
                  >
                    {hasMovements && <div className="pending-indicator">⚠️ Pendiente Pesaje</div>}
                    <span style={{ fontSize:'0.8rem', color: '#7f8c8d', textTransform:'uppercase' }}>{item.category}</span>
                    <span className="bottle-item__name" style={{fontSize:'1.1rem'}}>{item.name}</span>
                    {currentStock > 0 ? 
                      <div className="stock-badge">Stock: {currentStock}</div> : 
                      <div className="empty-badge">Sin Stock</div>
                    }
                  </div>
                 );
               })
             ) : (
               <div style={{ colSpan: 3, textAlign: 'center', width: '100%', color: '#7f8c8d' }}>
                 No se encontraron botellas con "{searchBottle}"
               </div>
             )
          ) : (
            /* CASO 2: LISTADO DE CATEGORÍAS (FILTRADO) */
            filteredCategories.map(cat => (
              <div key={cat} className="category-card" onClick={() => setSelectedCategory(cat)}>
                
                {/* --- IMAGEN DE CATEGORÍA --- */}
                {CATEGORY_IMAGES[cat] ? (
                  <img 
                    src={CATEGORY_IMAGES[cat]} 
                    alt={cat} 
                    className="category-card__img"
                  />
                ) : (
                  <div className="category-card__placeholder">🍾</div>
                )}
                
                <h2 className="category-card__title">{cat}</h2>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- MODAL DE CATEGORÍA SELECCIONADA --- */}
      {selectedCategory && !selectedBottle && (
        <div className="bottle-overlay">
          <div className="bottle-modal">
            <button className="bottle-modal__close" onClick={() => setSelectedCategory(null)}>X</button>
            <h2 className="bottle-modal__title">{selectedCategory}</h2>
            
            {/* Opcional: Input para filtrar dentro del modal también */}
           
            <div className="bottle-list">
              {BOTTLE_DATA[selectedCategory].map(bottleName => {
                const bottleData = inventory[bottleName];
                const currentStock = bottleData?.cantidad || 0;
                const hasMovements = bottlesWithMovements.has(bottleName);
                const itemClass = currentStock > 0 
                  ? (hasMovements ? "bottle-item bottle-item--pending" : "bottle-item")
                  : "bottle-item bottle-item--inactive";
                return (
                  <div key={bottleName} className={itemClass} onClick={() => handleBottleClick(bottleName)}>
                    {hasMovements && <div className="pending-indicator">⚠️ Pendiente Pesaje</div>}
                    <span className="bottle-item__name">{bottleName}</span>
                    {currentStock > 0 ? <div className="stock-badge">Stock: {currentStock}</div> : <div className="empty-badge">Sin Stock</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULARIO DE BOTELLA (STOCK/VENTA) --- */}
      {selectedBottle && (
        <div className="bottle-overlay">
          <div className="bottle-modal">
            <BottleForm 
              bottle={selectedBottle} 
              onStockTransaction={handleStockTransaction}
              onSave={saveDailyWeights}
              onCancel={() => setSelectedBottle(null)}
              hasMovements={bottlesWithMovements.has(selectedBottle.name)}
              onCierreTurno={handleCierreTurno}
            />
          </div>
        </div>
      )}

      {/* --- MODAL DE CIERRE DE TURNO --- */}
      {showCierreTurno && (
        <CierreTurno
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          onClose={() => setShowCierreTurno(false)}
        />
      )}

      {/* --- MODAL DE NUEVO TRAGO --- */}
      {showNuevoTrago && (
        <NuevoTrago
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          inventory={inventory}
          onClose={() => setShowNuevoTrago(false)}
          onInventoryUpdate={(updatedInventory) => {
            setInventory(updatedInventory);
          }}
        />
      )}
    </div>
  );
}
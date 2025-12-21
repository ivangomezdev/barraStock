// src/components/Dashboard/Dashboard.js
'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
// IMPORTAMOS CATEGORY_IMAGES
import { BOTTLE_DATA, CATEGORY_IMAGES } from '../../lib/data';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast'; 
import BottleForm from '../BottleForm/BottleForm';
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
          if (userData.restaurantId) {
            setRestaurantId(userData.restaurantId);
            setRestaurantName(userData.restaurantName || userData.restaurantId);
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

  const handleStockTransaction = async (type, quantity, weight, imageUrl = null) => {
    if (!selectedBottle || !restaurantId) return;

    try {
      await addDoc(collection(db, "stock_logs"), {
        restaurante_id: restaurantId,
        restaurante_nombre: restaurantName,
        usuario: auth.currentUser.email,
        botella: selectedBottle.name,
        categoria: selectedBottle.categoria, // Usar la categoría del objeto seleccionado
        accion: type,
        cantidad_movida: quantity,
        peso_registrado: weight || 0,
        comprobante_url: imageUrl, 
        fecha: serverTimestamp(),
        fecha_string: new Date().toISOString().split('T')[0]
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
    
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, "daily_reports"), {
        restaurante_id: restaurantId,
        restaurante_nombre: restaurantName,
        fecha: todayStr,
        timestamp: serverTimestamp(),
        usuario: auth.currentUser.email,
        botella: updatedBottle.name,
        categoria: updatedBottle.categoria || selectedCategory,
        peso_inicio: updatedBottle.peso_inicio || 0, 
        peso_fin: totalWeight,
        consumo_peso: (updatedBottle.peso_inicio || 0) - totalWeight, 
        stock_actual: updatedBottle.cantidad,
        comprobante_url: updatedBottle.comprobante_url || null 
      });
    } catch (err) {
      console.error(err);
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
        <button className="dashboard__logout" onClick={() => signOut(auth)}>Salir</button>
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
                 return (
                  <div 
                    key={item.name} 
                    className="bottle-item" // Clase de BottleList.css
                    style={{ minHeight: '120px', border: '2px solid #3498db' }}
                    onClick={() => handleBottleClick(item.name, item.category)}
                  >
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
            <input 
              type="text" 
              placeholder={`Buscar en ${selectedCategory}...`}
              className="sub-modal input" // Reusando clase CSS existente
              style={{ marginBottom: '1rem', border:'1px solid #ccc' }}
              onChange={(e) => {
                 // Filtrado local simple usando DOM o estado local si quisieras, 
                 // pero por simplicidad mostramos todo o implementamos lógica rápida:
                 const val = e.target.value.toLowerCase();
                 const items = document.querySelectorAll('.bottle-list .bottle-item');
                 items.forEach(item => {
                   const text = item.innerText.toLowerCase();
                   item.style.display = text.includes(val) ? 'flex' : 'none';
                 });
              }}
            />

            <div className="bottle-list">
              {BOTTLE_DATA[selectedCategory].map(bottleName => {
                const bottleData = inventory[bottleName];
                const currentStock = bottleData?.cantidad || 0;
                const itemClass = currentStock > 0 ? "bottle-item" : "bottle-item bottle-item--inactive";
                return (
                  <div key={bottleName} className={itemClass} onClick={() => handleBottleClick(bottleName)}>
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
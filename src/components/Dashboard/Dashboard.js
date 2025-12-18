'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { BOTTLE_DATA } from '../../lib/data';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import BottleForm from '../BottleForm/BottleForm';
import '../../styles/Dashboard.css';
import '../../styles/BottleList.css';

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBottle, setSelectedBottle] = useState(null);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  
  // NUEVO ESTADO: Guardamos el ID del restaurante asignado
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [accessError, setAccessError] = useState('');

  // 1. CARGAR PERFIL DE USUARIO Y SU RESTAURANTE ASIGNADO
  useEffect(() => {
    const fetchUserAssignment = async () => {
      if (!auth.currentUser) return;

      try {
        const uid = auth.currentUser.uid;
        
        // Buscamos en la colección "users" el documento con el ID del usuario
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          // El campo se debe llamar "restaurantId" en la base de datos
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

  // 2. CARGAR INVENTARIO (Solo cuando ya sabemos el restaurantId)
  useEffect(() => {
    const loadInventory = async () => {
      if (!restaurantId) return;

      try {
        // Usamos restaurantId en lugar de auth.currentUser.uid
        const docRef = doc(db, "inventories", restaurantId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setInventory(docSnap.data());
        } else {
          setInventory({}); 
        }
      } catch (error) {
        console.error("Error cargando inventario:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInventory();
  }, [restaurantId]);

  const handleBottleClick = (bottleName) => {
    const bottleData = inventory[bottleName] || { 
      name: bottleName, 
      active: true, 
      peso_inicio: 0,
      peso_fin: 0,
      cantidad: 0 
    };
    if (bottleData.active === false) return;
    setSelectedBottle(bottleData);
  };

  const handleStockTransaction = async (type, quantity, weight) => {
    if (!selectedBottle || quantity <= 0 || !restaurantId) return; // Verificamos restaurantId

    const userEmail = auth.currentUser.email;
    const bottleName = selectedBottle.name;

    try {
      const currentStock = selectedBottle.cantidad || 0;
      let newStock = currentStock;
      
      if (type === 'ALTA') newStock = currentStock + quantity;
      else if (type === 'BAJA') {
        newStock = currentStock - quantity;
        if (newStock < 0) newStock = 0;
      }

      // Guardamos Log con el restaurantId correcto
      await addDoc(collection(db, "stock_logs"), {
        restaurante_id: restaurantId, // <-- CLAVE: ID DEL RESTAURANTE, NO DEL USUARIO
        usuario: userEmail,
        botella: bottleName,
        accion: type,
        cantidad_movida: quantity,
        peso_registrado: weight || 0,
        stock_anterior: currentStock,
        stock_resultante: newStock,
        fecha: serverTimestamp(),
        fecha_legible: new Date().toLocaleString('es-MX')
      });

      const updatedBottle = { ...selectedBottle, cantidad: newStock };
      const newInventory = { ...inventory, [bottleName]: updatedBottle };

      setInventory(newInventory);
      setSelectedBottle(updatedBottle);
      
      // Guardamos en el documento del restaurante
      await setDoc(doc(db, "inventories", restaurantId), newInventory, { merge: true });

      alert(`Movimiento registrado: ${type} de ${quantity}`);

    } catch (error) {
      console.error(error);
      alert("Error guardando movimiento.");
    }
  };

  const saveDailyWeights = async (updatedBottle) => {
    if (!restaurantId) return;
    const newInventory = { ...inventory, [updatedBottle.name]: updatedBottle };
    setInventory(newInventory);
    setSelectedBottle(null);
    await setDoc(doc(db, "inventories", restaurantId), newInventory, { merge: true });
  };

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Cargando sistema...</div>;

  if (accessError) {
    return (
      <div style={{padding:'2rem', textAlign:'center', color: '#c0392b'}}>
        <h2>Acceso Restringido</h2>
        <p>{accessError}</p>
        <button className="dashboard__logout" onClick={() => signOut(auth)} style={{marginTop:'1rem'}}>Salir</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Stock: {restaurantName}</h1>
          <small>{auth.currentUser?.email}</small>
        </div>
        <button className="dashboard__logout" onClick={() => signOut(auth)}>Salir</button>
      </header>

      {!selectedCategory && (
        <div className="dashboard__grid">
          {Object.keys(BOTTLE_DATA).map(cat => (
            <div key={cat} className="category-card" onClick={() => setSelectedCategory(cat)}>
              <h2 className="category-card__title">{cat}</h2>
            </div>
          ))}
        </div>
      )}

      {selectedCategory && !selectedBottle && (
        <div className="bottle-overlay">
          <div className="bottle-modal">
            <button className="bottle-modal__close" onClick={() => setSelectedCategory(null)}>X</button>
            <h2 className="bottle-modal__title">{selectedCategory}</h2>
            <div className="bottle-list">
              {BOTTLE_DATA[selectedCategory].map(bottleName => {
                const stock = inventory[bottleName]?.cantidad || 0;
                return (
                  <div key={bottleName} className="bottle-item" onClick={() => handleBottleClick(bottleName)}>
                    <span className="bottle-item__name">{bottleName}</span>
                    {stock > 0 && (
                      <div style={{marginTop:'5px', fontSize:'0.8rem', color:'white', background:'#27ae60', borderRadius:'10px', padding:'2px 8px', display:'inline-block'}}>
                        Stock: {stock}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
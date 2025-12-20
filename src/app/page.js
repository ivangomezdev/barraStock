'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; 
import { auth, db } from '../lib/firebase';
import Login from '../components/Login/Login';
import Dashboard from '../components/Dashboard/Dashboard';
import AdminDashboard from '../components/Admin/AdminDashboard';

export default function Home() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserRole(data.role || 'user');
          } else {
            setUserRole('user');
          }
        } catch (err) {
          console.error("Error obteniendo rol:", err);
          setUserRole('user');
        }
        setUser(u);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>Cargando...</div>;

  if (!user) return <Login />;

  if (userRole === 'admin') return <AdminDashboard />;

  return <Dashboard />;
}
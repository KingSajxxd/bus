// src/App.js

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// Import our pages
import Auth from './Auth';
import Dashboard from './Dashboard';
import DashboardHome from './pages/DashboardHome';
import ManageRoutes from './pages/ManageRoutes';
import ManageDrivers from './pages/ManageDrivers';
import ManageBuses from './pages/ManageBuses';
import ManageParents from './pages/ManageParents';
import ManageStudents from './pages/ManageStudents';
import Reports from './pages/Reports';
import AbsenceReports from './pages/AbsenceReports';
import ChecklistReports from './pages/ChecklistReports';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); // Start as true
  const navigate = useNavigate();

  useEffect(() => {
    // This listener handles INITIAL_SESSION, SIGNED_IN, and SIGNED_OUT
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Set loading to true *every time* auth changes.
      setLoading(true); 
      
      if (session) {
        // A session was found (or user just logged in)
        // Check their role.
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
            
          if (error) throw error;
          
          if (profile && profile.role === 'admin') {
            // They are an admin. Set the session.
            setSession(session);
          } else {
            // Not an admin. Sign them out. (NO ALERT)
            await supabase.auth.signOut();
            setSession(null);
          }
        } catch (error) {
          console.error('Error checking user role:', error.message);
          await supabase.auth.signOut();
          setSession(null);
        } finally {
          // Role check is done. Stop loading.
          setLoading(false);
        }
      } else {
        // User is logged out.
        setSession(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Run only once on mount

  // This effect handles redirecting
  useEffect(() => {
    if (loading) return; // Don't redirect while loading

    if (session) {
      if (window.location.pathname === '/') {
        navigate('/dashboard');
      }
    } else {
      if (window.location.pathname.startsWith('/dashboard')) {
        navigate('/');
      }
    }
  }, [session, loading, navigate]);

  // Guarded route wrapper to prevent rendering dashboard for non-admins
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div className="spinner"></div>
        </div>
      );
    }
    return session ? children : <Navigate to="/" replace />;
  };

  // Show spinner while checking the initial session
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // If no session, show Auth page
  // We only get here if loading is false AND session is null
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  // If session exists, user MUST be an admin
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        
        <Route path="absences" element={<AbsenceReports />} />
        <Route path="reports" element={<Reports />} />
        <Route path="checklists" element={<ChecklistReports />} />

        <Route path="routes" element={<ManageRoutes />} />
        <Route path="drivers" element={<ManageDrivers />} />
        <Route path="buses" element={<ManageBuses />} />
        <Route path="parents" element={<ManageParents />} />
        <Route path="students" element={<ManageStudents />} />
      </Route>
    </Routes>
  );
}

export default App;
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function ManageBuses() {
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [busName, setBusName] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingBusId, setEditingBusId] = useState(null);

  const fetchInitialData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const { data: busData, error: busError } = await supabase
        .from('buses')
        .select(`
          id,
          name,
          live_status,
          driver_id, 
          route_id,
          profiles ( id, name ), 
          routes ( id, name )
        `)
        .order('name', { ascending: true });
      if (busError) throw busError;
      setBuses(busData);

      const { data: driverData, error: driverError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'driver')
        .order('name', { ascending: true });
      if (driverError) throw driverError;
      setDrivers(driverData);

      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('id, name')
        .order('name', { ascending: true });
      if (routeError) throw routeError;
      setRoutes(routeData);

    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchInitialData(true);
  }, [fetchInitialData]);

  // Real-time subscriptions
  useEffect(() => {
    const busesListener = supabase
      .channel('public:buses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buses' },
        (payload) => {
          console.log('Bus data changed!', payload);
          fetchInitialData(); // Silent update
        }
      )
      .subscribe();

    const driversListener = supabase
      .channel('public:profiles:drivers_buses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.driver' },
        (payload) => {
          console.log('Driver data changed!', payload);
          fetchInitialData(); // Silent update
        }
      )
      .subscribe();

    const routesListener = supabase
      .channel('public:routes:buses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routes' },
        (payload) => {
          console.log('Route data changed!', payload);
          fetchInitialData(); // Silent update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(busesListener);
      supabase.removeChannel(driversListener);
      supabase.removeChannel(routesListener);
    };
  }, [fetchInitialData]);

  const handleSubmitBus = async (e) => {
    e.preventDefault();

    if (!busName || !selectedDriverId || !selectedRouteId) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      let error;
      const updates = {
        name: busName,
        driver_id: selectedDriverId,
        route_id: selectedRouteId,
      };

      if (isEditing) {
        ({ error } = await supabase
          .from('buses')
          .update(updates)
          .eq('id', editingBusId));
      } else {
        ({ error } = await supabase
          .from('buses')
          .insert({ ...updates, live_status: 'Offline' }));
      }

      if (error) throw error;
      
      alert(isEditing ? 'Bus updated!' : 'Bus created!');
      resetForm();
      // Real-time subscription will auto-update

    } catch (error) {
      if (error.code === '23505') {
         alert('Error: This driver is already assigned to another bus.');
      } else {
         alert(error.error_description || error.message);
      }
    }
  };

  const handleDeleteBus = async (busId, busName) => {
    if (window.confirm(`Are you sure you want to delete "${busName}"?`)) {
      try {
        const { error } = await supabase
          .from('buses')
          .delete()
          .eq('id', busId);
        
        if (error) throw error;
        alert('Bus deleted successfully!');
        // Real-time subscription will auto-update

      } catch (error) {
        alert(error.error_description || error.message);
      }
    }
  };

  const handleEditClick = (bus) => {
    setIsEditing(true);
    setEditingBusId(bus.id);
    setBusName(bus.name);
    setSelectedDriverId(bus.driver_id);
    setSelectedRouteId(bus.route_id);
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingBusId(null);
    setBusName('');
    setSelectedDriverId('');
    setSelectedRouteId('');
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading data...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">🚌 Manage Buses</h1>
        <p className="page-subtitle">Add and manage buses in your fleet</p>
      </div>

      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 2fr' }}>
        <div className="card card-spacious">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
            {isEditing ? '✏️ Update Bus' : '➕ Add New Bus'}
          </h3>
          
          <form onSubmit={handleSubmitBus}>
            <div className="form-group">
              <label>Bus Name</label>
              <input
                type="text"
                placeholder="e.g., Bus-01, Alpha Express"
                value={busName}
                onChange={(e) => setBusName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Assigned Driver</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                required
              >
                <option value="">Select a driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Assigned Route</label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                required
              >
                <option value="">Select a route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="submit" style={{ flex: 1 }}>
                {isEditing ? '💾 Update Bus' : '➕ Add Bus'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card card-spacious">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>Bus Fleet</h3>
            <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '700'
            }}>
              {buses.length} {buses.length === 1 ? 'Bus' : 'Buses'}
            </span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Bus Name</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '180px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚌</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No buses yet</div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Add your first bus to get started</div>
                    </td>
                  </tr>
                ) : (
                  buses.map((bus) => (
                    <tr key={bus.id}>
                      <td><div style={{ fontWeight: '600' }}>{bus.name}</div></td>
                      <td>{bus.profiles?.name ?? 'N/A'}</td>
                      <td>{bus.routes?.name ?? 'N/A'}</td>
                      <td>
                        <span style={{
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          backgroundColor: 
                            bus.live_status === 'On-Route' ? '#dcfce7' :
                            bus.live_status === 'SOS' ? '#fee2e2' : '#f3f4f6',
                          color:
                            bus.live_status === 'On-Route' ? '#15803d' :
                            bus.live_status === 'SOS' ? '#991b1b' : '#4b5563'
                        }}>
                          {bus.live_status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                          <button onClick={() => handleEditClick(bus)} className="secondary" style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}>
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteBus(bus.id, bus.name)}
                            className="danger"
                            style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

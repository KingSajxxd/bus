import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function ManageDrivers() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // --- NEW: State for the NFC Card ID ---
  const [driverNfcUid, setDriverNfcUid] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState(null);

  const fetchDrivers = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // We must select the new 'driver_nfc_uid' column
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, driver_nfc_uid') // Explicitly select all needed fields
        .eq('role', 'driver')
        .order('name', { ascending: true });

      if (error) throw error;
      setDrivers(data);
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDrivers(true);
  }, [fetchDrivers]);

  // Real-time subscription
  useEffect(() => {
    const driversListener = supabase
      .channel('public:profiles:drivers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.driver' },
        (payload) => {
          console.log('Driver data changed!', payload);
          fetchDrivers(); // Silent update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driversListener);
    };
  }, [fetchDrivers]);

  const handleSubmitDriver = async (e) => {
    e.preventDefault(); 

    try {
      if (isEditing) {
        // --- UPDATE LOGIC ---
        if (!name) {
          alert('Please fill in the name.');
          return;
        }
        const { error } = await supabase
          .from('profiles')
          .update({ 
            name: name,
            driver_nfc_uid: driverNfcUid || null // Send null if empty
          })
          .eq('id', editingDriverId);
        
        if (error) throw error;
        alert('Driver updated successfully!');

      } else {
        // --- ADD LOGIC ---
        if (!name || !email || !password) {
          alert('Please fill in all fields.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              role: 'driver',
              name: name,
              driver_nfc_uid: driverNfcUid || null // Send null if empty
            }
          }
        });

        if (error) throw error;
        alert('Driver created successfully!');
      }

      resetForm();
      // Real-time subscription will auto-update

    } catch (error) {
       // --- NEW: Handle unique constraint error for NFC ID ---
      if (error.code === '23505' && error.message.includes('driver_nfc_uid')) {
         alert('Error: This NFC Card UID is already assigned to another driver.');
      } else {
         alert(error.error_description || error.message);
      }
    }
  };

  const handleEditClick = (driver) => {
    setIsEditing(true);
    setEditingDriverId(driver.id);
    setName(driver.name);
    // --- NEW: Populate the NFC field when editing ---
    setDriverNfcUid(driver.driver_nfc_uid || ''); // Set to empty string if null
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingDriverId(null);
    setName('');
    setEmail('');
    setPassword('');
    // --- NEW: Reset the NFC field ---
    setDriverNfcUid('');
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading drivers...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">👨‍✈️ Manage Drivers</h1>
        <p className="page-subtitle">Add and manage bus drivers for your fleet</p>
      </div>

      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 2fr' }}>
        <div className="card card-spacious">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
            {isEditing ? '✏️ Update Driver' : '➕ Add New Driver'}
          </h3>
          
          <form onSubmit={handleSubmitDriver}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter driver's full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            {/* --- NEW: NFC Card UID Field --- */}
            <div className="form-group">
              <label>NFC Card UID (for login)</label>
              <input
                type="text"
                placeholder="Tap card on reader or enter UID"
                value={driverNfcUid}
                onChange={(e) => setDriverNfcUid(e.target.value)}
              />
            </div>

            {!isEditing && (
              <>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="driver@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Set a temporary password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="submit" style={{ flex: 1 }}>
                {isEditing ? '💾 Update Driver' : '➕ Add Driver'}
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
            <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>Driver List</h3>
            <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '700'
            }}>
              {drivers.length} {drivers.length === 1 ? 'Driver' : 'Drivers'}
            </span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  {/* --- NEW: Table header --- */}
                  <th>NFC Card UID</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr>
                    {/* --- NEW: Updated colSpan --- */}
                    <td colSpan="4" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👨‍✈️</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No drivers yet</div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Add your first driver to get started</div>
                    </td>
                  </tr>
                ) : (
                  drivers.map((driver) => (
                    <tr key={driver.id}>
                      <td><div style={{ fontWeight: '600' }}>{driver.name}</div></td>
                      <td><div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>{driver.email}</div></td>
                      {/* --- NEW: Table cell --- */}
                      <td>
                        {driver.driver_nfc_uid ? (
                          <code style={{ 
                            backgroundColor: '#f3f4f6',
                            padding: '0.375rem 0.625rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#4b5563'
                          }}>
                            {driver.driver_nfc_uid}
                          </code>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => handleEditClick(driver)} className="secondary" style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}>
                          ✏️ Edit
                        </button>
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
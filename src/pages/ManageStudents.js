// src/pages/ManageStudents.js

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function ManageStudents() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [routes, setRoutes] = useState([]);
  
  // --- NEW: State for the dynamic stops dropdown ---
  const [availableStops, setAvailableStops] = useState([]);

  // --- Form State ---
  const [studentName, setStudentName] = useState('');
  const [studentUid, setStudentUid] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState(''); // --- NEW ---

  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);

  // --- Initial Data Fetch (Parents and Routes) ---
  const fetchInitialData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch students (now with stop info)
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          id, name, student_uid, parent_id, route_id, stop_id,
          profiles ( id, name, email ), 
          routes ( id, name ),
          stops ( id, name ) 
        `)
        .order('name', { ascending: true });
      if (studentError) throw studentError;
      setStudents(studentData);

      // Fetch parents
      const { data: parentData, error: parentError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'parent')
        .order('name', { ascending: true});
      if (parentError) throw parentError;
      setParents(parentData);

      // Fetch routes
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

  // --- NEW: Fetch stops when selectedRouteId changes ---
  useEffect(() => {
    if (!selectedRouteId) {
      setAvailableStops([]);
      setSelectedStopId(''); // Clear stop selection if route is cleared
      return;
    }

    const fetchStopsForRoute = async () => {
      try {
        const { data, error } = await supabase
          .from('route_stops')
          .select('stops ( id, name )')
          .eq('route_id', selectedRouteId)
          .order('stop_order', { ascending: true });
        
        if (error) throw error;
        
        // Flatten the data from { stops: { id, name } } to { id, name }
        const stops = data.map(item => item.stops);
        setAvailableStops(stops);
      } catch (error) {
        console.error('Error fetching stops for route:', error);
      }
    };

    fetchStopsForRoute();
  }, [selectedRouteId]); // This effect runs when selectedRouteId changes

  // Real-time subscriptions (no changes needed here)
  useEffect(() => {
    // ... (all existing subscription code is unchanged) ...
    const studentsListener = supabase
      .channel('public:students')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          console.log('Student data changed!', payload);
          fetchInitialData(); // Silent update
        }
      )
      .subscribe();
    const parentsListener = supabase
      .channel('public:profiles:parents_students')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.parent' },
        (payload) => {
          console.log('Parent data changed!', payload);
          fetchInitialData(); // Silent update
        }
      )
      .subscribe();
    const routesListener = supabase
      .channel('public:routes:students')
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
      supabase.removeChannel(studentsListener);
      supabase.removeChannel(parentsListener);
      supabase.removeChannel(routesListener);
    };
  }, [fetchInitialData]);


  // --- MODIFIED: Handle Form Submit ---
  const handleSubmitStudent = async (e) => {
    e.preventDefault();

    // Stop ID is now optional, so we don't check for it
    if (!studentName || !studentUid || !selectedParentId || !selectedRouteId) {
      alert('Please fill in Name, UID, Parent, and Route.');
      return;
    }

    try {
      let error;
      const updates = {
        name: studentName,
        student_uid: studentUid,
        parent_id: selectedParentId,
        route_id: selectedRouteId,
        stop_id: selectedStopId || null, // --- NEW: Save stop_id (or null if empty)
      };

      if (isEditing) {
        ({ error } = await supabase
          .from('students')
          .update(updates)
          .eq('id', editingStudentId));
      } else {
        ({ error } = await supabase
          .from('students')
          .insert(updates));
      }

      if (error) throw error;
      
      alert(isEditing ? 'Student updated!' : 'Student created!');
      resetForm();
      fetchInitialData(); // Refresh list to show new data

    } catch (error) {
      if (error.code === '23505') {
         alert('Error: This Student UID (NFC/QR ID) is already in use.');
      } else {
         alert(error.error_description || error.message);
      }
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    // ... (unchanged)
    if (window.confirm(`Are you sure you want to delete "${studentName}"?`)) {
      try {
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', studentId);
        
        if (error) throw error;
        alert('Student deleted successfully!');
        fetchInitialData();
      } catch (error) {
        if (error.code === '23503') {
          alert(`Error: Cannot delete "${studentName}" because they have existing attendance logs.`);
        } else {
          alert(error.error_description || error.message);
        }
      }
    }
  };

  // --- MODIFIED: Handle Edit Click ---
  const handleEditClick = (student) => {
    setIsEditing(true);
    setEditingStudentId(student.id);
    setStudentName(student.name);
    setStudentUid(student.student_uid);
    setSelectedParentId(student.parent_id);
    setSelectedRouteId(student.route_id); // This will trigger the useEffect to fetch stops
    setSelectedStopId(student.stop_id || ''); // --- NEW ---
  };

  // --- MODIFIED: Reset Form ---
  const resetForm = () => {
    setIsEditing(false);
    setEditingStudentId(null);
    setStudentName('');
    setStudentUid('');
    setSelectedParentId('');
    setSelectedRouteId('');
    setSelectedStopId(''); // --- NEW ---
    setAvailableStops([]); // --- NEW ---
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading students...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">🎓 Manage Students</h1>
        <p className="page-subtitle">Add and manage students and their routes</p>
      </div>

      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 2fr' }}>
        {/* --- MODIFIED: Form Card --- */}
        <div className="card card-spacious">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
            {isEditing ? '✏️ Update Student' : '➕ Add New Student'}
          </h3>
          
          <form onSubmit={handleSubmitStudent}>
            <div className="form-group">
              <label>Student's Full Name</label>
              <input
                type="text"
                placeholder="Enter student's name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Student UID</label>
              <input
                type="text"
                placeholder="Scan NFC/QR Card"
                value={studentUid}
                onChange={(e) => setStudentUid(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Parent</label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                required
              >
                <option value="">Select a parent</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Route</label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)} // This now triggers the stop fetch
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
            
            {/* --- NEW: Dynamic Stop Dropdown --- */}
            <div className="form-group">
              <label>Assigned Stop (Optional)</label>
              <select
                value={selectedStopId}
                onChange={(e) => setSelectedStopId(e.target.value)}
                // Disable if no route is selected or no stops are available
                disabled={!selectedRouteId || availableStops.length === 0}
              >
                <option value="">
                  {selectedRouteId ? (availableStops.length > 0 ? 'Select a stop' : 'No stops on this route') : 'Select a route first'}
                </option>
                {availableStops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="submit" style={{ flex: 1 }}>
                {isEditing ? '💾 Update Student' : '➕ Add Student'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* --- MODIFIED: Table Card --- */}
        <div className="card card-spacious">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>Student List</h3>
            <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '700'
            }}>
              {students.length} {students.length === 1 ? 'Student' : 'Students'}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Route</th>
                  <th>Stop</th> {/* --- NEW COLUMN --- */}
                  <th style={{ textAlign: 'center', width: '180px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎓</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No students yet</div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Add your first student to get started</div>
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{student.name}</div>
                        <code style={{ 
                          backgroundColor: 'var(--bg-tertiary)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}>
                          UID: {student.student_uid}
                        </code>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: '500' }}>{student.profiles?.name ?? 'N/A'}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                            {student.profiles?.email ?? ''}
                          </div>
                        </div>
                      </td>
                      <td>{student.routes?.name ?? 'N/A'}</td>
                      
                      {/* --- NEW CELL --- */}
                      <td>{student.stops?.name ?? <span style={{color: 'var(--text-muted)'}}>N/A</span>}</td>

                      <td>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditClick(student)}
                            className="secondary"
                            style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name)}
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
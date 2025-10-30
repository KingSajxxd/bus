import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function ManageParents() {
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingParentId, setEditingParentId] = useState(null);

  const fetchParents = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'parent')
        .order('name', { ascending: true });

      if (error) throw error;
      setParents(data);
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchParents(true);
  }, [fetchParents]);

  // Real-time subscription
  useEffect(() => {
    const parentsListener = supabase
      .channel('public:profiles:parents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.parent' },
        (payload) => {
          console.log('Parent data changed!', payload);
          fetchParents(); // Silent update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(parentsListener);
    };
  }, [fetchParents]);

  const handleSubmitParent = async (e) => {
    e.preventDefault();

    try {
      if (isEditing) {
        if (!name) {
          alert('Please fill in the name.');
          return;
        }
        const { error } = await supabase
          .from('profiles')
          .update({ name: name })
          .eq('id', editingParentId);

        if (error) throw error;
        alert('Parent updated successfully!');

      } else {
        if (!name || !email || !password) {
          alert('Please fill in all fields.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              role: 'parent',
              name: name
            }
          }
        });

        if (error) throw error;
        alert('Parent created successfully!');
      }

      resetForm();
      // Real-time subscription will auto-update

    } catch (error) {
      alert(error.error_description || error.message);
    }
  };

  const handleEditClick = (parent) => {
    setIsEditing(true);
    setEditingParentId(parent.id);
    setName(parent.name);
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingParentId(null);
    setName('');
    setEmail('');
    setPassword('');
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading parents...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">👪 Manage Parents</h1>
        <p className="page-subtitle">Add and manage parent accounts</p>
      </div>

      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 2fr' }}>
        <div className="card card-spacious">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
            {isEditing ? '✏️ Update Parent' : '➕ Add New Parent'}
          </h3>
          
          <form onSubmit={handleSubmitParent}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter parent's full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {!isEditing && (
              <>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="parent@example.com"
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
                {isEditing ? '💾 Update Parent' : '➕ Add Parent'}
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
            <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>Parent List</h3>
            <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '700'
            }}>
              {parents.length} {parents.length === 1 ? 'Parent' : 'Parents'}
            </span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👪</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No parents yet</div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Add your first parent to get started</div>
                    </td>
                  </tr>
                ) : (
                  parents.map((parent) => (
                    <tr key={parent.id}>
                      <td><div style={{ fontWeight: '600' }}>{parent.name}</div></td>
                      <td><div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>{parent.email}</div></td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => handleEditClick(parent)} className="secondary" style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}>
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

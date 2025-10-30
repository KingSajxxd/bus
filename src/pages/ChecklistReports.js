// src/pages/ChecklistReports.js

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useOutletContext } from 'react-router-dom';

export default function ChecklistReports() {
  const { theme } = useOutletContext() || { theme: 'dark' };
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  
  // Use local date string for the input value (avoids UTC shifting)
  const getLocalDateInputValue = () => {
    const d = new Date();
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffsetMs);
    return local.toISOString().split('T')[0];
  };
  
  const [filterDate, setFilterDate] = useState(getLocalDateInputValue());
  const [selectedLog, setSelectedLog] = useState(null); // For modal

  // Keep calendar synced to today's date and roll over at midnight
  useEffect(() => {
    const setToday = () => setFilterDate(getLocalDateInputValue());
    setToday();

    let midnightTimer;
    const scheduleMidnightUpdate = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      midnightTimer = setTimeout(() => {
        setToday();
        scheduleMidnightUpdate();
      }, msUntilMidnight);
    };

    scheduleMidnightUpdate();
    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date(filterDate);
      startDate.setHours(0, 0, 0, 0); 
      const endDate = new Date(filterDate);
      endDate.setHours(23, 59, 59, 999); 

      let { data, error } = await supabase
        .from('trip_checklists_log')
        .select(`
          id,
          created_at,
          checklist_type,
          items_checked,
          profiles ( name, email ),
          buses ( name )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data);

    } catch (error) {
      setError(error.message);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Real-time subscription
  useEffect(() => {
    const startDate = new Date(filterDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(filterDate);
    endDate.setHours(23, 59, 59, 999);

    const channel = supabase
      .channel('checklist-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_checklists_log'
        },
        async (payload) => {
          console.log('Real-time change detected:', payload);
          
          // For any change, refetch the data to ensure we have the latest with proper joins
          // This is simpler and ensures data consistency
          const { data, error } = await supabase
            .from('trip_checklists_log')
            .select(`
              id,
              created_at,
              checklist_type,
              items_checked,
              profiles ( name, email ),
              buses ( name )
            `)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

          if (!error && data) {
            setLogs(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterDate]);

  const formatTimestamp = (ts) => {
    const dateObj = new Date(ts);
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading checklist logs...</p>
      </div>
    );
  }

  return (
    <div>
      {/* --- Modal for viewing details --- */}
      {selectedLog && (
        <ChecklistModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">✔️ Driver Checklists</h1>
        <p className="page-subtitle">Review pre-trip and post-trip safety checklists</p>
      </div>

      {/* --- Filter Card --- */}
      <div className="card card-spacious" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
          Filter by Date
        </h3>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, maxWidth: '400px', marginBottom: 0 }}>
            <label>Select Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <button onClick={fetchLogs} disabled={loading} style={{ height: '55px' }}>
            {loading ? '...' : 'Load'}
          </button>
        </div>
      </div>

      {/* --- Results Table Card --- */}
      <div className="card card-spacious">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>
            Logs for {new Date(filterDate).toLocaleDateString('en-US', { dateStyle: 'long' })}
          </h3>
          <span style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: '700'
          }}>
            {logs.length} {logs.length === 1 ? 'Log' : 'Logs'}
          </span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Driver</th>
                <th>Bus</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✔️</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No checklists found</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>No checklists were submitted on this date.</div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td><div style={{ fontWeight: '600' }}>{formatTimestamp(log.created_at)}</div></td>
                    <td>{log.profiles?.name ?? 'N/A'}</td>
                    <td>{log.buses?.name ?? 'N/A'}</td>
                    <td>
                      <span style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        backgroundColor: log.checklist_type === 'PRE_TRIP' 
                          ? (theme === 'light' ? '#dbeafe' : '#1e3a8a') 
                          : (theme === 'light' ? '#fee2e2' : '#991b1b'),
                        color: log.checklist_type === 'PRE_TRIP' 
                          ? (theme === 'light' ? '#1d4ed8' : '#93c5fd')
                          : (theme === 'light' ? '#991b1b' : '#fecaca')
                      }}>
                        {log.checklist_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="secondary" style={{ padding: '0.625rem 1rem' }} onClick={() => setSelectedLog(log)}>
                        View Details
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
  );
}

// --- NEW: Modal Component ---
// (Add this component to the same file, below the main function)
function ChecklistModal({ log, onClose }) {
  const items = log.items_checked ? Object.entries(log.items_checked) : [];

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
      }}
    >
      <div 
        className="card"
        onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking inside
        style={{
          width: '100%',
          maxWidth: '500px',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <h3 style={{ margin: 0, fontWeight: '700' }}>Checklist Details</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          {log.checklist_type} submitted by {log.profiles?.name} for {log.buses?.name}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No items found in this log.</p>
          ) : (
            items.map(([item, checked]) => (
              <div 
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>
                  {checked ? '✅' : '❌'}
                </span>
                <span style={{ flex: 1, color: checked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {item}
                </span>
              </div>
            ))
          )}
        </div>

        <button onClick={onClose} className="secondary" style={{ width: '100%', marginTop: '2rem' }}>
          Close
        </button>
      </div>
    </div>
  );
}
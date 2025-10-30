// src/pages/Reports.js

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useOutletContext } from 'react-router-dom';

export default function Reports() {
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
  const [filterManualOnly, setFilterManualOnly] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // --- FIX 1: Create UTC date strings directly ---
      // This creates '2025-10-30T00:00:00.000Z'
      const startDate = `${filterDate}T00:00:00.000Z`;
      // This creates '2025-10-30T23:59:59.999Z'
      const endDate = `${filterDate}T23:59:59.999Z`;

      let query = supabase
        .from('attendance_log')
        .select(`
          id,
          timestamp,
          status,
          manual_override,
          students (
            name,
            student_uid,
            routes ( name )
          )
        `)
        .gte('timestamp', startDate) // Pass the UTC string directly
        .lte('timestamp', endDate)   // Pass the UTC string directly
        .order('timestamp', { ascending: false });

      if (filterManualOnly) {
        query = query.eq('manual_override', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data);

    } catch (error) {
      setError(error.message);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterManualOnly]); // Dependencies are correct

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

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('attendance_log_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_log'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]); // fetchLogs is the only dependency needed

  // --- FIX 2: Correctly format the timestamp ---
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    try {
      // Create a Date object from the UTC timestamp string
      const dateObj = new Date(ts);
      
      // Format it to Sri Lanka's local time
      return dateObj.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Colombo', // Specify your timezone
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid Date';
    }
  };

  if (loading) {
    // ... (loading spinner JSX is unchanged)
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading reports...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ... (All the JSX for the page is unchanged) ... */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">📊 Attendance Reports</h1>
        <p className="page-subtitle">Review attendance logs and manual overrides</p>
      </div>

      <div className="card card-spacious" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
          Report Filters
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="form-group">
            <label>Select Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          
          <div className="form-group" style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginBottom: '0.75rem' }}>Options</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '55px' }}>
              <input
                type="checkbox"
                id="manual-toggle"
                checked={filterManualOnly}
                onChange={(e) => setFilterManualOnly(e.target.checked)}
                style={{ width: 'auto', height: '20px', width: '20px' }}
              />
              <label htmlFor="manual-toggle" style={{ marginBottom: '0', fontWeight: '500' }}>
                Show Manual Overrides Only
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-spacious">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>
            {filterManualOnly ? 'Manual Logs' : 'All Logs'} for {new Date(filterDate).toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' })}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={fetchLogs}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔄 Refresh
            </button>
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
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Time (Sri Lanka)</th>
                <th>Student Name</th>
                <th>UID</th>
                <th>Route</th>
                <th>Status</th>
                <th>Manual</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No logs found</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Try adjusting your filters</div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{formatTimestamp(log.timestamp)}</div>
                    </td>
                    <td>{log.students?.name ?? 'N/A'}</td>
                    <td>
                      <code style={theme === 'light' ? { backgroundColor: '#f3f4f6', color: '#4b5563'} : {}}>
                        {log.students?.student_uid ?? 'N/A'}
                      </code>
                    </td>
                    <td>{log.students?.routes?.name ?? 'N/A'}</td>
                    <td>
                      <span style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        backgroundColor: log.status === 'ON BUS' ? (theme === 'light' ? '#dcfce7' : '#166534') : (theme === 'light' ? '#fee2e2' : '#991b1b'),
                        color: log.status === 'ON BUS' ? (theme === 'light' ? '#15803d' : '#a7f3d0') : (theme === 'light' ? '#991b1b' : '#fecaca')
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td>
                      {log.manual_override ? (
                        <span style={{ color: theme === 'light' ? '#f59e0b' : '#fcd34d', fontWeight: '700' }}>
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No</span>
                      )}
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
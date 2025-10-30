// src/pages/AbsenceReports.js

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useOutletContext } from 'react-router-dom';

export default function AbsenceReports() {
  const { theme } = useOutletContext() || { theme: 'dark' };
  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState([]);
  const [error, setError] = useState(null);
  
  // Use local date string for the input value (avoids UTC shifting)
  const getLocalDateInputValue = () => {
    const d = new Date();
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffsetMs);
    return local.toISOString().split('T')[0];
  };
  
  const [filterDate, setFilterDate] = useState(getLocalDateInputValue());

  // Keep calendar synced to today's date and roll over at midnight
  useEffect(() => {
    const setToday = () => setFilterDate(getLocalDateInputValue());
    // Ensure it's set on mount (in case of stale state after hot reload)
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

  const fetchAbsences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date(filterDate);
      startDate.setHours(0, 0, 0, 0); 
      const endDate = new Date(filterDate);
      endDate.setHours(23, 59, 59, 999); 

      let query = supabase
        .from('daily_absences')
        .select(`
          id,
          absence_date,
          created_at,
          students (
            name,
            student_uid,
            routes ( name )
          ),
          profiles ( name, email )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setAbsences(data);

    } catch (error) {
      setError(error.message);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('daily_absences_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'daily_absences'
        },
        async (payload) => {
          console.log('Real-time change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Fetch the full record with joined data
            const { data, error } = await supabase
              .from('daily_absences')
              .select(`
                id,
                absence_date,
                created_at,
                students (
                  name,
                  student_uid,
                  routes ( name )
                ),
                profiles ( name, email )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && data) {
              // Check if the absence is for the current filtered date
              const absenceDate = new Date(data.created_at);
              const filterDateObj = new Date(filterDate);
              
              if (absenceDate.toDateString() === filterDateObj.toDateString()) {
                // Add the new absence to the top of the list
                setAbsences(prev => [data, ...prev]);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch updated record with joined data
            const { data, error } = await supabase
              .from('daily_absences')
              .select(`
                id,
                absence_date,
                created_at,
                students (
                  name,
                  student_uid,
                  routes ( name )
                ),
                profiles ( name, email )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && data) {
              setAbsences(prev => 
                prev.map(absence => 
                  absence.id === data.id ? data : absence
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            // Remove the deleted absence from the list
            setAbsences(prev => 
              prev.filter(absence => absence.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterDate]); // Re-subscribe when filter date changes

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
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading absence reports...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">📋 Absence Reports</h1>
        <p className="page-subtitle">Review all student absences reported by parents</p>
      </div>

      {/* Filter Card */}
      <div className="card card-spacious" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '2rem', fontWeight: '700' }}>
          Filter by Date
        </h3>
        <div style={{ maxWidth: '400px' }}>
          <div className="form-group">
            <label>Select Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results Table Card */}
      <div className="card card-spacious">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: '700' }}>
            Logs for {new Date(filterDate).toLocaleDateString()}
          </h3>
          <span style={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: '700'
          }}>
            {absences.length} {absences.length === 1 ? 'Absence' : 'Absences'}
          </span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Route</th>
                <th>Reported by (Parent)</th>
                <th>Time Reported</th>
              </tr>
            </thead>
            <tbody>
              {absences.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No absences found</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>No students were reported absent on this date.</div>
                  </td>
                </tr>
              ) : (
                absences.map((log) => (
                  <tr key={log.id}>
                    <td><div style={{ fontWeight: '600' }}>{log.students?.name ?? 'N/A'}</div></td>
                    <td>{log.students?.routes?.name ?? 'N/A'}</td>
                    <td>
                      <div>{log.profiles?.name ?? 'N/A'}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                        {log.profiles?.email ?? ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{formatTimestamp(log.created_at)}</div>
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
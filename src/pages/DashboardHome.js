import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl'; 
// 1. Import useOutletContext
import { useOutletContext } from 'react-router-dom';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2FqYWl5b29iIiwiYSI6ImNtaGM5NWRwMTF3OTUya3M2YnQ2Z3FqbDQifQ.MUXMMjK8eGJIL3Nlrrlj-A';

export default function DashboardHome() {
  // 2. Get the theme from the context
  // Default to 'dark' in case context is not ready
  const { theme } = useOutletContext() || { theme: 'dark' };

  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState(null);

  const [viewState, setViewState] = useState({
    latitude: 6.9271,
    longitude: 79.8612,
    zoom: 9,
    pitch: 0,
    bearing: 0
  });

  const [selectedBus, setSelectedBus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);

  // 3. Set map style based on the theme prop
  const MAP_STYLE = theme === 'light' ? 'mapbox://styles/mapbox/streets-v11' : 'mapbox://styles/mapbox/dark-v11';

  const updateTimerRef = useRef(null);

  const fetchDashboardData = useCallback(async (showLoading = false) => {
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
          live_lat,
          live_lng,
          last_seen,
          profiles ( id, name, email ), 
          routes ( id, name )
        `)
        .order('name', { ascending: true });
      
      if (busError) throw busError;
      setBuses(busData);

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .limit(1000);
      
      if (studentError) throw studentError;
      setStudents(studentData || []);
    } catch (error) {
      setError(error.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced version of fetchDashboardData
  const debouncedFetchDashboardData = useCallback(() => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    updateTimerRef.current = setTimeout(() => {
      fetchDashboardData();
    }, 300); // Wait 300ms before updating
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  useEffect(() => {
    const busListener = supabase
      .channel('public:buses:dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buses' },
        (payload) => {
          console.log('🚌 Bus data changed!', payload);
          debouncedFetchDashboardData();
        }
      )
      .subscribe((status) => {
        console.log('Bus subscription status:', status);
      });

    const studentListener = supabase
      .channel('public:students:dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          console.log('🎓 Student data changed!', payload);
          debouncedFetchDashboardData();
        }
      )
      .subscribe((status) => {
        console.log('Student subscription status:', status);
      });

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      supabase.removeChannel(busListener);
      supabase.removeChannel(studentListener);
    };
  }, [debouncedFetchDashboardData]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          routes ( id, name ),
          profiles ( id, name, email ) 
        `)
        .ilike('name', `%${searchQuery}%`)
        .limit(1);

      if (studentError) throw studentError;
      if (!studentData || studentData.length === 0) {
        throw new Error(`No student found with the name "${searchQuery}".`);
      }

      const student = studentData[0];
      const routeId = student.routes?.id;

      if (!routeId) {
        throw new Error(`Student "${student.name}" is not assigned to a route.`);
      }

      let bus = buses.find(b => b.routes?.id === routeId);

      if (!bus) {
        const { data: busData, error: busError } = await supabase
          .from('buses')
          .select(`
            id,
            name,
            live_status,
            live_lat,
            live_lng,
            profiles ( id, name, email )
          `)
          .eq('route_id', routeId)
          .limit(1);

        if (busError) throw busError;
        if (!busData || busData.length === 0) {
          throw new Error(`No bus is currently assigned to route "${student.routes.name}".`);
        }
        bus = busData[0];
      }
      
      setSearchResult({
        student: student,
        parent: student.profiles,
        route: student.routes,
        bus: bus,
        driver: bus.profiles
      });

      if (bus.live_lat && bus.live_lng) {
        setViewState(prev => ({
          ...prev,
          latitude: bus.live_lat,
          longitude: bus.live_lng,
          zoom: 15,
          transitionDuration: 2000
        }));
        setSelectedBus(bus);
      }

    } catch (error) {
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const activeBuses = useMemo(() => buses.filter(b => b.live_status === 'On-Route').length, [buses]);
  const sosAlerts = useMemo(() => buses.filter(b => b.live_status === 'SOS').length, [buses]);
  const activeStudents = useMemo(() => students.length, [students]);

  // Animated counter component - memoized
  const AnimatedCounter = memo(({ value }) => {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
      if (displayValue === value) return;

      const duration = 500; // Animation duration in ms
      const steps = 20; // Number of animation steps
      const stepValue = (value - displayValue) / steps;
      const stepDuration = duration / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(prev => Math.round(prev + stepValue));
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }, [value, displayValue]);

    return <>{displayValue}</>;
  });

  AnimatedCounter.displayName = 'AnimatedCounter';

  const StatCard = memo(({ title, value, subtitle, icon, color }) => (
    <div className="card stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="stat-card-title">
            {title}
          </div>
          <div className="stat-card-value">
            <AnimatedCounter value={value} />
          </div>
          <div className="stat-card-subtitle">
            {subtitle}
          </div>
        </div>
        <div className="stat-card-icon" style={{ background: color }}>
          {icon}
        </div>
      </div>
    </div>
  ));

  StatCard.displayName = 'StatCard';

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading dashboard...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card" style={{ background: 'var(--color-danger)', border: '2px solid var(--color-danger)' }}>
        <p style={{ color: 'white' }}>Error loading data: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">Welcome back, Admin • Monitor your fleet in real-time</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2.5rem' 
      }}>
        <StatCard
          title="Total Buses Active"
          value={activeBuses}
          subtitle={`${buses.length} total buses`}
          icon="🚌"
          color="linear-gradient(135deg, #5230e0 0%, #6c47ff 100%)"
        />
        <StatCard
          title="Active Students"
          value={activeStudents}
          subtitle="All students"
          icon="🎓"
          color="linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)"
        />
        <StatCard
          title="Active Alerts"
          value={sosAlerts}
          subtitle={sosAlerts > 0 ? "⚠️ Requires attention" : "✅ All clear"}
          icon={sosAlerts > 0 ? "🚨" : "✅"}
          color={sosAlerts > 0 ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"}
        />
      </div>

      {sosAlerts > 0 && (
        <div 
          className="card"
          style={{
          background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
          color: 'white',
          marginBottom: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          border: 'none',
          boxShadow: '0 10px 30px rgba(229, 62, 62, 0.4)',
        }}>
          <div style={{ fontSize: '2.5rem' }}>🚨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
              URGENT - {sosAlerts} SOS ALERT{sosAlerts > 1 ? 'S' : ''}
            </div>
            <div style={{ fontSize: '0.9375rem', opacity: 0.95 }}>
              {buses.filter(b => b.live_status === 'SOS').map(b => b.name).join(', ')} {sosAlerts > 1 ? 'have' : 'has'} triggered emergency alerts
            </div>
          </div>
          <button style={{
            background: 'white',
            color: '#e53e3e',
            padding: '0.875rem 2rem',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            boxShadow: 'none'
          }}>
            View Details
          </button>
        </div>
      )}

      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '400px 1fr',
        gap: '2rem',
        marginBottom: '2.5rem',
        alignItems: 'start'
      }}>
        
        <div className="card" style={{ height: '600px', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: '700', padding: '0 0.5rem' }}>
            🚍 Bus Status List
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
            {buses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  No buses in system
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {buses.map(bus => (
                  <div 
                    key={bus.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-color)',
                      background: bus.live_status === 'SOS' ? 'rgba(229, 62, 62, 0.1)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'var(--text-muted)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {bus.name}
                      </div>
                      <span style={{
                        padding: '0.375rem 0.875rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: bus.live_status === 'SOS' ? 'var(--color-sos)' : 
                                   bus.live_status === 'On-Route' ? 'var(--color-success)' : 'var(--border-color)',
                        color: bus.live_status === 'SOS' || bus.live_status === 'On-Route' ? 'white' : 'var(--text-secondary)'
                      }}>
                        {bus.live_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <strong>Driver:</strong> {bus.profiles?.name ?? 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <strong>Route:</strong> {bus.routes?.name ?? 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="card" style={{ height: '600px', padding: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700' }}>
            🗺️ Live Fleet Tracking
          </h3>
          <div style={{ 
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            height: 'calc(100% - 3rem)',
            position: 'relative',
          }}>
            <Map
              // 4. Add a key to force re-mount on theme change
              key={theme} 
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' }}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={MAP_STYLE} // Use the theme-aware style
            >
              <NavigationControl position="top-left" />

              {buses.map(bus => 
                (bus.live_lat && bus.live_lng && bus.live_status !== 'Offline') && (
                  <Marker
                    key={bus.id}
                    latitude={bus.live_lat}
                    longitude={bus.live_lng}
                    offsetLeft={-15}
                    offsetTop={-15}
                  >
                    <div 
                      onClick={() => {
                        setSelectedBus(bus);
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        fontSize: '32px',
                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                        transition: 'transform 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {bus.live_status === 'SOS' ? '🚨' : '🚌'}
                    </div>
                  </Marker>
                )
              )}

              {selectedBus && (
                <Popup
                  latitude={selectedBus.live_lat}
                  longitude={selectedBus.live_lng}
                  onClose={() => setSelectedBus(null)}
                  closeOnClick={false} 
                  anchor="bottom"
                  // This tells mapbox's popup to use our CSS variables
                  style={{'--mapbox-popup-background-color': 'var(--bg-secondary)', '--mapbox-popup-text-color': 'var(--text-primary)'}}
                >
                  <div style={{ minWidth: '220px', padding: '0.75rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-primary)', fontSize: '1rem' }}>{selectedBus.name}</h4>
                    <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--text-secondary)'}}>
                      <div style={{ marginBottom: '0.5rem', color: 'var(--text-primary)'}}>
                        <strong>Driver:</strong> {selectedBus.profiles?.name ?? 'N/A'}
                      </div>
                      <div>
                        <strong>Status:</strong> <span style={{ 
                          fontWeight: '600',
                          color: selectedBus.live_status === 'SOS' ? 'var(--color-sos)' : selectedBus.live_status === 'On-Route' ? 'var(--color-success)' : 'var(--text-secondary)'
                        }}>{selectedBus.live_status}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              )}
            </Map>
          </div>
        </div>
      </div>

      {/* Student Locator - This will also be themed by variables */}
      <div className="card">
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔍</span> Student Locator
        </h3>
        <form onSubmit={handleSearch} style={{ marginBottom: searchResult || searchError ? '1.5rem' : '0' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Search by student name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, marginBottom: '0' }}
            />
            <button type="submit" disabled={isSearching} style={{ whiteSpace: 'nowrap', padding: '0.875rem 2rem' }}>
              {isSearching ? 'Searching...' : 'Search Student'}
            </button>
          </div>
        </form>

        {isSearching && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        )}
        
        {searchError && (
          <div style={{ 
            background: 'rgba(229, 62, 62, 0.1)', 
            color: '#e53e3e', 
            padding: '1.25rem', 
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--color-danger)',
            fontWeight: '500'
          }}>
            ⚠️ {searchError}
          </div>
        )}
        
        {searchResult && (
          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '2rem', 
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--border-color)'
          }}>
            <h4 style={{ margin: '0 0 1.5rem 0', color: 'var(--color-primary-hover)', fontSize: '1.125rem', fontWeight: '700' }}>
              ✓ Search Result
            </h4>
            <div style={{ 
              display: 'grid', 
              gap: '1.5rem', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' 
            }}>
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Student
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>{searchResult.student.name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Parent: {searchResult.parent?.name ?? 'N/A'}<br />
                  {searchResult.parent?.email ?? ''}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Route & Bus
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>{searchResult.route.name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Bus: {searchResult.bus.name}<br />
                  Status: <span style={{ fontWeight: '600' }}>{searchResult.bus.live_status}</span>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Driver
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>{searchResult.driver?.name ?? 'N/A'}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {searchResult.driver?.email ?? 'No email'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
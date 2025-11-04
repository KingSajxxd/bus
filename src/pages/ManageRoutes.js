// src/pages/ManageRoutes.js

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import Map, { Marker, NavigationControl, Popup, useControl } from 'react-map-gl';
import { useOutletContext } from 'react-router-dom';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'; // --- IMPORT GEOCODER ---

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2FqYWl5b29iIiwiYSI6ImNtaGM5NWRwMTF3OTUya3M2YnQ2Z3FqbDQifQ.MUXMMjK8eGJIL3Nlrrlj-A';

// --- (Draggable Item Component is unchanged) ---
function SortableStopItem({ stop, index, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: stop.routeStopId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    padding: '1.25rem',
    borderRadius: 'var(--radius-lg)',
    marginBottom: '0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span style={{ color: 'var(--text-muted)', marginRight: '1.5rem', fontSize: '1.25rem', cursor: 'grab' }}>☰</span>
      <span style={{
        background: 'var(--color-primary)',
        color: 'white',
        fontWeight: 'bold',
        borderRadius: '100px',
        width: '28px',
        height: '28px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '1rem',
      }}>
        {index + 1}
      </span>
      <span style={{ flex: 1, fontWeight: '600' }}>{stop.name}</span>
      <button 
        className="danger" 
        onClick={() => onRemove(stop.routeStopId, stop.id)}
        style={{ padding: '0.5rem', fontSize: '0.75rem', lineHeight: 1, cursor: 'pointer' }}
      >
        🗑️
      </button>
    </div>
  );
}

// --- NEW: Geocoder (Address Search) Component ---
function GeocoderControl({ onResult }) {
  const geocoder = new MapboxGeocoder({
    accessToken: MAPBOX_TOKEN,
    mapboxgl: null, // This will be set by useControl
    marker: false,  // We'll handle the marker ourselves
    placeholder: 'Search for a street address...',
    types: 'address', // Focus on addresses rather than POIs or cities
    proximity: [79.8612, 6.9271], // Default to Sri Lanka coordinates
  });

  useControl(() => {
    // This connects the geocoder to the react-map-gl map instance
    return geocoder;
  }, {
    position: 'top-right'
  });
  
  // Listen for when a result is selected
  geocoder.on('result', (e) => {
    const { result } = e;
    const [lng, lat] = result.geometry.coordinates;
    const name = result.text;
    // Use place_name for full address (includes street, city, etc.)
    // If not available, try to construct from context or use name
    const fullAddress = result.place_name || 
      (result.context ? 
        `${result.text}, ${result.context.map(ctx => ctx.text).join(', ')}` : 
        result.text);
    onResult({ lat, lng, name, fullAddress });
  });

  return null; // The control is added to the map automatically
}

export default function ManageRoutes() {
  const { theme } = useOutletContext() || { theme: 'dark' };

  // --- (State is unchanged) ---
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [newRouteName, setNewRouteName] = useState('');
  const [newStopName, setNewStopName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mapPopup, setMapPopup] = useState(null);
  const [viewState, setViewState] = useState({
    latitude: 6.9271,
    longitude: 79.8612,
    zoom: 9,
  });
  const mapRef = useRef(); // --- ADDED: Need a ref to the map ---
  
  const MAP_STYLE = theme === 'light' 
    ? 'mapbox://styles/mapbox/streets-v11' 
    : 'mapbox://styles/mapbox/dark-v11';

  // --- (Data fetching and route handlers are unchanged) ---
  const fetchAllData = useCallback(async () => {
    // ... (unchanged)
    setLoading(true);
    try {
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select('*')
        .order('name', { ascending: true });
      if (routesError) throw routesError;
      setRoutes(routesData);

      const { data: stopsData, error: stopsError } = await supabase
        .from('stops')
        .select('*')
        .order('name', { ascending: true });
      if (stopsError) throw stopsError;
      setAllStops(stopsData);

    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    // ... (unchanged)
    if (!selectedRouteId) {
      setRouteStops([]);
      return;
    }
    const fetchRouteStops = async () => {
      try {
        const { data, error } = await supabase
          .from('route_stops')
          .select('id, stop_order, stops (*)')
          .eq('route_id', selectedRouteId)
          .order('stop_order', { ascending: true });
        if (error) throw error;
        const formattedStops = data.map(rs => ({
          routeStopId: rs.id,
          order: rs.stop_order,
          ...rs.stops
        }));
        setRouteStops(formattedStops);
      } catch (error) {
        alert(error.error_description || error.message);
      }
    };
    fetchRouteStops();
  }, [selectedRouteId]);

  const handleAddRoute = async (e) => {
    // ... (unchanged)
    e.preventDefault();
    if (!newRouteName) return;
    try {
      const { data, error } = await supabase
        .from('routes')
        .insert({ name: newRouteName })
        .select();
      if (error) throw error;
      setRoutes([...routes, data[0]]);
      setNewRouteName('');
    } catch (error) {
      alert(error.error_description || error.message);
    }
  };

  const handleDeleteRoute = async (routeId, routeName) => {
    // ... (unchanged)
    if (window.confirm(`Are you sure you want to delete route "${routeName}"? This will also remove it from any buses or students.`)) {
      try {
        await supabase.from('buses').update({ route_id: null }).eq('route_id', routeId);
        await supabase.from('students').update({ route_id: null }).eq('route_id', routeId);
        const { error } = await supabase.from('routes').delete().eq('id', routeId);
        if (error) throw error;
        setRoutes(routes.filter(r => r.id !== routeId));
        if (selectedRouteId === routeId) {
          setSelectedRouteId(null);
        }
      } catch (error) {
        alert(error.error_description || error.message);
      }
    }
  };

  // --- (MapClick and CreateStop are unchanged) ---
  const handleMapClick = (e) => {
    // ... (unchanged)
    if (mapPopup) {
      setMapPopup(null);
      setNewStopName('');
    } else {
      const { lat, lng } = e.lngLat;
      setMapPopup({ lat, lng });
    }
  };

  const handleCreateStop = async () => {
    // ... (unchanged)
    if (!newStopName || !mapPopup) return;
    try {
      const { data, error } = await supabase
        .from('stops')
        .insert({ name: newStopName, lat: mapPopup.lat, lng: mapPopup.lng })
        .select();
      if (error) throw error;
      setAllStops([...allStops, data[0]]);
      setNewStopName('');
      setMapPopup(null);
    } catch (error) {
      if (error.code === '23505') {
        alert('A stop already exists at this exact location.');
      } else {
        alert(error.error_description || error.message);
      }
    }
  };

  // --- NEW: Handler for Geocoder (Address Search) result ---
  const handleGeocoderResult = ({ lat, lng, name, fullAddress }) => {
    // Fly the map to the new location
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15 });
    }
    // Set the popup to create a new stop
    setMapPopup({ lat, lng });
    // Use full address if available, otherwise use the name
    setNewStopName(fullAddress || name); // Pre-fill the stop name with full address
  };
  
  // --- NEW: Handler to delete a stop from the MASTER LIST ---
  const handleDeleteStop = async (stopId, stopName) => {
    if (window.confirm(`Are you sure you want to delete "${stopName}" from the master list? This will remove it from ALL routes.`)) {
      try {
        // Optimistic UI update
        setAllStops(prev => prev.filter(s => s.id !== stopId));

        // Delete from DB. The 'ON DELETE CASCADE' we added will
        // automatically remove it from all 'route_stops' entries.
        const { error } = await supabase
          .from('stops')
          .delete()
          .eq('id', stopId);
        
        if (error) throw error;

      } catch (error) {
        alert(error.error_description || error.message);
        // TODO: Rollback optimistic update
      }
    }
  };
  
  // --- (Rest of handlers are unchanged) ---
  const availableStops = useMemo(() => {
    // ... (unchanged)
    const stopsInRouteIds = new Set(routeStops.map(s => s.id));
    return allStops.filter(s => !stopsInRouteIds.has(s.id));
  }, [allStops, routeStops]);

  const handleAddStopToRoute = async (stopId) => {
    // ... (unchanged)
    if (!selectedRouteId) {
      alert('Please select a route first.');
      return;
    }
    const stopToAdd = allStops.find(s => s.id === stopId);
    if (!stopToAdd) return;
    const newStopOrder = routeStops.length > 0 ? Math.max(...routeStops.map(s => s.order)) + 1 : 1;
    const optimisticStop = {
      routeStopId: `temp-${Date.now()}`,
      order: newStopOrder,
      ...stopToAdd
    };
    setRouteStops([...routeStops, optimisticStop]);
    try {
      const { data, error } = await supabase
        .from('route_stops')
        .insert({
          route_id: selectedRouteId,
          stop_id: stopId,
          stop_order: newStopOrder
        })
        .select('id, stop_order, stops (*)')
        .single();
      if (error) throw error;
      const newRouteStop = {
        routeStopId: data.id,
        order: data.stop_order,
        ...data.stops
      };
      setRouteStops(prevStops => 
        prevStops.map(s => s.routeStopId === optimisticStop.routeStopId ? newRouteStop : s)
      );
    } catch (error) {
      alert(error.error_description || error.message);
      setRouteStops(prevStops => prevStops.filter(s => s.id !== stopId));
    }
  };

  const handleRemoveStopFromRoute = async (routeStopId, stopId) => {
    // ... (unchanged)
    const stopToRemove = routeStops.find(s => s.routeStopId === routeStopId);
    if (!stopToRemove) return;
    const newRouteStops = routeStops.filter(s => s.routeStopId !== routeStopId);
    setRouteStops(newRouteStops);
    try {
      const { error } = await supabase
        .from('route_stops')
        .delete()
        .eq('id', routeStopId);
      if (error) throw error;
      await handleSaveOrder(newRouteStops);
    } catch (error) {
      alert(error.error_description || error.message);
      setRouteStops(prevStops => [...prevStops, stopToRemove].sort((a,b) => a.order - b.order));
    }
  };
  
  const handleSaveOrder = async (stopsToSave) => {
    // ... (unchanged)
    setIsSaving(true);
    try {
      const updates = stopsToSave.map((stop, index) => ({
        id: stop.routeStopId,
        route_id: selectedRouteId,
        stop_id: stop.id,
        stop_order: index + 1
      }));
      const { error } = await supabase.from('route_stops').upsert(updates);
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const sensors = useSensors(
    // ... (unchanged)
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    // ... (unchanged)
    const { active, over } = event;
    if (active.id !== over.id) {
      setRouteStops((items) => {
        const oldIndex = items.findIndex(item => item.routeStopId === active.id);
        const newIndex = items.findIndex(item => item.routeStopId === over.id);
        const reorderedStops = arrayMove(items, oldIndex, newIndex);
        const updatedStops = reorderedStops.map((stop, index) => ({
          ...stop,
          order: index + 1
        }));
        handleSaveOrder(updatedStops);
        return updatedStops;
      });
    }
  }

  // --- JSX ---
  return (
    <div>
      {/* ... (Page title is unchanged) ... */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title">🗺️ Route Builder</h1>
        <p className="page-subtitle">Create routes and manage their stops by dragging and dropping</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        
        {/* --- Left Column --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* ... (Routes List is unchanged) ... */}
          <div className="card card-spacious">
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', fontWeight: '700' }}>1. Select a Route</h3>
            <form onSubmit={handleAddRoute} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="New Route Name"
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button type="submit" style={{ padding: '0.75rem 1rem' }}>➕ Add</button>
            </form>
            <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {routes.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>No routes created yet.</p>
              ) : (
                routes.map(route => (
                  <div key={route.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '0.5rem',
                    background: selectedRouteId === route.id ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                    color: selectedRouteId === route.id ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                    onClick={() => setSelectedRouteId(route.id)}
                  >
                    <span style={{ fontWeight: '600' }}>{route.name}</span>
                    <button 
                      className="danger" 
                      onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id, route.name); }}
                      style={{ padding: '0.5rem', fontSize: '0.75rem', lineHeight: 1 }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* --- MODIFIED: Stop Bank (Available Stops) --- */}
          <div className="card card-spacious">
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', fontWeight: '700' }}>2. Stop Bank</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              💡 <strong>Tip:</strong> Use the map search box to find street addresses. Click a stop to add it to the route. Click 🗑️ to delete it from the master list.
            </p>
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {availableStops.length === 0 ? (
                 <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
                   {allStops.length === 0 ? 'No stops created yet.' : 'All stops are on this route.'}
                 </p>
              ) : (
                availableStops.map(stop => (
                  <div key={stop.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '0.5rem',
                    background: 'var(--bg-tertiary)',
                  }}
                  >
                    <span style={{ fontWeight: '500', flex: 1, cursor: 'pointer' }} onClick={() => handleAddStopToRoute(stop.id)}>
                      {stop.name}
                    </span>
                    {/* --- NEW: Delete button --- */}
                    <button 
                      className="danger" 
                      onClick={() => handleDeleteStop(stop.id, stop.name)}
                      style={{ padding: '0.5rem', fontSize: '0.75rem', lineHeight: 1, marginRight: '0.5rem' }}
                    >
                      🗑️
                    </button>
                    <span style={{ fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => handleAddStopToRoute(stop.id)}>
                      ➕
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* --- Right Column --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* --- MODIFIED: Map --- */}
          <div className="card" style={{ height: '400px', padding: 0, overflow: 'hidden' }}>
            <Map
              ref={mapRef} // --- ADDED REF ---
              key={theme} 
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              style={{ width: '100%', height: '100%' }}
              mapStyle={MAP_STYLE}
              mapboxAccessToken={MAPBOX_TOKEN}
              onClick={handleMapClick}
            >
              <NavigationControl position="top-left" />
              <GeocoderControl onResult={handleGeocoderResult} /> {/* --- ADDED GEOCODER --- */}
              
              {/* ... (Markers and Popup are unchanged) ... */}
              {allStops.map(stop => (
                <Marker key={stop.id} latitude={stop.lat} longitude={stop.lng} anchor="bottom">
                  <div style={{ color: 'var(--color-primary)', fontSize: '2rem', cursor: 'pointer' }}>📍</div>
                </Marker>
              ))}
              {routeStops.map((stop, index) => (
                <Marker key={stop.id} latitude={stop.lat} longitude={stop.lng} anchor="bottom">
                  <div style={{ 
                    background: 'var(--color-primary)', 
                    color: 'white',
                    fontWeight: 'bold',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    transform: 'translateY(-30px)',
                  }}>
                    {index + 1}
                  </div>
                </Marker>
              ))}
              {mapPopup && (
                <Popup
                  latitude={mapPopup.lat}
                  longitude={mapPopup.lng}
                  onClose={() => { setMapPopup(null); setNewStopName(''); }}
                  closeOnClick={false}
                  anchor="top"
                  style={{'--mapbox-popup-background-color': 'var(--bg-secondary)', '--mapbox-popup-text-color': 'var(--text-primary)'}}
                >
                  <div style={{ minWidth: '250px', padding: '0.5rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0' }}>Create New Stop</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      💡 Tip: Use the search box above to find an address, or enter a full street address below
                    </p>
                    <div className="form-group">
                      <input
                        type="text"
                        placeholder="Enter full street address (e.g., 123 Main St, City)"
                        value={newStopName}
                        onChange={(e) => setNewStopName(e.target.value)}
                      />
                    </div>
                    <button onClick={handleCreateStop} style={{ width: '100%' }}>
                      Create Stop
                    </button>
                  </div>
                </Popup>
              )}
            </Map>
          </div>

          {/* --- MODIFIED: Route Stops (Draggable List) --- */}
          <div className="card card-spacious">
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', fontWeight: '700' }}>
              3. Route Stops {selectedRouteId ? `(${routes.find(r => r.id === selectedRouteId)?.name})` : ''}
              {isSaving && <span style={{ fontSize: '1rem', marginLeft: '1rem' }}>Saving...</span>}
            </h3>
            {!selectedRouteId ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                Select a route to see its stops.
              </p>
            ) : (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={routeStops.map(s => s.routeStopId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ minHeight: '150px' }}>
                    {routeStops.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                        Add stops from the "Stop Bank" to build this route.
                      </p>
                    ) : (
                      routeStops.map((stop, index) => (
                        <SortableStopItem 
                          key={stop.routeStopId} 
                          stop={stop} 
                          index={index} 
                          onRemove={handleRemoveStopFromRoute} 
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
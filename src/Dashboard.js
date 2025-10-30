import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Link, Outlet, useLocation } from 'react-router-dom';

const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const theme = 'light';
  const location = useLocation();


  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- STYLES (No changes here) ---
  const dashboardStyle = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.3s ease',
  };
  const sidebarStyle = {
    width: isSidebarOpen ? '280px' : '0',
    backgroundColor: 'var(--bg-sidebar)',
    backdropFilter: 'blur(var(--backdrop-blur))',
    borderRight: '1px solid var(--border-color)',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    height: '100vh',
    zIndex: 10,
    flexShrink: 0,
  };
  const mainContentStyle = {
    flex: 1,
    marginLeft: isSidebarOpen ? '280px' : '0',
    transition: 'margin-left 0.3s ease',
    padding: '2.5rem 3rem',
    position: 'relative',
    minHeight: '100vh',
    maxWidth: '100%',
    overflowX: 'hidden',
  };
  const headerStyle = {
    padding: '2.5rem 2rem',
    borderBottom: '1px solid var(--border-color)',
    position: 'relative',
  };
  const navStyle = {
    padding: '1.5rem 1.25rem',
    flex: 1,
    overflowY: 'auto'
  };
  const footerStyle = {
    padding: '1.5rem 1.25rem',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    gap: '1rem',
  };
  const navLinkStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    textDecoration: 'none',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', // Use 'var(--text-primary)' for active link in dark mode
    borderRadius: 'var(--radius-lg)',
    marginBottom: '0.5rem',
    fontWeight: isActive ? '600' : '500',
    fontSize: '0.9375rem',
    backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent', // Use 'var(--bg-tertiary)' for active
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
  });
  const logoutButtonStyle = {
    width: '100%',
    backgroundColor: 'var(--color-danger)',
    color: '#ffffff',
    border: '1px solid var(--color-danger)',
    fontWeight: '600',
    boxShadow: 'none',
    flex: 1,
  };
  const toggleSidebarButtonStyle = {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    opacity: isSidebarOpen ? 1 : 0,
    zIndex: 20,
    transition: 'all 0.3s ease',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: '0.25rem',
    padding: '0.25rem',
    boxShadow: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
  };
  const openSidebarButtonStyle = {
    position: 'fixed',
    top: '0.5rem',
    left: '0.5rem',
    opacity: isSidebarOpen ? 0 : 1,
    pointerEvents: isSidebarOpen ? 'none' : 'auto',
    zIndex: 20,
    transition: 'all 0.3s ease',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: '0.25rem',
    padding: '0.25rem',
    boxShadow: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
  };
  // --- END OF STYLES ---


  // --- NEW: Function to handle link hover ---
  const handleLinkHover = (e, isActive) => {
    if (!isActive) {
      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
      e.currentTarget.style.color = 'var(--text-primary)';
    }
  };

  const handleLinkLeave = (e, isActive) => {
    if (!isActive) {
      e.currentTarget.style.backgroundColor = 'transparent';
      e.currentTarget.style.color = 'var(--text-secondary)';
    }
  };


  return (
    <div style={dashboardStyle}>
      <button 
        style={openSidebarButtonStyle}
        onClick={() => setIsSidebarOpen(true)}
        aria-label={'Open sidebar'}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        ›
      </button>

      <div style={sidebarStyle}>
        <div style={headerStyle}>
          <button 
            style={toggleSidebarButtonStyle}
            onClick={() => setIsSidebarOpen(false)}
            aria-label={'Close sidebar'}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            ‹
          </button>
          
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5rem', textAlign: 'center', fontWeight: '700' }}>Student Bus Tracker</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem', textAlign: 'center' }}>
            Admin Dashboard
          </p>
        </div>

        {/* --- NAVIGATION (MODIFIED) --- */}
        <nav style={navStyle}>
          {[
            { type: 'links', links: [ { to: '/dashboard', label: 'Dashboard', exact: true } ] },
            { type: 'divider' },
            { type: 'links', links: [
              { to: '/dashboard/students', label: 'Students' },
              { to: '/dashboard/parents', label: 'Parents' },
              { to: '/dashboard/absences', label: 'Absences' },
            ]},
            { type: 'divider' },
            { type: 'links', links: [
              { to: '/dashboard/drivers', label: 'Drivers' },
              { to: '/dashboard/buses', label: 'Buses' },
              { to: '/dashboard/routes', label: 'Routes' },
            ]},
            { type: 'divider', heading: 'Management' },
            { type: 'links', links: [
              { to: '/dashboard/reports', label: 'Reports' },
              { to: '/dashboard/checklists', label: 'Checklists' },
            ]},
          ].map((section, idx) => {
            if (section.type === 'divider') {
              return (
                <div key={`divider-${idx}`} style={{
                  margin: '0.75rem 0 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                  {section.heading && (
                    <div style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase'
                    }}>
                      {section.heading}
                    </div>
                  )}
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                </div>
              );
            }

            // links section
            return section.links.map((link) => {
              const isActive = link.exact 
                ? location.pathname === link.to 
                : location.pathname.startsWith(link.to);
              
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={navLinkStyle(isActive)}
                  onMouseEnter={(e) => handleLinkHover(e, isActive)}
                  onMouseLeave={(e) => handleLinkLeave(e, isActive)}
                >
                  {link.label}
                </Link>
              );
            });
          })}
        </nav>
        {/* --- END OF NAVIGATION --- */}

        <div style={footerStyle}>
          <button onClick={handleLogout} style={logoutButtonStyle} className="danger">
            Sign Out
          </button>
        </div>
      </div>

      <main style={mainContentStyle}>
        <Outlet context={{ theme: theme }} />
      </main>
    </div>
  );
}

export default Dashboard;

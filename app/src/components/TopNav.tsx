import { NavLink } from 'react-router-dom'

const linkStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'inherit',
}

export function TopNav() {
  return (
    <nav
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 12,
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <NavLink
        to="/"
        end
        style={({ isActive }) => ({
          ...linkStyle,
          fontWeight: isActive ? 700 : 500,
          background: isActive ? '#f3f4f6' : 'transparent',
        })}
      >
        Daily
      </NavLink>
      <NavLink
        to="/overview"
        style={({ isActive }) => ({
          ...linkStyle,
          fontWeight: isActive ? 700 : 500,
          background: isActive ? '#f3f4f6' : 'transparent',
        })}
      >
        Overview
      </NavLink>
      <NavLink
        to="/archive"
        style={({ isActive }) => ({
          ...linkStyle,
          fontWeight: isActive ? 700 : 500,
          background: isActive ? '#f3f4f6' : 'transparent',
        })}
      >
        Archive
      </NavLink>
    </nav>
  )
}

export default TopNav

// components/Sidebar.tsx
import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside style={{
      width: '200px',
      height: '100vh',
      padding: '1rem',
      backgroundColor: '#f3f3f3',
      borderRight: '1px solid #ccc',
      position: 'fixed'
    }}>
      <nav>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li><Link href="/dashboard">Dashboard</Link></li>
          <li><Link href="/clients">Clients</Link></li>
        </ul>
      </nav>
    </aside>
  )
}

import type { AppProps } from 'next/app'
import '../styles/globals.css'
import Sidebar from '../components/Sidebar'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ marginLeft: '200px', padding: '2rem', width: '100%' }}>
        <Component {...pageProps} />
      </div>
    </div>
  )
}

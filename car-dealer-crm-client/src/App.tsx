import './App.css'
import { AuthProvider } from './modules/auth/AuthProvider'
import { AppRoutes } from './modules/router/AppRoutes'

function App() {

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App

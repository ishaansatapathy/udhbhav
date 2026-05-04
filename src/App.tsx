import { BrowserRouter, Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import WalletPage from "./pages/WalletPage"
import CabPage from "./pages/CabPage"
import PoliceDashboard from "./pages/PoliceDashboard"
import PersonalEmergency from "./pages/PersonalEmergency"
import DisasterDashboard from "./pages/DisasterDashboard"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/cab" element={<CabPage />} />
        <Route path="/police" element={<PoliceDashboard />} />
        <Route path="/emergency" element={<PersonalEmergency />} />
        <Route path="/disaster" element={<DisasterDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

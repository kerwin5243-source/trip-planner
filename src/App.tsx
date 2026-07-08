import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { silentSync } from './lib/sync';
import AccountPage from './pages/AccountPage';
import ExpensesPage from './pages/ExpensesPage';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import ItineraryPage from './pages/ItineraryPage';
import NewTripPage from './pages/NewTripPage';
import PackingPage from './pages/PackingPage';
import SouvenirPage from './pages/SouvenirPage';
import TransportationPage from './pages/TransportationPage';
import TripDetailPage from './pages/TripDetailPage';

export default function App() {
  // 開啟 App 時安靜地同步一次（未登入或有衝突就跳過）
  useEffect(() => {
    silentSync();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/new" element={<NewTripPage />} />
        <Route path="/trip/:id/edit" element={<NewTripPage />} />
        <Route path="/trip/:id" element={<TripDetailPage />} />
        <Route path="/trip/:id/itinerary" element={<ItineraryPage />} />
        <Route path="/trip/:id/expenses" element={<ExpensesPage />} />
        <Route path="/trip/:id/packing" element={<PackingPage />} />
        <Route path="/trip/:id/souvenir" element={<SouvenirPage />} />
        <Route path="/trip/:id/transportation" element={<TransportationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

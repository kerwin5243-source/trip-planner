import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ExpensesPage from './pages/ExpensesPage';
import HomePage from './pages/HomePage';
import ItineraryPage from './pages/ItineraryPage';
import NewTripPage from './pages/NewTripPage';
import PackingPage from './pages/PackingPage';
import SouvenirPage from './pages/SouvenirPage';
import TripDetailPage from './pages/TripDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<NewTripPage />} />
        <Route path="/trip/:id" element={<TripDetailPage />} />
        <Route path="/trip/:id/itinerary" element={<ItineraryPage />} />
        <Route path="/trip/:id/expenses" element={<ExpensesPage />} />
        <Route path="/trip/:id/packing" element={<PackingPage />} />
        <Route path="/trip/:id/souvenir" element={<SouvenirPage />} />
      </Routes>
    </BrowserRouter>
  );
}

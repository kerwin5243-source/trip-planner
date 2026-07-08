import { NavLink } from 'react-router-dom';

/** 底部導覽列（毛玻璃），只出現在最上層頁面 */
export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🧳</span>
        <span>旅程</span>
      </NavLink>
      <NavLink to="/map" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🗺️</span>
        <span>世界地圖</span>
      </NavLink>
    </nav>
  );
}

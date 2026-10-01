"use client";

import { useState } from "react";
import { LayoutDashboard, Target, Users, Settings, PieChart, Menu, X } from "lucide-react";

export function CrmSidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <button 
        className="crm-sidebar-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: '20px',
          left: isOpen ? '240px' : '20px',
          zIndex: 50,
          background: 'rgba(11, 11, 12, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          padding: '8px',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'left 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`crm-sidebar ${isOpen ? 'is-open' : 'is-closed'}`} style={{
        width: isOpen ? '280px' : '0px',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="crm-sidebar__brand">
          <Target size={28} />
          <span>Q-Max CRM</span>
        </div>

        <nav className="crm-nav">
          <a href="/crm" className="crm-nav__item is-active">
            <LayoutDashboard size={18} />
            Pipelines
          </a>
          <a href="#" className="crm-nav__item">
            <Users size={18} />
            Contatos
          </a>
          <a href="#" className="crm-nav__item">
            <PieChart size={18} />
            Relatórios
          </a>
          <a href="#" className="crm-nav__item" style={{ marginTop: "auto" }}>
            <Settings size={18} />
            Configurações
          </a>
        </nav>
      </aside>
    </>
  );
}

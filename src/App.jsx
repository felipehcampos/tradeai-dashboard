import { useState } from "react"
import Mercado from "./pages/Mercado"
import Portfolio from "./pages/Portfolio"
import Alertas from "./pages/Alertas"
import IAAnalise from "./pages/IAAnalise"
import Login from "./Login"

const ABAS = [
  { id: "mercado",   label: "Mercado",   icon: "🌎" },
  { id: "portfolio", label: "Portfólio", icon: "💼" },
  { id: "alertas",   label: "Alertas",   icon: "🔔" },
  { id: "ia",        label: "IA Análise",icon: "🤖" },
]

export default function App() {
  const [logado, setLogado] = useState(false)
  const [aba, setAba] = useState("mercado")

  if (!logado) return <Login onLogin={() => setLogado(true)} />

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060d1a",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column"
    }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        background: "rgba(15,23,42,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(56,189,248,0.12)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "60px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)"
      }}>

        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginRight: "32px",
          cursor: "default"
        }}>
          <div style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg,#38bdf8,#0ea5e9)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            boxShadow: "0 2px 8px rgba(56,189,248,0.4)"
          }}>📈</div>
          <span style={{
            color: "#f1f5f9",
            fontWeight: "800",
            fontSize: "18px",
            letterSpacing: "-0.5px"
          }}>Trade<span style={{color:"#38bdf8"}}>AI</span></span>
        </div>

        {/* Abas */}
        <div style={{display:"flex",gap:"4px",flex:1}}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: aba === a.id ? "700" : "500",
              background: aba === a.id
                ? "linear-gradient(135deg,rgba(56,189,248,0.2),rgba(14,165,233,0.15))"
                : "transparent",
              color: aba === a.id ? "#38bdf8" : "#64748b",
              borderBottom: aba === a.id ? "2px solid #38bdf8" : "2px solid transparent",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap"
            }}
            onMouseEnter={e => {
              if (aba !== a.id) e.currentTarget.style.color = "#94a3b8"
            }}
            onMouseLeave={e => {
              if (aba !== a.id) e.currentTarget.style.color = "#64748b"
            }}>
              <span style={{fontSize:"14px"}}>{a.icon}</span>
              <span style={{
                display: "none"
              }} className="tab-label">{a.label}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Status online */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "#64748b",
          fontSize: "12px",
          marginLeft: "auto"
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 6px #22c55e",
            animation: "pulse 2s infinite"
          }}/>
          <span style={{display:"none"}} id="status-text">Sistema Online</span>
        </div>
      </nav>

      {/* ── CONTEÚDO ── */}
      <main style={{
        flex: 1,
        padding: "24px",
        maxWidth: "1600px",
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box"
      }}>
        {aba === "mercado"   && <Mercado />}
        {aba === "portfolio" && <Portfolio />}
        {aba === "alertas"   && <Alertas />}
        {aba === "ia"        && <IAAnalise />}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid rgba(56,189,248,0.08)",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "#334155",
        fontSize: "11px"
      }}>
        <span>TradeAI © 2026 — Uso pessoal e privado</span>
        <span>Não constitui recomendação financeira</span>
      </footer>

      {/* ── CSS GLOBAL ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
          background: #060d1a !important; 
          scrollbar-width: thin;
          scrollbar-color: #1e293b #060d1a;
        }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #060d1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Responsivo mobile */
        @media (max-width: 768px) {
          main { padding: 12px !important; }
          nav { padding: 0 12px !important; }
          nav button span:last-child { display: none !important; }
          nav button { padding: 8px 12px !important; }
          table { font-size: 12px !important; }
          td, th { padding: 8px 6px !important; }
        }

        @media (max-width: 480px) {
          nav button { padding: 6px 8px !important; font-size: 11px !important; }
          h2 { font-size: 16px !important; }
        }
      `}</style>
    </div>
  )
}
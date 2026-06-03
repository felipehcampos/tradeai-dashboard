import { useState } from "react"
import Mercado from "./pages/Mercado"
import Portfolio from "./pages/Portfolio"
import Alertas from "./pages/Alertas"
import IAAnalise from "./pages/IAAnalise"
import Login from "./Login"

const ABAS = [
  { id: "mercado",   label: "Mercado",    icon: "🌎" },
  { id: "portfolio", label: "Portfólio",  icon: "💼" },
  { id: "alertas",   label: "Alertas",    icon: "🔔" },
  { id: "ia",        label: "IA Análise", icon: "🤖" },
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
      flexDirection: "column",
      width: "100%",
    }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        background: "rgba(6,13,26,0.98)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(56,189,248,0.1)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "60px",
        boxShadow: "0 2px 20px rgba(0,0,0,0.5)",
        width: "100%",
      }}>

        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center",
          gap: "10px", marginRight: "40px", cursor: "default", flexShrink: 0
        }}>
          <div style={{
            width: "34px", height: "34px",
            background: "linear-gradient(135deg,#38bdf8,#0284c7)",
            borderRadius: "8px", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "18px",
            boxShadow: "0 0 12px rgba(56,189,248,0.4)"
          }}>📈</div>
          <span style={{ color: "#f1f5f9", fontWeight: "800", fontSize: "19px", letterSpacing: "-0.5px" }}>
            Trade<span style={{ color: "#38bdf8" }}>AI</span>
          </span>
        </div>

        {/* Abas */}
        <div style={{ display: "flex", gap: "2px", flex: 1 }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{
              padding: "8px 20px",
              border: "none",
              borderBottom: aba === a.id ? "2px solid #38bdf8" : "2px solid transparent",
              borderRadius: "0",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: aba === a.id ? "700" : "400",
              background: "transparent",
              color: aba === a.id ? "#38bdf8" : "#64748b",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px",
              whiteSpace: "nowrap", height: "60px",
            }}
            onMouseEnter={e => { if (aba !== a.id) e.currentTarget.style.color = "#94a3b8" }}
            onMouseLeave={e => { if (aba !== a.id) e.currentTarget.style.color = "#64748b" }}>
              <span>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Status online */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#22c55e", boxShadow: "0 0 8px #22c55e"
          }}/>
          <span style={{ color: "#64748b", fontSize: "12px" }}>Online</span>
        </div>
      </nav>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main style={{
        flex: 1,
        padding: "28px 32px",
        width: "100%",
        boxSizing: "border-box",
      }}>
        {aba === "mercado"   && <Mercado />}
        {aba === "portfolio" && <Portfolio />}
        {aba === "alertas"   && <Alertas />}
        {aba === "ia"        && <IAAnalise />}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid rgba(56,189,248,0.06)",
        padding: "10px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "#334155",
        fontSize: "11px",
        background: "rgba(6,13,26,0.8)"
      }}>
        <span>TradeAI © 2026 — Uso pessoal e privado</span>
        <span>Não constitui recomendação financeira</span>
      </footer>

      {/* ── CSS GLOBAL ── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          width: 100%;
          overflow-x: hidden;
          background: #060d1a !important;
          scrollbar-width: thin;
          scrollbar-color: #1e293b #060d1a;
        }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #060d1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
          50% { opacity: 0.5; box-shadow: 0 0 3px #22c55e; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ── RESPONSIVO MOBILE ── */
        @media (max-width: 768px) {
          main { padding: 12px 14px !important; }
          nav { padding: 0 14px !important; }
          nav span { font-size: 12px !important; }
        }

        @media (max-width: 480px) {
          nav button span:last-child { display: none !important; }
          nav button { padding: 8px 10px !important; }
          h2 { font-size: 17px !important; }
        }
      `}</style>
    </div>
  )
}
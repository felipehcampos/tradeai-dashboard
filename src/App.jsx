import { useState } from "react"
import Mercado from "./pages/Mercado"
import Portfolio from "./pages/Portfolio"
import Favoritos from "./pages/Favoritos"
import Noticias from "./pages/Noticias"
import Login from "./Login"
import { tokenAindaValido, apagarToken } from "./services/api"
import Financeiro from "./pages/Financeiro"
import ScannerB from "./pages/ScannerB"

// 10/11/2026: visual "Future Intelligence" (cabeçalho, abas em pílula, moldura com luz).
// Só aparência — as abas e o que cada uma faz continuam iguais.
// 10/11/2026: abas Alertas e IA Análise retiradas a pedido do Felipe (não usava). Os arquivos ficam na pasta pages.
const ABAS = [
  { id: "mercado",    label: "Mercado" },
  { id: "scannerb",   label: "Scanner B" },
  { id: "portfolio",  label: "Portfólio" },
  { id: "financeiro", label: "Financeiro" },
  { id: "favoritos",  label: "Favoritos" },
  { id: "noticias",   label: "Notícias" },
]

// Filetes de luz nas bordas da moldura (posição, cor)
const LUZES = [
  { top: -2, left: "8%",  w: "18%", h: 2, cor: "56,189,248" },
  { top: -2, right: "10%", w: "12%", h: 2, cor: "37,99,235" },
  { bottom: -2, left: "22%", w: "16%", h: 2, cor: "37,99,235" },
  { bottom: -2, right: "18%", w: "14%", h: 2, cor: "34,211,160" },
  { left: -2, top: "6%", w: 2, h: "14%", cor: "56,189,248" },
  { right: -2, top: "30%", w: 2, h: "12%", cor: "34,211,160" },
]

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <defs>
        <linearGradient id="fiLogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#22D3A0" />
        </linearGradient>
      </defs>
      <circle cx="17" cy="17" r="15" fill="none" stroke="url(#fiLogo)" strokeWidth="1.6" />
      <path d="M9 21 L14 15 L18 18 L25 10" fill="none" stroke="url(#fiLogo)" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  const [logado, setLogado] = useState(() => tokenAindaValido())   // 09/11/2026: passe de 30 dias
  const [aba, setAba] = useState("mercado")

  if (!logado) return <Login onLogin={() => setLogado(true)} />

  const sair = () => { apagarToken(); setLogado(false) }

  return (
    <div style={{ minHeight: "100vh", color: "var(--fi-texto)", display: "flex", flexDirection: "column", width: "100%" }}>

      {/* ── CABEÇALHO ── */}
      <header className="fi-cabecalho" style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", gap: "20px",
        padding: "12px 28px",
        background: "rgba(4,7,13,0.82)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--fi-borda)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <Logo />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span className="fi-titulo" style={{ fontWeight: 700, fontSize: "19px" }}>TradeAI</span>
            <span className="fi-sub" style={{ fontSize: "9.5px", letterSpacing: "2.4px", color: "var(--fi-texto-4)", textTransform: "uppercase" }}>
              Quantitative Intelligence Terminal
            </span>
          </div>
          <span className="fi-live" style={{
            display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "4px",
            padding: "3px 9px", borderRadius: "999px",
            border: "1px solid rgba(34,211,160,0.35)", background: "rgba(34,211,160,0.08)",
            color: "var(--fi-verde)", fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fi-verde)", animation: "fiPulso 2s infinite" }} />
            LIVE
          </span>
        </div>

        <nav aria-label="Abas" className="fi-abas" style={{ display: "flex", gap: "2px", flex: 1, justifyContent: "center", overflowX: "auto" }}>
          {ABAS.map(a => {
            const ativa = aba === a.id
            return (
              <button key={a.id} type="button" onClick={() => setAba(a.id)} aria-current={ativa ? "page" : undefined}
                className={ativa ? "fi-aba fi-aba-ativa" : "fi-aba"}
                style={{
                  padding: "7px 14px", borderRadius: "999px", border: "none", cursor: "pointer",
                  fontSize: "13px", fontWeight: ativa ? 600 : 400, whiteSpace: "nowrap",
                  background: ativa ? "rgba(56,189,248,0.14)" : "transparent",
                  color: ativa ? "var(--fi-texto)" : "var(--fi-texto-3)",
                  boxShadow: ativa ? "0 0 0 1px rgba(56,189,248,0.35), 0 0 16px rgba(56,189,248,0.25)" : "none",
                  transition: "all 0.2s",
                }}>
                {a.label}
              </button>
            )
          })}
        </nav>

        <button type="button" onClick={sair} style={{
          height: "34px", padding: "0 14px", borderRadius: "999px", flexShrink: 0,
          border: "1px solid var(--fi-borda-forte)", background: "transparent",
          color: "var(--fi-texto-3)", fontSize: "12px", cursor: "pointer",
        }}>
          Sair
        </button>
      </header>

      {/* ── MOLDURA COM LUZ + CONTEÚDO ── */}
      <main style={{ flex: 1, width: "100%", boxSizing: "border-box", padding: "24px 20px 32px" }}>
        <div style={{ position: "relative", maxWidth: "1600px", margin: "0 auto" }}>
          {LUZES.map((l, i) => (
            <div key={i} aria-hidden="true" style={{
              position: "absolute", top: l.top, bottom: l.bottom, left: l.left, right: l.right,
              width: l.w, height: l.h, borderRadius: 2, zIndex: 1,
              background: `rgb(${l.cor})`, boxShadow: `0 0 18px 3px rgba(${l.cor},0.75)`,
            }} />
          ))}
          <div className="fi-moldura" style={{
            position: "relative", borderRadius: "20px", border: "1px solid var(--fi-borda)",
            background: "linear-gradient(180deg, rgba(10,18,32,0.94), rgba(6,11,20,0.97))",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)",
            padding: "24px",
          }}>
            {aba === "mercado"    && <Mercado />}
            {aba === "portfolio"  && <Portfolio />}
            {aba === "financeiro" && <Financeiro />}
            {aba === "favoritos"  && <Favoritos />}
            {aba === "scannerb"   && <ScannerB />}
            {aba === "noticias"   && <Noticias />}
          </div>
        </div>
      </main>

      {/* ── RODAPÉ ── */}
      <footer style={{
        padding: "10px 28px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
        color: "#5F7391", fontSize: "11px",
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
          scrollbar-width: thin;
          scrollbar-color: #1E3352 #04070D;
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #04070D; }
        ::-webkit-scrollbar-thumb { background: #1E3352; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2A4468; }

        .fi-abas { scrollbar-width: none; }
        .fi-abas::-webkit-scrollbar { display: none; }
        .fi-aba:not(.fi-aba-ativa):hover { color: var(--fi-texto) !important; background: rgba(56,189,248,0.06) !important; }

        @keyframes fiPulso {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #22D3A0; }
          50% { opacity: 0.45; box-shadow: 0 0 2px #22D3A0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
          50% { opacity: 0.5; box-shadow: 0 0 3px #22c55e; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1100px) {
          .fi-sub, .fi-live { display: none !important; }
        }
        @media (max-width: 768px) {
          .fi-cabecalho { flex-wrap: wrap; padding: 10px 14px !important; gap: 10px !important; }
          .fi-abas { order: 3; flex-basis: 100%; justify-content: flex-start !important; }
          main { padding: 12px 8px 20px !important; }
          .fi-moldura { padding: 14px !important; border-radius: 14px !important; }
        }
        @media (max-width: 480px) {
          h2 { font-size: 17px !important; }
        }
      `}</style>
    </div>
  )
}

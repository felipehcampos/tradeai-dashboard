import { useState } from "react"
import Mercado from "./pages/Mercado"
import Portfolio from "./pages/Portfolio"
import Alertas from "./pages/Alertas"
import IAAnalise from "./pages/IAAnalise"
import Login from "./Login"

export default function App() {
  const [logado, setLogado] = useState(false)
  const [aba, setAba] = useState("mercado")

  if (!logado) {
    return <Login onLogin={() => setLogado(true)} />
  }

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9",fontFamily:"sans-serif"}}>
      <nav style={{background:"#1e293b",padding:"12px 24px",display:"flex",gap:"8px",borderBottom:"1px solid #334155"}}>
        <span style={{color:"#38bdf8",fontWeight:"bold",marginRight:"24px",fontSize:"18px"}}>📈 TradeAI</span>
        {["mercado","portfolio","alertas","ia"].map(a => (
          <button key={a} onClick={() => setAba(a)}
            style={{padding:"8px 16px",borderRadius:"8px",border:"none",cursor:"pointer",
              background: aba===a ? "#38bdf8" : "#334155",
              color: aba===a ? "#0f172a" : "#94a3b8",fontWeight:"bold"}}>
            {a==="mercado"?"🌎 Mercado":a==="portfolio"?"💼 Portfólio":a==="alertas"?"🔔 Alertas":"🤖 IA Análise"}
          </button>
        ))}
      </nav>
      <main style={{padding:"24px"}}>
        {aba==="mercado" && <Mercado />}
        {aba==="portfolio" && <Portfolio />}
        {aba==="alertas" && <Alertas />}
        {aba==="ia" && <IAAnalise />}
      </main>
    </div>
  )
}
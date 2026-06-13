import { useState } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

export default function IAAnalise() {
  const [pergunta, setPergunta] = useState("")
  const [resposta, setResposta] = useState("")
  const [loading, setLoading] = useState(false)

  // Aceita um parâmetro opcional para disparar direto dos botões rápidos
  const perguntar = async (textoOpcional = null) => {
    const textoFinal = textoOpcional || pergunta
    if (!textoFinal.trim()) return

    setLoading(true)
    setResposta("")
    try {
      const r = await api.post(`${API}/chat`, { pergunta: textoFinal })
      
      // Validação rigorosa do status de sucesso enviado pelo backend
      if (r.data.sucesso) {
        setResposta(r.data.resposta)
      } else {
        setResposta(`⚠️ Erro na análise do servidor: ${r.data.erro}`)
      }
    } catch {
      setResposta("⚠️ Erro crítico ao conectar com o servidor TradeAI.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{color:"#38bdf8",marginBottom:"16px"}}>🤖 IA Análise</h2>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
        <input value={pergunta} onChange={e => setPergunta(e.target.value)}
          onKeyDown={e => e.key==="Enter" && perguntar()}
          placeholder="Pergunte sobre o mercado... ex: Analise VALE3"
          style={{flex:1,padding:"12px",borderRadius:"8px",border:"1px solid #334155",
            background:"#1e293b",color:"#f1f5f9",fontSize:"14px"}} />
        <button onClick={() => perguntar()} disabled={loading}
          style={{padding:"12px 24px",borderRadius:"8px",border:"none",cursor:"pointer",
            background:"#38bdf8",color:"#0f172a",fontWeight:"bold"}}>
          {loading ? "..." : "Enviar"}
        </button>
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        {["Analise PETR4","Analise VALE3","Analise TSLA","Sentimento B3"].map(q => (
          <button key={q} onClick={() => { setPergunta(q); perguntar(q); }} // ◄ DISPARA AUTOMÁTICO
            style={{padding:"8px 12px",borderRadius:"6px",border:"1px solid #334155",
              background:"#1e293b",color:"#94a3b8",cursor:"pointer",fontSize:"12px"}}>
            {q}
          </button>
        ))}
      </div>
      {resposta && (
        <div style={{background:"#1e293b",padding:"16px",borderRadius:"8px",
          borderLeft:"4px solid #38bdf8",lineHeight:"1.6",whiteSpace:"pre-wrap"}}>
          {resposta
            .replace(/#{1,3} /g, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/---/g, "──────────────")
            .split("\n").map((linha, i) => (
              <p key={i} style={{margin:"4px 0"}}>{linha}</p>
            ))
          }
        </div>
      )}
    </div>
  )
}
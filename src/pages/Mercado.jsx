import { useState, useEffect } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL

export default function Mercado() {
  const [sinais, setSinais] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/sinais`)
      .then(r => setSinais(r.data.dados || []))
      .catch(() => setSinais([]))
      .finally(() => setLoading(false))
  }, [])

  const moeda = (s) => {
    if (s.mercado === "B3") return "R$"
    if (s.mercado === "CRYPTO") return "US$"
    if (s.mercado === "COMMODITY") return "US$"
    return "US$"
  }

  return (
    <div>
      <h2 style={{color:"#38bdf8",marginBottom:"16px"}}>🌎 Sinais do Mercado</h2>
      {loading ? <p>Carregando...</p> : (
        sinais.length === 0 ? <p style={{color:"#94a3b8"}}>Nenhum sinal gerado hoje. O scanner roda às 18h.</p> : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#1e293b"}}>
                {["Ticker","Nome","Mercado","Sinal","Confiança","Preço","Alvo","Stop","Sentimento"].map(h => (
                  <th key={h} style={{padding:"12px",textAlign:"left",color:"#94a3b8",borderBottom:"1px solid #334155"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sinais.map((s,i) => (
                <tr key={i} style={{borderBottom:"1px solid #1e293b"}}>
                  <td style={{padding:"12px",fontWeight:"bold",color:"#38bdf8"}}>{s.ticker}</td>
                  <td style={{padding:"12px"}}>{s.nome}</td>
                  <td style={{padding:"12px",color:"#94a3b8",fontSize:"12px"}}>{s.mercado}</td>
                  <td style={{padding:"12px"}}>
                    <span style={{padding:"4px 8px",borderRadius:"4px",
                      background:s.sinal==="COMPRAR"?"#16a34a":s.sinal==="MANTER"?"#d97706":"#dc2626",
                      color:"white",fontSize:"12px",fontWeight:"bold"}}>{s.sinal}</span>
                  </td>
                  <td style={{padding:"12px"}}>{s.confianca}%</td>
                  <td style={{padding:"12px"}}>{moeda(s)} {s.preco_atual}</td>
                  <td style={{padding:"12px",color:"#4ade80"}}>{moeda(s)} {s.alvo_lucro}</td>
                  <td style={{padding:"12px",color:"#f87171"}}>{moeda(s)} {s.stop_loss}</td>
                  <td style={{padding:"12px"}}>{s.score_sentimento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}
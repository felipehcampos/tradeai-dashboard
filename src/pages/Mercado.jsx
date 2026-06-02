import { useState, useEffect } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL

export default function Mercado() {
  const [sinais, setSinais] = useState([])
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)

  const carregarSinais = () => {
    setLoading(true)
    axios.get(`${API}/sinais`)
      .then(r => setSinais(r.data.dados || []))
      .catch(() => setSinais([]))
      .finally(() => {
        setLoading(false)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      })
  }

  useEffect(() => { carregarSinais() }, [])

  const rodarScanner = async () => {
    setRodando(true)
    try {
      await axios.post(`${API}/rodar-scanner`)
      await carregarSinais()
    } catch {
      alert("Erro ao rodar o scanner.")
    } finally {
      setRodando(false)
    }
  }

  const adicionarPortfolio = (s) => {
    const salvo = JSON.parse(localStorage.getItem("tradeai_portfolio") || "[]")
    const jaExiste = salvo.find(p => p.ticker === s.ticker)
    if (jaExiste) {
      alert(`${s.ticker} já está no portfólio!`)
      return
    }
    const nova = {
      ticker: s.ticker,
      nome: s.nome,
      mercado: s.mercado,
      quantidade: 1,
      preco_entrada: s.preco_atual,
      preco_atual: s.preco_atual,
      data: new Date().toLocaleDateString("pt-BR")
    }
    localStorage.setItem("tradeai_portfolio", JSON.stringify([...salvo, nova]))
    alert(`${s.ticker} adicionado ao portfólio! Ajuste a quantidade na aba Portfólio.`)
  }

  const moeda = (s) => {
    if (s.mercado === "B3") return "R$"
    return "US$"
  }

  const formatarData = (data) => {
    if (!data) return ""
    return new Date(data).toLocaleDateString("pt-BR", {
      day:"2-digit", month:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    })
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"8px"}}>
        <h2 style={{color:"#38bdf8",margin:0}}>🌎 Sinais do Mercado</h2>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {ultimaAtualizacao && (
            <span style={{color:"#94a3b8",fontSize:"12px"}}>Atualizado às {ultimaAtualizacao}</span>
          )}
          <button onClick={carregarSinais} disabled={loading}
            style={{padding:"8px 16px",borderRadius:"8px",border:"1px solid #334155",
              cursor:"pointer",background:"#1e293b",color:"#94a3b8",fontSize:"13px"}}>
            {loading ? "⏳ Carregando..." : "🔄 Atualizar"}
          </button>
          <button onClick={rodarScanner} disabled={rodando}
            style={{padding:"8px 16px",borderRadius:"8px",border:"none",
              cursor:"pointer",background: rodando ? "#334155" : "#38bdf8",
              color: rodando ? "#94a3b8" : "#0f172a",fontWeight:"bold",fontSize:"13px"}}>
            {rodando ? "⏳ Analisando mercado..." : "🚀 Rodar Scanner Agora"}
          </button>
        </div>
      </div>

      {rodando && (
        <div style={{background:"#1e293b",padding:"12px 16px",borderRadius:"8px",
          marginBottom:"16px",borderLeft:"4px solid #38bdf8",color:"#94a3b8",fontSize:"13px"}}>
          ⏳ O scanner está analisando o mercado... Isso pode levar alguns minutos. Aguarde.
        </div>
      )}

      {loading ? <p style={{color:"#94a3b8"}}>Carregando...</p> : (
        sinais.length === 0 ? (
          <p style={{color:"#94a3b8"}}>Nenhum sinal gerado ainda. Clique em "Rodar Scanner Agora" ou aguarde às 18h.</p>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#1e293b"}}>
                {["Ticker","Nome","Mercado","Sinal","Confiança","Preço","Alvo","Stop","Sentimento","Data","Ação"].map(h => (
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
                  <td style={{padding:"12px",color:"#94a3b8",fontSize:"12px"}}>{formatarData(s.criado_em)}</td>
                  <td style={{padding:"12px"}}>
                    <button onClick={() => adicionarPortfolio(s)}
                      style={{padding:"4px 10px",borderRadius:"4px",border:"none",cursor:"pointer",
                        background:"#16a34a",color:"white",fontSize:"12px",fontWeight:"bold"}}>
                      + Portfólio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}
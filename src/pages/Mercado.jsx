import { useState, useEffect } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL

export default function Mercado() {
  const [sinais, setSinais] = useState([])
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [filtroMercado, setFiltroMercado] = useState("TODOS")

  const carregarSinais = () => {
    setLoading(true)
    axios.get(`${API}/sinais`)
      .then(r => {
        const dados = r.data.dados || []
        const filtrados = dados.filter(s => s.sinal !== "EVITAR")
        filtrados.sort((a, b) => {
          if (a.sinal === "COMPRAR" && b.sinal !== "COMPRAR") return -1
          if (a.sinal !== "COMPRAR" && b.sinal === "COMPRAR") return 1
          return b.confianca - a.confianca
        })
        setSinais(filtrados)
      })
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
    if (jaExiste) { alert(`${s.ticker} já está no portfólio!`); return }
    const nova = {
      ticker: s.ticker, nome: s.nome, mercado: s.mercado,
      quantidade: 1, preco_entrada: parseFloat(s.preco_atual),
      preco_atual: parseFloat(s.preco_atual),
      data: new Date().toLocaleDateString("pt-BR")
    }
    localStorage.setItem("tradeai_portfolio", JSON.stringify([...salvo, nova]))
    alert(`${s.ticker} adicionado ao portfólio! Ajuste a quantidade na aba Portfólio.`)
  }

  const moeda = (s) => s.mercado === "B3" ? "R$" : "US$"

  const formatarData = (data) => {
    if (!data) return ""
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const formatarPreco = (valor) => {
    if (!valor) return "—"
    return parseFloat(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })
  }

  const mercados = ["TODOS", "B3", "NASDAQ", "NYSE", "CRYPTO", "COMMODITY"]
  const sinaisFiltrados = filtroMercado === "TODOS" ? sinais : sinais.filter(s => s.mercado === filtroMercado)
  const totalComprar = sinais.filter(s => s.sinal === "COMPRAR").length
  const totalManter = sinais.filter(s => s.sinal === "MANTER").length

  return (
    <div style={{ width: "100%" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px", flexWrap: "wrap", gap: "12px"
      }}>
        <div>
          <h2 style={{ color: "#38bdf8", margin: "0 0 4px 0", fontSize: "22px", fontWeight: "800" }}>
            🌎 Sinais do Mercado
          </h2>
          {ultimaAtualizacao && (
            <span style={{ color: "#64748b", fontSize: "12px" }}>Atualizado às {ultimaAtualizacao}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={carregarSinais} disabled={loading} style={{
            padding: "9px 18px", borderRadius: "8px", border: "1px solid #334155",
            cursor: "pointer", background: "#1e293b", color: "#94a3b8", fontSize: "13px"
          }}>
            {loading ? "⏳" : "🔄"} Atualizar
          </button>
          <button onClick={rodarScanner} disabled={rodando} style={{
            padding: "9px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
            background: rodando ? "#334155" : "linear-gradient(135deg,#38bdf8,#0ea5e9)",
            color: rodando ? "#94a3b8" : "#0f172a", fontWeight: "bold", fontSize: "13px",
            boxShadow: rodando ? "none" : "0 2px 8px rgba(56,189,248,0.3)"
          }}>
            {rodando ? "⏳ Analisando..." : "🚀 Rodar Scanner"}
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          { label: "🟢 Comprar", valor: totalComprar, cor: "#22c55e", bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.3)" },
          { label: "🟡 Manter", valor: totalManter, cor: "#f59e0b", bg: "rgba(217,119,6,0.1)", border: "rgba(217,119,6,0.3)" },
          { label: "📊 Total Analisados", valor: sinais.length, cor: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.3)" },
        ].map((card, i) => (
          <div key={i} style={{
            background: card.bg, border: `1px solid ${card.border}`,
            padding: "16px 24px", borderRadius: "12px", flex: 1, minWidth: "140px", textAlign: "center"
          }}>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 6px 0", fontWeight: "500" }}>{card.label}</p>
            <p style={{ color: card.cor, fontSize: "28px", fontWeight: "800", margin: 0 }}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Banner rodando */}
      {rodando && (
        <div style={{
          background: "rgba(56,189,248,0.08)", padding: "12px 16px", borderRadius: "8px",
          marginBottom: "16px", borderLeft: "3px solid #38bdf8", color: "#94a3b8", fontSize: "13px"
        }}>
          ⏳ O scanner está varrendo o mercado global com 100+ ativos... Aguarde alguns minutos.
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {mercados.map(m => (
          <button key={m} onClick={() => setFiltroMercado(m)} style={{
            padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontSize: "12px", fontWeight: filtroMercado === m ? "700" : "400",
            background: filtroMercado === m ? "#38bdf8" : "#1e293b",
            color: filtroMercado === m ? "#0f172a" : "#64748b",
            transition: "all 0.2s"
          }}>
            {m}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</p>
          <p>Carregando sinais...</p>
        </div>
      ) : sinaisFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <p style={{ fontSize: "48px", marginBottom: "12px" }}>📭</p>
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>Nenhum sinal disponível</p>
          <p style={{ fontSize: "13px" }}>Clique em "Rodar Scanner" ou aguarde às 18h</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #1e293b", width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#0a1520" }}>
                {["Ticker", "Nome", "Mercado", "Sinal", "Confiança", "Preço", "Alvo", "Stop", "Sentimento", "Data", "Ação"].map(h => (
                  <th key={h} style={{
                    padding: "14px 10px", textAlign: "left", color: "#64748b",
                    fontSize: "11px", fontWeight: "700", letterSpacing: "0.06em",
                    borderBottom: "1px solid #1e293b", whiteSpace: "nowrap"
                  }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sinaisFiltrados.map((s, i) => (
                <tr key={i}
                  style={{
                    borderBottom: "1px solid #0f172a",
                    background: i % 2 === 0 ? "#0d1829" : "#0a1520",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#0d1829" : "#0a1520"}
                >
                  <td style={{ padding: "14px 10px", fontWeight: "700", color: "#38bdf8", fontSize: "13px", whiteSpace: "nowrap" }}>
                    {s.ticker}
                  </td>

                  <td style={{ padding: "14px 10px", color: "#e2e8f0", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.nome}
                  </td>

                  <td style={{ padding: "14px 10px" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 8px", borderRadius: "12px",
                      fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap",
                      background: s.mercado === "B3" ? "rgba(34,197,94,0.15)" : "rgba(56,189,248,0.15)",
                      color: s.mercado === "B3" ? "#22c55e" : "#38bdf8"
                    }}>
                      {s.mercado}
                    </span>
                  </td>

                  <td style={{ padding: "14px 10px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "5px 10px", borderRadius: "6px", fontSize: "11px",
                      fontWeight: "700", whiteSpace: "nowrap",
                      background: s.sinal === "COMPRAR" ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)",
                      color: s.sinal === "COMPRAR" ? "#4ade80" : "#fbbf24",
                      border: `1px solid ${s.sinal === "COMPRAR" ? "rgba(22,163,74,0.5)" : "rgba(217,119,6,0.5)"}`
                    }}>
                      {s.sinal === "COMPRAR" ? "▲" : "◆"} {s.sinal}
                    </span>
                  </td>

                  <td style={{ padding: "14px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ background: "#1e293b", borderRadius: "4px", height: "5px", width: "40px", flexShrink: 0 }}>
                        <div style={{
                          background: s.confianca >= 70 ? "#4ade80" : s.confianca >= 55 ? "#fbbf24" : "#f87171",
                          borderRadius: "4px", height: "5px", width: `${s.confianca}%`
                        }} />
                      </div>
                      <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: "600" }}>{s.confianca}%</span>
                    </div>
                  </td>

                  <td style={{ padding: "14px 10px", color: "#e2e8f0", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" }}>
                    {moeda(s)} {formatarPreco(s.preco_atual)}
                  </td>

                  <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: "600" }}>
                      {moeda(s)} {formatarPreco(s.alvo_lucro)}
                    </span>
                    {s.pct_alvo && (
                      <span style={{ color: "#22c55e", fontSize: "10px", marginLeft: "4px" }}>+{s.pct_alvo}%</span>
                    )}
                  </td>

                  <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#f87171", fontSize: "12px", fontWeight: "600" }}>
                      {moeda(s)} {formatarPreco(s.stop_loss)}
                    </span>
                    {s.pct_stop && (
                      <span style={{ color: "#ef4444", fontSize: "10px", marginLeft: "4px" }}>{s.pct_stop}%</span>
                    )}
                  </td>

                  <td style={{ padding: "14px 10px", textAlign: "center" }}>
                    <span style={{
                      fontSize: "18px",
                      title: s.score_sentimento
                    }}>
                      {s.score_sentimento > 0.3 ? "😊" : s.score_sentimento < -0.3 ? "😟" : "😐"}
                    </span>
                  </td>

                  <td style={{ padding: "14px 10px", color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}>
                    {formatarData(s.criado_em)}
                  </td>

                  <td style={{ padding: "14px 10px" }}>
                    <button onClick={() => adicionarPortfolio(s)} style={{
                      padding: "6px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg,#16a34a,#15803d)",
                      color: "white", fontSize: "11px", fontWeight: "700",
                      whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(22,163,74,0.3)"
                    }}>
                      + Portfólio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
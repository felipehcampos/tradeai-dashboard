import { useState, useEffect } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

export default function Mercado() {
  const [sinais, setSinais] = useState([])
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [atualizandoPrecos, setAtualizandoPrecos] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [filtroMercado, setFiltroMercado] = useState("TODOS")
  const [precosAtuais, setPrecosAtuais] = useState({})
  const [totalAnalisados, setTotalAnalisados] = useState(0)

  const carregarSinais = () => {
    setLoading(true)
    api.get(`${API}/sinais`)
      .then(r => {
        const dados = r.data.dados || []
        setTotalAnalisados(dados.length)
        const filtrados = dados.filter(s => s.sinal !== "EVITAR")
        filtrados.sort((a, b) => {
          if (a.sinal === "COMPRAR" && b.sinal !== "COMPRAR") return -1
          if (a.sinal !== "COMPRAR" && b.sinal === "COMPRAR") return 1
          return b.confianca - a.confianca
        })
        setSinais(filtrados)
      })
      .catch(() => { setSinais([]); setTotalAnalisados(0) })
      .finally(() => {
        setLoading(false)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      })
  }

  const atualizarPrecos = async () => {
    if (sinais.length === 0) return
    setAtualizandoPrecos(true)
    try {
      const tickers = [...new Set(sinais.map(s => s.ticker))]
      const res = await api.post(`${API}/precos`, { tickers })
      if (res.data.sucesso) {
        setPrecosAtuais(res.data.precos)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      console.error("Erro ao atualizar preços")
    } finally {
      setAtualizandoPrecos(false)
    }
  }

  useEffect(() => { carregarSinais() }, [])

  const rodarScanner = async () => {
    setRodando(true)
    try {
      await api.post(`${API}/rodar-scanner`)
      await carregarSinais()
      setPrecosAtuais({})
    } catch {
      alert("Erro ao rodar o scanner.")
    } finally {
      setRodando(false)
    }
  }

  const adicionarPortfolio = async (s) => {
  const precoAtual = precosAtuais[s.ticker] || parseFloat(s.preco_atual)
  try {
    const res = await api.post(`${API}/portfolio`, {
      ticker: s.ticker,
      nome: s.nome,
      mercado: s.mercado,
      quantidade: 1,
      preco_medio: precoAtual,
      alvo_lucro: parseFloat(s.alvo_lucro) || null,
      stop_loss: parseFloat(s.stop_loss) || null,
      pct_alvo: parseFloat(s.pct_alvo) || null,
      pct_stop: parseFloat(s.pct_stop) || null,
      origem: "longo"
    })
    if (res.data.sucesso) {
      alert(`${s.ticker} adicionado ao portfólio! Alvo: ${moeda(s)} ${parseFloat(s.alvo_lucro).toFixed(2)} | Stop: ${moeda(s)} ${parseFloat(s.stop_loss).toFixed(2)}`)
    } else {
      alert(res.data.erro || `Erro ao adicionar ${s.ticker} ao portfólio.`)
    }
  } catch {
    alert(`Erro ao adicionar ${s.ticker} ao portfólio.`)
  }
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

  const getPrecoExibir = (s) => {
    return precosAtuais[s.ticker] || parseFloat(s.preco_atual)
  }

  const calcularVariacao = (s) => {
    const precoNovo = precosAtuais[s.ticker]
    const precoAntigo = parseFloat(s.preco_atual)
    if (!precoNovo || precoNovo === precoAntigo) return null
    const pct = ((precoNovo - precoAntigo) / precoAntigo * 100).toFixed(2)
    return parseFloat(pct)
  }

  const mercados = ["TODOS", "B3", "NASDAQ", "NYSE", "CRYPTO", "COMMODITY"]
  const sinaisFiltrados = filtroMercado === "TODOS" ? sinais : sinais.filter(s => s.mercado === filtroMercado)
  const totalComprar = sinais.filter(s => s.sinal === "COMPRAR").length
  const totalManter = sinais.filter(s => s.sinal === "MANTER").length
  const temPrecosAtuais = Object.keys(precosAtuais).length > 0

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

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
            <span style={{ color: "#64748b", fontSize: "12px" }}>
              {temPrecosAtuais ? "💹 Preços atualizados às " : "Carregado às "}{ultimaAtualizacao}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={atualizarPrecos} disabled={atualizandoPrecos || sinais.length === 0} style={{
            padding: "9px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
            background: atualizandoPrecos ? "#334155" : "linear-gradient(135deg,#0ea5e9,#0284c7)",
            color: atualizandoPrecos ? "#94a3b8" : "white",
            fontSize: "13px", fontWeight: "600", minWidth: "160px",
            boxShadow: atualizandoPrecos ? "none" : "0 2px 8px rgba(14,165,233,0.3)",
            transition: "all 0.2s"
          }}>
            {atualizandoPrecos ? (
              <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <span style={{
                  width: "12px", height: "12px", border: "2px solid #94a3b8",
                  borderTopColor: "transparent", borderRadius: "50%",
                  display: "inline-block", animation: "spin 0.8s linear infinite"
                }} />
                Atualizando...
              </span>
            ) : "💹 Atualizar Preços"}
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
          { label: "📊 Total Analisados", valor: totalAnalisados, cor: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.3)" },
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

      {/* Banner preços atualizados */}
      {temPrecosAtuais && !atualizandoPrecos && (
        <div style={{
          background: "rgba(14,165,233,0.08)", padding: "10px 16px", borderRadius: "8px",
          marginBottom: "16px", borderLeft: "3px solid #0ea5e9", color: "#94a3b8", fontSize: "13px"
        }}>
          💹 Preços atualizados em tempo real — valores podem diferir dos sinais originais
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
          {totalAnalisados > 0 ? (
            <>
              <p style={{ fontSize: "16px", marginBottom: "8px", color: "#94a3b8" }}>
                {totalAnalisados} ativo{totalAnalisados > 1 ? "s" : ""} analisado{totalAnalisados > 1 ? "s" : ""}, nenhuma oportunidade de compra hoje
              </p>
              <p style={{ fontSize: "13px" }}>
                Todos os sinais vieram como EVITAR — o sistema preferiu não arriscar. Tente novamente mais tarde ou amanhã.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "16px", marginBottom: "8px" }}>Nenhum sinal disponível</p>
              <p style={{ fontSize: "13px" }}>Clique em "Rodar Scanner" ou aguarde às 18h</p>
            </>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #1e293b", width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#0a1520" }}>
                {["Ticker", "Nome", "Mercado", "Sinal", "Confiança", "Preço Atual", "Alvo", "Stop", "Humor", "Data", "Ação"].map(h => (
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
            <tbody style={{ opacity: atualizandoPrecos || loading ? 0.4 : 1, transition: "opacity 0.3s ease-in-out" }}>
              {sinaisFiltrados.map((s, i) => {
                const precoExibir = getPrecoExibir(s)
                const variacao = calcularVariacao(s)
                const precoBase = parseFloat(s.preco_atual) || 1
                const percentualAlvo = s.pct_alvo || ((parseFloat(s.alvo_lucro) - precoBase) / precoBase * 100).toFixed(1)
                const percentualStop = s.pct_stop || ((precoBase - parseFloat(s.stop_loss)) / precoBase * 100).toFixed(1)
                return (
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

                    <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: "600" }}>
                        {moeda(s)} {formatarPreco(precoExibir)}
                      </span>
                      {variacao !== null && (
                        <span style={{
                          display: "block", fontSize: "10px",
                          color: variacao >= 0 ? "#22c55e" : "#ef4444"
                        }}>
                          {variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao)}%
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: "600" }}>
                        {moeda(s)} {formatarPreco(s.alvo_lucro)}
                      </span>
                      <span style={{ color: "#22c55e", fontSize: "10px", display: "block" }}>+{percentualAlvo}%</span>
                    </td>

                    <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#f87171", fontSize: "12px", fontWeight: "600" }}>
                        {moeda(s)} {formatarPreco(s.stop_loss)}
                      </span>
                      <span style={{ color: "#ef4444", fontSize: "10px", display: "block" }}>-{percentualStop}%</span>
                    </td>

                    <td style={{ padding: "14px 10px", textAlign: "center" }}>
                      <span style={{ fontSize: "18px" }}>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
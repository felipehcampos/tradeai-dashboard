import { useState, useEffect, useRef } from "react" // Injetado useRef para controle de memória
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

export default function SwingRapido() {
  const [sinais, setSinais] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [erroConexao, setErroConexao] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [filtroMercado, setFiltroMercado] = useState("TODOS")
  const [vistaAtiva, setVistaAtiva] = useState("ativos")
  const [modalSinal, setModalSinal] = useState(null)
  const [precosAtuais, setPrecosAtuais] = useState({})
  const [atualizandoPrecos, setAtualizandoPrecos] = useState(false)
  const [reavaliando, setReavaliando] = useState({})
  const [resultadosReavaliacao, setResultadosReavaliacao] = useState({})
  const [modalReavaliacao, setModalReavaliacao] = useState(null)
  
  // Guarda a referência do intervalo na memória do componente de forma segura
  const scannerIntervalRef = useRef(null)

  const carregarSinais = () => {
    setLoading(true)
    setErroConexao(false)
    Promise.all([
      api.get(`${API}/sinais-swing`),
      api.get(`${API}/sinais-swing/historico`)
    ])
      .then(([resAtivos, resHistorico]) => {
        setSinais(resAtivos.data.dados || [])
        setHistorico(resHistorico.data.dados || [])
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      })
      .catch(() => {
        setErroConexao(true)
        setSinais([])
        setHistorico([])
      })
      .finally(() => setLoading(false))
  }

  // Bloco de Segurança Máxima: Limpa o intervalo se o usuário fechar a página ou mudar de aba
  useEffect(() => {
    carregarSinais()
    return () => {
      if (scannerIntervalRef.current) clearInterval(scannerIntervalRef.current)
    }
  }, [])

  const rodarScanner = async () => {
    if (rodando) return
    setRodando(true)

    // Inicia a escuta em tempo real do progresso
    scannerIntervalRef.current = setInterval(() => {
      carregarSinais()
    }, 15000)

    const limparIntervaloSeguro = () => {
      if (scannerIntervalRef.current) {
        clearInterval(scannerIntervalRef.current)
        scannerIntervalRef.current = null
      }
      setRodando(false)
    }

    api.post(`${API}/rodar-scanner-swing`, {}, { timeout: 600000 })
      .finally(() => {
        limparIntervaloSeguro()
        carregarSinais()
      })

    // Trava de segurança para desligar após 8 minutos se o servidor sumir
    setTimeout(() => {
      limparIntervaloSeguro()
    }, 480000)
  }

  const atualizarPrecos = async () => {
    const lista = vistaAtiva === "ativos" ? sinais : historico
    if (lista.length === 0) return
    setAtualizandoPrecos(true)
    try {
      const tickers = [...new Set(lista.map(s => s.ticker))]
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
const adicionarPortfolio = (s) => {
    const precoAtual = precosAtuais[s.ticker] || parseFloat(s.preco_atual)
    const salvo = JSON.parse(localStorage.getItem("tradeai_portfolio") || "[]")
    const jaExiste = salvo.find(p => p.ticker === s.ticker)
    if (jaExiste) { alert(`${s.ticker} já está no portfólio!`); return }
    const nova = {
      ticker: s.ticker, nome: s.nome, mercado: s.mercado,
      quantidade: 1, preco_entrada: precoAtual,
      preco_atual: precoAtual,
      alvo_lucro: parseFloat(s.alvo_lucro) || null,
      stop_loss: parseFloat(s.stop_loss) || null,
      pct_alvo: parseFloat(s.pct_alvo) || null,
      pct_stop: parseFloat(s.pct_stop) || null,
      origem: "swing",
      data: new Date().toLocaleDateString("pt-BR")
    }
    localStorage.setItem("tradeai_portfolio", JSON.stringify([...salvo, nova]))
    alert(`${s.ticker} adicionado ao portfólio! Alvo: ${moeda(s.mercado)} ${parseFloat(s.alvo_lucro).toFixed(2)} | Stop: ${moeda(s.mercado)} ${parseFloat(s.stop_loss).toFixed(2)}`)
  }
  const statusHistorico = (s) => {
    const precoAtual = precosAtuais[s.ticker] ? parseFloat(precosAtuais[s.ticker]) : parseFloat(s.preco_atual)
    const alvo = parseFloat(s.alvo_lucro)
    const stop = parseFloat(s.stop_loss)
    if (!precoAtual || !alvo || !stop) {
      return { texto: "— sem dados —", cor: "#64748b", reavaliar: false }
    }
    if (precoAtual >= alvo) {
      return { texto: "🎯 Alvo já seria atingido", cor: "#4ade80", reavaliar: false }
    }
    if (precoAtual <= stop) {
      return { texto: "🛑 Stop já seria atingido", cor: "#f87171", reavaliar: false }
    }
    return { texto: "🔁 Ainda na faixa", cor: "#f59e0b", reavaliar: true }
  }

  const reavaliarAtivo = async (s) => {
    setReavaliando(prev => ({ ...prev, [s.ticker]: true }))
    try {
      const res = await api.post(`${API}/reavaliar-swing`, {
        ticker: s.ticker, nome: s.nome, mercado: s.mercado
      }, { timeout: 90000 })
      if (res.data.sucesso) {
        setResultadosReavaliacao(prev => ({ ...prev, [s.ticker]: res.data.dados }))
      } else {
        alert(`Erro ao reavaliar ${s.ticker}: ${res.data.erro}`)
      }
    } catch {
      alert(`Erro ao reavaliar ${s.ticker}. Tente novamente.`)
    } finally {
      setReavaliando(prev => ({ ...prev, [s.ticker]: false }))
    }
  }

  const getPrecoExibir = (s) => precosAtuais[s.ticker] || s.preco_atual
  const calcularVariacao = (s) => {
    if (!precosAtuais[s.ticker] || !s.preco_atual) return null
    const atual = parseFloat(precosAtuais[s.ticker])
    const original = parseFloat(s.preco_atual)
    return ((atual - original) / original * 100).toFixed(2)
  }

  const moeda = (mercado) => mercado === "B3" ? "R$" : "US$"

  const formatarPreco = (valor) => {
    if (!valor) return "—"
    return parseFloat(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })
  }

  const formatarData = (data) => {
    if (!data) return ""
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const calcularTimeStop = (dataExpiracao) => {
    if (!dataExpiracao) return null
    const agora = new Date()
    const expira = new Date(dataExpiracao)
    const diffHoras = Math.ceil((expira - agora) / (1000 * 60 * 60))
    if (diffHoras <= 0) return { texto: "EXPIRADO", cor: "#ef4444" }
    if (diffHoras <= 24) return { texto: `${diffHoras}h rest.`, cor: "#f59e0b" }
    const dias = Math.ceil(diffHoras / 24)
    return { texto: `${dias}d rest.`, cor: "#22c55e" }
  }

  const mercados = ["TODOS", "B3", "NASDAQ", "NYSE", "CRYPTO", "COMMODITY"]
  const sinaisFiltrados = filtroMercado === "TODOS"
    ? sinais
    : sinais.filter(s => s.mercado === filtroMercado)

  const totalAtivos = sinais.length
  const totalB3 = sinais.filter(s => s.mercado === "B3").length
  const totalIntl = sinais.filter(s => s.mercado !== "B3").length

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Modal de análise */}
      {modalSinal && (
        <div onClick={() => setModalSinal(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0d1829", border: "1px solid #1e293b", borderRadius: "16px",
            padding: "28px", maxWidth: "520px", width: "100%", position: "relative"
          }}>
            <button onClick={() => setModalSinal(null)} style={{
              position: "absolute", top: "16px", right: "16px",
              background: "none", border: "none", color: "#64748b",
              fontSize: "18px", cursor: "pointer"
            }}>✕</button>
            <div style={{ marginBottom: "16px" }}>
              <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "18px" }}>{modalSinal.ticker}</span>
              <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "8px" }}>{modalSinal.nome}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                📉 {modalSinal.variacao_dia ? `${parseFloat(modalSinal.variacao_dia).toFixed(2)}%` : "—"}
              </span>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                RSI {modalSinal.rsi ? parseFloat(modalSinal.rsi).toFixed(1) : "—"}
              </span>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                Vol {modalSinal.volume_vs_media ? `${parseFloat(modalSinal.volume_vs_media).toFixed(0)}%` : "—"}
              </span>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
                {modalSinal.tipo_risco === "SISTEMICO" ? "🔵 Sistêmico" : "🔴 Idiossincr."}
              </span>
            </div>
            <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.7", margin: 0 }}>
              💡 {modalSinal.justificativa}
            </p>
          </div>
        </div>
      )}
{/* Modal de reavaliação */}
      {modalReavaliacao && (
        <div onClick={() => setModalReavaliacao(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0d1829", border: "1px solid #1e293b", borderRadius: "16px",
            padding: "28px", maxWidth: "520px", width: "100%", position: "relative"
          }}>
            <button onClick={() => setModalReavaliacao(null)} style={{
              position: "absolute", top: "16px", right: "16px",
              background: "none", border: "none", color: "#64748b",
              fontSize: "18px", cursor: "pointer"
            }}>✕</button>
            <div style={{ marginBottom: "16px" }}>
              <span style={{ color: "#38bdf8", fontWeight: "800", fontSize: "18px" }}>{modalReavaliacao.ticker}</span>
              <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "8px" }}>{modalReavaliacao.nome}</span>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>🔄 Reavaliação com dados e IA atuais</div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "800",
                background: modalReavaliacao.sinal === "COMPRAR" ? "rgba(34,197,94,0.15)" : modalReavaliacao.sinal === "MANTER" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                color: modalReavaliacao.sinal === "COMPRAR" ? "#4ade80" : modalReavaliacao.sinal === "MANTER" ? "#f59e0b" : "#f87171"
              }}>
                {modalReavaliacao.sinal === "COMPRAR" ? "🟢" : modalReavaliacao.sinal === "MANTER" ? "🟡" : "🔴"} {modalReavaliacao.sinal} — {modalReavaliacao.confianca}%
              </span>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                RSI {modalReavaliacao.rsi ? parseFloat(modalReavaliacao.rsi).toFixed(1) : "—"}
              </span>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
                {modalReavaliacao.tendencia || "—"}
              </span>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
                {modalReavaliacao.tipo_risco === "SISTEMICO" ? "🔵 Sistêmico" : "🔴 Idiossincr."}
              </span>
            </div>
            <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.7", margin: 0 }}>
              💡 {modalReavaliacao.justificativa}
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px", flexWrap: "wrap", gap: "12px"
      }}>
        <div>
          <h2 style={{ color: "#f59e0b", margin: "0 0 4px 0", fontSize: "22px", fontWeight: "800" }}>
            ⚡ Swing Rápido
          </h2>
          <span style={{ color: "#64748b", fontSize: "12px" }}>
            Reversão à Média — Alvo +5% | Stop -2% | Time Stop 3 dias
            {ultimaAtualizacao && ` • Atualizado às ${ultimaAtualizacao}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          
          {/* INSTALADO O SPINNER GIRATÓRIO PROFISSIONAL IGUAL À ABA MERCADO */}
          <button onClick={atualizarPrecos} disabled={atualizandoPrecos || (vistaAtiva === "ativos" ? sinais.length === 0 : historico.length === 0)} style={{
            padding: "9px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
            background: atualizandoPrecos || sinais.length === 0 ? "#334155" : "linear-gradient(135deg,#10b981,#059669)",
            color: atualizandoPrecos ? "#94a3b8" : "white",
            fontSize: "13px", fontWeight: "600", minWidth: "160px",
            boxShadow: atualizandoPrecos ? "none" : "0 2px 8px rgba(16,185,129,0.3)",
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
            background: rodando ? "#334155" : "linear-gradient(135deg,#f59e0b,#d97706)",
            color: rodando ? "#94a3b8" : "#0f172a",
            fontWeight: "bold", fontSize: "13px",
            boxShadow: rodando ? "none" : "0 2px 8px rgba(245,158,11,0.4)"
          }}>
            {rodando ? "⏳ Varrendo mercado..." : "⚡ Rodar Scanner Swing"}
          </button>
        </div>
      </div>

      {/* Erro de conexão */}
      {erroConexao && (
        <div style={{
          background: "rgba(239,68,68,0.1)", padding: "12px 16px", borderRadius: "8px",
          marginBottom: "16px", border: "1px solid rgba(239,68,68,0.3)",
          color: "#f87171", fontSize: "13px"
        }}>
          ⚠️ <strong>Erro de conexão:</strong> Não foi possível conectar ao servidor TradeAI. Verifique se o backend está ativo.
        </div>
      )}

      {/* Cards resumo */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          { label: "⚡ Sinais Ativos", valor: totalAtivos, cor: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
          { label: "🇧🇷 B3", valor: totalB3, cor: "#22c55e", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.15)" },
          { label: "🌎 Internacional", valor: totalIntl, cor: "#38bdf8", bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.15)" },
          { label: "📋 Histórico", valor: historico.length, cor: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.15)" },
        ].map((card, i) => (
          <div key={i} style={{
            background: card.bg, border: `1px solid ${card.border}`,
            padding: "16px 24px", borderRadius: "12px", flex: 1, minWidth: "130px", textAlign: "center"
          }}>
            <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 6px 0" }}>{card.label}</p>
            <p style={{ color: card.cor, fontSize: "28px", fontWeight: "800", margin: 0 }}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Banner rodando */}
      {rodando && (
        <div style={{
          background: "rgba(245,158,11,0.08)", padding: "12px 16px", borderRadius: "8px",
          marginBottom: "16px", borderLeft: "3px solid #f59e0b", color: "#94a3b8", fontSize: "13px"
        }}>
          ⚡ Varrendo 70+ ativos da B3 + mercado global em busca de pânico técnico... Aguarde alguns minutos.
        </div>
      )}

      {/* Tabs Ativos / Histórico */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {[
          { id: "ativos", label: "⚡ Sinais Ativos" },
          { id: "historico", label: "📋 Histórico" }
        ].map(v => (
          <button key={v.id} onClick={() => setVistaAtiva(v.id)} style={{
            padding: "7px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontSize: "13px", fontWeight: vistaAtiva === v.id ? "700" : "400",
            background: vistaAtiva === v.id ? "rgba(245,158,11,0.15)" : "#1e293b",
            color: vistaAtiva === v.id ? "#f59e0b" : "#64748b",
            borderBottom: vistaAtiva === v.id ? "2px solid #f59e0b" : "2px solid transparent",
          }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Filtros por mercado */}
      {vistaAtiva === "ativos" && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {mercados.map(m => (
            <button key={m} onClick={() => setFiltroMercado(m)} style={{
              padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: filtroMercado === m ? "700" : "400",
              background: filtroMercado === m ? "#f59e0b" : "#1e293b",
              color: filtroMercado === m ? "#0f172a" : "#64748b",
              transition: "all 0.2s"
            }}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</p>
          <p>Carregando sinais swing...</p>
        </div>
      ) : vistaAtiva === "ativos" && sinaisFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <p style={{ fontSize: "48px", marginBottom: "12px" }}>📭</p>
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>Nenhum sinal swing ativo</p>
          <p style={{ fontSize: "13px", marginBottom: "16px" }}>
            O scanner busca quedas ≥3% + RSI ≤38 + volume ≥150% da média
          </p>
          <button onClick={rodarScanner} disabled={rodando} style={{
            padding: "10px 24px", borderRadius: "8px", border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            color: "#0f172a", fontWeight: "bold", fontSize: "13px"
          }}>
            ⚡ Rodar Scanner Agora
          </button>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #1e293b" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#0a1520" }}>
                {["Ticker", "Nome / Diagnóstico IA", "Mercado", "Queda", "RSI", "Volume", "Preço", "Alvo", "Stop", "Risco", "Time Stop", "Data", "Ação"].map(h => (
                  <th key={h} style={{
                    padding: "12px 10px", textAlign: "left", color: "#64748b",
                    fontSize: "11px", fontWeight: "700", letterSpacing: "0.05em",
                    borderBottom: "1px solid #1e293b", whiteSpace: "nowrap"
                  }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ opacity: atualizandoPrecos || loading ? 0.4 : 1, transition: "opacity 0.3s ease-in-out" }}>
              {(vistaAtiva === "ativos" ? sinaisFiltrados : historico).map((s, i) => {
                const timeStop = calcularTimeStop(s.data_expiracao)
                const expirado = s.status === "EXPIRADO"
                return (
                  <tr key={i} style={{
                    borderBottom: "1px solid #1e293b",
                    background: expirado ? "rgba(100,116,139,0.03)" : i % 2 === 0 ? "#0d1829" : "#0a1520",
                    opacity: expirado ? 0.5 : 1,
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => { if (!expirado) e.currentTarget.style.background = "#112235" }}
                  onMouseLeave={e => { if (!expirado) e.currentTarget.style.background = i % 2 === 0 ? "#0d1829" : "#0a1520" }}>

                    <td style={{ padding: "14px 10px", fontWeight: "800", color: "#f59e0b", fontSize: "13px" }}>
                      {s.ticker}
                    </td>

                    <td style={{ padding: "14px 10px", verticalAlign: "middle" }}>
                      <div style={{ color: "#f1f5f9", fontSize: "12px", fontWeight: "600", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.nome}
                      </div>
                      {s.justificativa && (
                        <button onClick={() => setModalSinal(s)} style={{
                          padding: "3px 10px", borderRadius: "6px", border: "1px solid #334155",
                          background: "#1e293b", color: "#94a3b8", fontSize: "10px",
                          cursor: "pointer", whiteSpace: "nowrap"
                        }}>
                          💡 Ver análise
                        </button>
                      )}
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{
                        display: "inline-block", padding: "3px 8px", borderRadius: "12px",
                        fontSize: "10px", fontWeight: "700",
                        background: s.mercado === "B3" ? "rgba(34,197,94,0.12)" : "rgba(56,189,248,0.12)",
                        color: s.mercado === "B3" ? "#22c55e" : "#38bdf8"
                      }}>
                        {s.mercado}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{ color: "#f87171", fontWeight: "700", fontSize: "13px" }}>
                        {s.variacao_dia ? `${parseFloat(s.variacao_dia).toFixed(2)}%` : "—"}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{
                        color: parseFloat(s.rsi) <= 30 ? "#f87171" : "#f59e0b",
                        fontWeight: "700", fontSize: "13px"
                      }}>
                        {s.rsi ? parseFloat(s.rsi).toFixed(1) : "—"}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: "700" }}>
                        {s.volume_vs_media ? `${parseFloat(s.volume_vs_media).toFixed(0)}%` : "—"}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>
                        {moeda(s.mercado)} {formatarPreco(getPrecoExibir(s))}
                      </span>
                      {calcularVariacao(s) !== null && (
                        <span style={{
                          display: "block", fontSize: "10px",
                          color: parseFloat(calcularVariacao(s)) >= 0 ? "#22c55e" : "#ef4444"
                        }}>
                          {parseFloat(calcularVariacao(s)) >= 0 ? "▲" : "▼"} {Math.abs(calcularVariacao(s))}%
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: "700" }}>
                        {moeda(s.mercado)} {formatarPreco(s.alvo_lucro)}
                      </span>
                      {s.pct_alvo && (
                        <span style={{ color: "#22c55e", fontSize: "10px", display: "block" }}>+{s.pct_alvo}%</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{ color: "#f87171", fontSize: "12px", fontWeight: "600" }}>
                        {moeda(s.mercado)} {formatarPreco(s.stop_loss)}
                      </span>
                      {s.pct_stop && (
                        <span style={{ color: "#ef4444", fontSize: "10px", display: "block" }}>-{s.pct_stop}%</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span style={{
                        display: "inline-block", padding: "3px 6px", borderRadius: "10px",
                        fontSize: "10px", fontWeight: "700",
                        background: s.tipo_risco === "SISTEMICO" ? "rgba(56,189,248,0.1)" : "rgba(239,68,68,0.1)",
                        color: s.tipo_risco === "SISTEMICO" ? "#38bdf8" : "#f87171"
                      }}>
                        {s.tipo_risco === "SISTEMICO" ? "🔵 Sist" : "🔴 Idios"}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      {expirado ? (
                        <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>⏰ EXPIRADO</span>
                      ) : timeStop ? (
                        <span style={{ color: timeStop.cor, fontSize: "11px", fontWeight: "700" }}>
                          ⏱️ {timeStop.texto}
                        </span>
                      ) : "—"}
                    </td>

                    <td style={{ padding: "14px 10px", color: "#475569", fontSize: "11px" }}>
                      {formatarData(s.criado_em)}
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      {!expirado && vistaAtiva === "ativos" && (
                        <button onClick={() => adicionarPortfolio(s)} style={{
                          padding: "6px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                          background: "linear-gradient(135deg,#16a34a,#15803d)",
                          color: "white", fontSize: "11px", fontWeight: "700",
                          whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(22,163,74,0.3)"
                        }}>
                          + Portfólio 
                        </button>
                      )}
                      {vistaAtiva === "historico" && (() => {
                        const resultado = resultadosReavaliacao[s.ticker]
                        const status = statusHistorico(s)

                        if (resultado) {
                          const cor = resultado.sinal === "COMPRAR" ? "#4ade80"
                            : resultado.sinal === "MANTER" ? "#f59e0b" : "#f87171"
                          const icone = resultado.sinal === "COMPRAR" ? "🟢"
                            : resultado.sinal === "MANTER" ? "🟡" : "🔴"
                          return (
                            <button onClick={() => setModalReavaliacao(resultado)} style={{
                              padding: "5px 10px", borderRadius: "6px", border: `1px solid ${cor}`,
                              background: "transparent", color: cor, fontSize: "10px", fontWeight: "700",
                              cursor: "pointer", whiteSpace: "nowrap"
                            }}>
                              {icone} {resultado.sinal} {resultado.confianca}%
                            </button>
                          )
                        }

                        if (status.reavaliar) {
                          return (
                            <button onClick={() => reavaliarAtivo(s)} disabled={reavaliando[s.ticker]} style={{
                              padding: "5px 10px", borderRadius: "6px", border: "1px solid #38bdf8",
                              background: reavaliando[s.ticker] ? "#1e293b" : "transparent",
                              color: "#38bdf8", fontSize: "10px", fontWeight: "700",
                              cursor: reavaliando[s.ticker] ? "default" : "pointer", whiteSpace: "nowrap"
                            }}>
                              {reavaliando[s.ticker] ? "⏳ Analisando..." : "🔄 Reavaliar"}
                            </button>
                          )
                        }

                        return (
                          <span style={{ fontSize: "10px", fontWeight: "700", color: status.cor, whiteSpace: "nowrap" }}>
                            {status.texto}
                          </span>
                        )
                      })()}
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
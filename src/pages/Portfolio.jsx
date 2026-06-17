import { useState, useEffect } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts"
import api from "../services/api"

const HISTORICO_KEY = "tradeai_portfolio_historico"
const CORES = ["#38bdf8","#4ade80","#f59e0b","#f87171","#a78bfa","#34d399","#fb923c","#60a5fa","#e879f9","#facc15"]
const API = import.meta.env.VITE_API_URL

const fmt = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})

const SETORES = {
  "ITUB4.SA":"Bancos","BBAS3.SA":"Bancos","BBDC4.SA":"Bancos","SANB11.SA":"Bancos",
  "BPAC11.SA":"Bancos","BRSR6.SA":"Bancos",
  "VALE3.SA":"Mineração","GGBR4.SA":"Siderurgia","CSNA3.SA":"Siderurgia",
  "USIM5.SA":"Siderurgia","CMIN3.SA":"Mineração","BRAP4.SA":"Mineração",
  "PETR4.SA":"Petróleo","PETR3.SA":"Petróleo","PRIO3.SA":"Petróleo",
  "RECV3.SA":"Petróleo","VBBR3.SA":"Energia","CSAN3.SA":"Energia",
  "EGIE3.SA":"Energia","ENGI11.SA":"Energia","CMIG4.SA":"Energia",
  "CPFE3.SA":"Energia","TAEE11.SA":"Energia","ENBR3.SA":"Energia",
  "MGLU3.SA":"Varejo","LREN3.SA":"Varejo","SOMA3.SA":"Varejo",
  "HAPV3.SA":"Saúde","RDOR3.SA":"Saúde","FLRY3.SA":"Saúde","ODPV3.SA":"Saúde",
  "AGRO3.SA":"Agronegócio","SLCE3.SA":"Agronegócio","JBSS3.SA":"Agronegócio",
  "VIVT3.SA":"Telecom","TIMS3.SA":"Telecom",
  "TOTVS3.SA":"Tecnologia","LWSA3.SA":"Tecnologia",
  "CYRE3.SA":"Imobiliário","MRVE3.SA":"Imobiliário","EZTC3.SA":"Imobiliário",
  "MULT3.SA":"Imobiliário","ALOS3.SA":"Imobiliário",
  "NVDA":"Tecnologia","AAPL":"Tecnologia","MSFT":"Tecnologia","GOOGL":"Tecnologia",
  "META":"Tecnologia","AMZN":"Tecnologia","TSLA":"Veículos Elétricos",
  "JPM":"Bancos","BAC":"Bancos","V":"Financeiro","MA":"Financeiro",
  "XOM":"Petróleo","CVX":"Petróleo","LLY":"Saúde","ABBV":"Saúde",
  "AVGO":"Semicondutores","AMD":"Semicondutores","TSM":"Semicondutores",
  "BTC-USD":"Crypto","ETH-USD":"Crypto","SOL-USD":"Crypto",
  "GC=F":"Commodities","CL=F":"Commodities",
}

const getSetor = (ticker) => SETORES[ticker] || "Outros"

const diasNaOperacao = (dataStr) => {
  if (!dataStr) return 0
  let data
  if (dataStr.includes("T")) {
    data = new Date(dataStr)
  } else {
    const partes = dataStr.split("/")
    if (partes.length === 3) {
      data = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`)
    } else {
      return 0
    }
  }
  if (isNaN(data.getTime())) return 0
  return Math.floor((new Date() - data) / (1000 * 60 * 60 * 24))
}

export default function Portfolio() {
  const [posicoes, setPosicoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [historico, setHistorico] = useState([])
  const [abaAtiva, setAbaAtiva] = useState("abertas")
  const [form, setForm] = useState({ ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "" })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [atualizando, setAtualizando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [modoGrafico, setModoGrafico] = useState("ativo")
  const [modalEncerrar, setModalEncerrar] = useState(null)
  const [precoSaida, setPrecoSaida] = useState("")
  const [modalHistorico, setModalHistorico] = useState(null)
  const [dadosHistorico, setDadosHistorico] = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)

  const carregarPortfolio = async () => {
    try {
      const res = await api.get(`${API}/portfolio`)
      if (res.data.sucesso) {
        const mapeado = res.data.dados.map(p => ({
          ticker: p.ticker,
          nome: p.nome || p.ticker,
          mercado: p.mercado || "B3",
          quantidade: parseFloat(p.quantidade),
          preco_entrada: parseFloat(p.preco_medio),
          preco_atual: parseFloat(p.preco_atual ?? p.preco_medio),
          alvo_lucro: p.alvo_lucro != null ? parseFloat(p.alvo_lucro) : null,
          stop_loss: p.stop_loss != null ? parseFloat(p.stop_loss) : null,
          pct_alvo: p.pct_alvo != null ? parseFloat(p.pct_alvo) : null,
          pct_stop: p.pct_stop != null ? parseFloat(p.pct_stop) : null,
          origem: p.origem || "manual",
          data: p.criado_em
        }))
        setPosicoes(mapeado)
      }
    } catch {
      console.error("Erro ao carregar portfólio")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarPortfolio()
    const hist = localStorage.getItem(HISTORICO_KEY)
    if (hist) setHistorico(JSON.parse(hist))
  }, [])

  const abrirHistoricoAtivo = async (p) => {
    setModalHistorico(p)
    setCarregandoHist(true)
    setDadosHistorico([])
    try {
      const res = await api.get(`${API}/portfolio/historico/${p.ticker}`, {
        params: { data_inicio: p.data }
      })
      if (res.data.sucesso) {
        setDadosHistorico(res.data.dados || [])
      }
    } catch (err) {
      console.error("Erro ao carregar linha do tempo do ativo", err)
    } finally {
      setCarregandoHist(false)
    }
  }

  const salvarHistorico = (novo) => {
    const novoHist = [novo, ...historico]
    setHistorico(novoHist)
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(novoHist))
  }

  const adicionar = async () => {
    if (!form.ticker || !form.quantidade || !form.preco_entrada) return
    try {
      const res = await api.post(`${API}/portfolio`, {
        ticker: form.ticker.toUpperCase(),
        nome: form.nome || form.ticker.toUpperCase(),
        mercado: form.mercado,
        quantidade: parseFloat(form.quantidade),
        preco_medio: parseFloat(form.preco_entrada),
        origem: "manual"
      })
      if (res.data.sucesso) {
        await carregarPortfolio()
        setForm({ ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "" })
        setMostrarForm(false)
      } else {
        alert(res.data.erro || "Erro ao adicionar posição.")
      }
    } catch {
      alert("Erro ao adicionar posição.")
    }
  }

  const remover = async (i) => {
    const ticker = posicoes[i].ticker
    try {
      await api.delete(`${API}/portfolio/${ticker}`)
      await carregarPortfolio()
    } catch {
      alert("Erro ao remover posição.")
    }
  }

  const iniciarEdicao = (i) => {
    setEditando(i)
    setEditForm({ quantidade: posicoes[i].quantidade, preco_entrada: posicoes[i].preco_entrada })
  }

  const salvarEdicao = async (i) => {
    const p = posicoes[i]
    try {
      await api.delete(`${API}/portfolio/${p.ticker}`)
      await api.post(`${API}/portfolio`, {
        ticker: p.ticker,
        nome: p.nome,
        mercado: p.mercado,
        quantidade: parseFloat(editForm.quantidade),
        preco_medio: parseFloat(editForm.preco_entrada),
        alvo_lucro: p.alvo_lucro,
        stop_loss: p.stop_loss,
        pct_alvo: p.pct_alvo,
        pct_stop: p.pct_stop,
        origem: p.origem
      })
      await carregarPortfolio()
      setEditando(null)
    } catch {
      alert("Erro ao salvar edição.")
    }
  }

  const encerrarPosicao = async () => {
    if (!precoSaida || !modalEncerrar) return
    const p = posicoes[modalEncerrar.idx]
    const saida = parseFloat(precoSaida)
    const pl = (saida - p.preco_entrada) * p.quantidade
    const plPct = ((saida - p.preco_entrada) / p.preco_entrada * 100).toFixed(2)
    try {
      await api.delete(`${API}/portfolio/${p.ticker}`)
      salvarHistorico({
        ticker: p.ticker,
        nome: p.nome,
        mercado: p.mercado,
        quantidade: p.quantidade,
        preco_entrada: p.preco_entrada,
        preco_saida: saida,
        pl: pl,
        pl_pct: plPct,
        data_entrada: p.data,
        data_saida: new Date().toLocaleDateString("pt-BR"),
        dias: diasNaOperacao(p.data)
      })
      await carregarPortfolio()
      setModalEncerrar(null)
      setPrecoSaida("")
    } catch {
      alert("Erro ao encerrar posição.")
    }
  }

  const atualizarPrecos = async () => {
    if (posicoes.length === 0) return
    setAtualizando(true)
    try {
      const tickers = posicoes.map(p => p.ticker)
      const res = await api.post(`${API}/precos`, { tickers })
      if (res.data.sucesso) {
        const precos = res.data.precos
        const novas = posicoes.map(p => ({
          ...p,
          preco_atual: precos[p.ticker] || p.preco_atual
        }))
        setPosicoes(novas)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      alert("Erro ao atualizar preços.")
    } finally {
      setAtualizando(false)
    }
  }

  const moeda = (mercado) => mercado === "B3" ? "R$" : "US$"

  const invB3 = posicoes.filter(p=>p.mercado==="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)
  const atuB3 = posicoes.filter(p=>p.mercado==="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_atual, 0)
  const lucroB3 = atuB3 - invB3
  const lucroB3Pct = invB3 > 0 ? (lucroB3 / invB3 * 100).toFixed(1) : 0

  const invIntl = posicoes.filter(p=>p.mercado!=="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)
  const atuIntl = posicoes.filter(p=>p.mercado!=="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_atual, 0)
  const lucroIntl = atuIntl - invIntl
  const lucroIntlPct = invIntl > 0 ? (lucroIntl / invIntl * 100).toFixed(1) : 0

  const lucroRealizadoBR = historico.filter(h=>h.mercado==="B3").reduce((acc,h)=>acc+h.pl, 0)
  const lucroRealizadoUS = historico.filter(h=>h.mercado!=="B3").reduce((acc,h)=>acc+h.pl, 0)

  const totalFicticioGrafico = posicoes.reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)

  const dadosPorAtivo = posicoes.map(p => ({
    name: p.ticker,
    value: parseFloat((p.quantidade * p.preco_entrada).toFixed(2)),
    percent: totalFicticioGrafico > 0 ? ((p.quantidade * p.preco_entrada / totalFicticioGrafico) * 100).toFixed(1) : 0
  }))

  const dadosPorSetor = Object.entries(
    posicoes.reduce((acc, p) => {
      const setor = getSetor(p.ticker)
      const valor = p.quantidade * p.preco_entrada
      acc[setor] = (acc[setor] || 0) + valor
      return acc
    }, {})
  ).map(([setor, valor]) => ({
    name: setor,
    value: parseFloat(valor.toFixed(2)),
    percent: totalFicticioGrafico > 0 ? ((valor / totalFicticioGrafico) * 100).toFixed(1) : 0
  })).sort((a, b) => b.value - a.value)

  const dadosGrafico = modoGrafico === "ativo" ? dadosPorAtivo : dadosPorSetor

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Modal Histórico de Preços */}
      {modalHistorico && (
        <div onClick={() => setModalHistorico(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0d1829", border: "1px solid #1e293b", borderRadius: "16px",
            padding: "24px", maxWidth: "560px", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <h3 style={{ color: "#38bdf8", margin: 0, fontSize: "18px", fontWeight: "800" }}>
                📈 Histórico de Linha do Tempo — {modalHistorico.ticker}
              </h3>
              <button onClick={() => setModalHistorico(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 16px 0" }}>
              Preço de Entrada Original: <strong style={{ color: "#e2e8f0" }}>{moeda(modalHistorico.mercado)} {fmt(modalHistorico.preco_entrada)}</strong>
            </p>
            {carregandoHist ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                <span style={{
                  width: "24px", height: "24px", border: "2px solid #38bdf8",
                  borderTopColor: "transparent", borderRadius: "50%",
                  display: "inline-block", animation: "spin 0.8s linear infinite", marginBottom: "12px"
                }} />
                <p style={{ fontSize: "13px" }}>Buscando histórico diário...</p>
              </div>
            ) : dadosHistorico.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                <p style={{ fontSize: "13px" }}>Nenhum dado diário encontrado para este ativo desde a compra.</p>
              </div>
            ) : (
              <>
                <div style={{ background: "#060d1a", borderRadius: "8px", padding: "12px 12px 0 0", marginBottom: "16px" }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={dadosHistorico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="data" stroke="#475569" strokeWidth={0.5} style={{ fontSize: "10px" }} />
                      <YAxis stroke="#475569" strokeWidth={0.5} style={{ fontSize: "10px" }} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px" }}
                        formatter={(value) => [`${moeda(modalHistorico.mercado)} ${fmt(value)}`, "Fechamento"]}
                      />
                      <ReferenceLine y={modalHistorico.preco_entrada} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Entrada', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} />
                      <Line type="monotone" dataKey="fechamento" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, strokeWidth: 1 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ overflowY: "auto", flex: 1, border: "1px solid #1e293b", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#0a1520", position: "sticky", top: 0, zIndex: 1 }}>
                        <th style={{ padding: "10px", color: "#64748b", textAlign: "left" }}>DATA</th>
                        <th style={{ padding: "10px", color: "#64748b", textAlign: "right" }}>FECHAMENTO</th>
                        <th style={{ padding: "10px", color: "#64748b", textAlign: "right" }}>P&L DESDE A ENTRADA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosHistorico.map((dia, idx) => {
                        const varPct = ((dia.fechamento - modalHistorico.preco_entrada) / modalHistorico.preco_entrada * 100).toFixed(2)
                        const lucro = dia.fechamento >= modalHistorico.preco_entrada
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #1e293b", background: idx % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                            <td style={{ padding: "10px", color: "#94a3b8" }}>{dia.data}</td>
                            <td style={{ padding: "10px", color: "#e2e8f0", textAlign: "right", fontWeight: "600" }}>
                              {moeda(modalHistorico.mercado)} {fmt(dia.fechamento)}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", fontWeight: "700", color: lucro ? "#4ade80" : "#f87171" }}>
                              {lucro ? "▲ +" : "▼ "}{varPct}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <button onClick={() => setModalHistorico(null)} style={{
              marginTop: "16px", padding: "10px", borderRadius: "8px", border: "1px solid #334155",
              background: "#1e293b", color: "#94a3b8", cursor: "pointer", fontWeight: "600", fontSize: "13px"
            }}>Fechar Diário</button>
          </div>
        </div>
      )}

      {/* Modal Encerrar Posição */}
      {modalEncerrar && (
        <div onClick={() => setModalEncerrar(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0d1829", border: "1px solid #1e293b", borderRadius: "16px",
            padding: "28px", maxWidth: "420px", width: "100%"
          }}>
            <h3 style={{ color: "#f59e0b", margin: "0 0 8px 0" }}>🏁 Encerrar Posição</h3>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px 0" }}>
              {modalEncerrar.ticker} — {modalEncerrar.quantidade} cotas @ {moeda(modalEncerrar.mercado)} {fmt(modalEncerrar.preco_entrada)}
            </p>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px" }}>Preço de saída:</p>
            <input
              type="number"
              value={precoSaida}
              onChange={e => setPrecoSaida(e.target.value)}
              placeholder="Ex: 85.50"
              style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                border: "1px solid #334155", background: "#0f172a",
                color: "#f1f5f9", fontSize: "14px", marginBottom: "16px", boxSizing: "border-box"
              }}
            />
            {precoSaida && (
              <div style={{
                padding: "12px", borderRadius: "8px", marginBottom: "16px",
                background: (parseFloat(precoSaida) - modalEncerrar.preco_entrada) >= 0
                  ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)"
              }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>Resultado estimado:</p>
                <p style={{
                  margin: "4px 0 0 0", fontSize: "18px", fontWeight: "800",
                  color: (parseFloat(precoSaida) - modalEncerrar.preco_entrada) >= 0 ? "#4ade80" : "#f87171"
                }}>
                  {moeda(modalEncerrar.mercado)} {fmt((parseFloat(precoSaida) - modalEncerrar.preco_entrada) * modalEncerrar.quantidade)}
                  {" "}({((parseFloat(precoSaida) - modalEncerrar.preco_entrada) / modalEncerrar.preco_entrada * 100).toFixed(2)}%)
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={encerrarPosicao} style={{
                flex: 1, padding: "12px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", fontWeight: "700", fontSize: "13px"
              }}>✅ Confirmar Encerramento</button>
              <button onClick={() => { setModalEncerrar(null); setPrecoSaida("") }} style={{
                padding: "12px 16px", borderRadius: "8px", border: "1px solid #334155",
                cursor: "pointer", background: "#1e293b", color: "#94a3b8", fontSize: "13px"
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h2 style={{ color:"#38bdf8", margin:"0 0 4px 0", fontSize:"22px", fontWeight:"800" }}>💼 Portfólio</h2>
          {ultimaAtualizacao && (
            <span style={{ color:"#64748b", fontSize:"12px" }}>Preços atualizados às {ultimaAtualizacao}</span>
          )}
        </div>
        {posicoes.length > 0 && (
          <button onClick={atualizarPrecos} disabled={atualizando} style={{
            padding:"9px 20px", borderRadius:"8px", border:"none", cursor:"pointer",
            background: atualizando ? "#334155" : "linear-gradient(135deg,#38bdf8,#0ea5e9)",
            color: atualizando ? "#94a3b8" : "#0f172a",
            fontWeight:"bold", fontSize:"13px", minWidth: "160px",
            boxShadow: atualizando ? "none" : "0 2px 8px rgba(56,189,248,0.3)"
          }}>
            {atualizando ? (
              <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <span style={{
                  width: "12px", height: "12px", border: "2px solid #94a3b8",
                  borderTopColor: "transparent", borderRadius: "50%",
                  display: "inline-block", animation: "spin 0.8s linear infinite"
                }} />
                Atualizando...
              </span>
            ) : "🔄 Atualizar Preços"}
          </button>
        )}
      </div>

      {/* Cards resumo segmentados */}
      <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
        {[
          { label:"Patrimônio B3 (Investido / Atual)", valor:`R$ ${fmt(invB3)} / R$ ${fmt(atuB3)}`, cor:"#22c55e", bg:"rgba(34,197,94,0.04)" },
          { label:"Lucro em Aberto B3", valor:`R$ ${fmt(lucroB3)} (${lucroB3Pct}%)`, cor: lucroB3 >= 0 ? "#4ade80" : "#f87171", bg:"rgba(34,197,94,0.08)" },
          { label:"Patrimônio Intl (Investido / Atual)", valor:`US$ ${fmt(invIntl)} / US$ ${fmt(atuIntl)}`, cor:"#38bdf8", bg:"rgba(56,189,248,0.04)" },
          { label:"Lucro em Aberto Intl", valor:`US$ ${fmt(lucroIntl)} (${lucroIntlPct}%)`, cor: lucroIntl >= 0 ? "#4ade80" : "#f87171", bg:"rgba(56,189,248,0.08)" },
          { label:"Lucro Realizado (BR / US)", valor:`R$ ${fmt(lucroRealizadoBR)} | US$ ${fmt(lucroRealizadoUS)}`, cor:"#a78bfa", bg:"rgba(167,139,250,0.08)" },
        ].map((card, i) => (
          <div key={i} style={{
            background:card.bg, border:`1px solid ${card.cor}20`,
            padding:"16px 20px", borderRadius:"12px", minWidth:"180px", flex:1, textAlign:"center"
          }}>
            <p style={{ color:"#64748b", fontSize:"11px", margin:"0 0 6px 0", fontWeight:"500" }}>{card.label}</p>
            <p style={{ color:card.cor, fontSize:"16px", fontWeight:"800", margin:0 }}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de Barras Horizontais */}
      {posicoes.length > 0 && (
        <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"20px", borderRadius:"12px", marginBottom:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
            <h3 style={{ color:"#94a3b8", fontSize:"13px", fontWeight:"600", letterSpacing:"0.05em", margin:0 }}>
              📊 DISTRIBUIÇÃO NOMINAL DO PORTFÓLIO
            </h3>
            <div style={{ display:"flex", gap:"6px" }}>
              {["ativo", "setor"].map(modo => (
                <button key={modo} onClick={() => setModoGrafico(modo)} style={{
                  padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
                  fontSize:"12px", fontWeight: modoGrafico === modo ? "700" : "400",
                  background: modoGrafico === modo ? "#38bdf8" : "#1e293b",
                  color: modoGrafico === modo ? "#0f172a" : "#64748b",
                  transition:"all 0.2s"
                }}>
                  {modo === "ativo" ? "Por Ativo" : "Por Setor"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {dadosGrafico
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((item, i) => {
                const maxVal = Math.max(...dadosGrafico.map(d => d.value))
                const pct = totalFicticioGrafico > 0
                  ? ((item.value / totalFicticioGrafico) * 100).toFixed(1)
                  : 0
                const largura = maxVal > 0 ? (item.value / maxVal) * 100 : 0
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <div style={{ width:"90px", textAlign:"right", flexShrink:0 }}>
                      <span style={{ color:"#e2e8f0", fontSize:"12px", fontWeight:"700" }}>{item.name}</span>
                    </div>
                    <div style={{ flex:1, background:"#1e293b", borderRadius:"4px", height:"22px", position:"relative" }}>
                      <div style={{
                        width:`${largura}%`, height:"100%", borderRadius:"4px",
                        background: CORES[i % CORES.length],
                        transition:"width 0.4s ease",
                        minWidth: largura > 0 ? "4px" : "0"
                      }} />
                    </div>
                    <div style={{ width:"50px", flexShrink:0, textAlign:"right" }}>
                      <span style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"600" }}>{pct}%</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Sub-abas */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
        {[
          { id: "abertas", label: "💼 Posições Abertas", count: posicoes.length },
          { id: "historico", label: "📜 Histórico de Trades", count: historico.length }
        ].map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)} style={{
            padding:"8px 20px", borderRadius:"8px", border:"none", cursor:"pointer",
            fontSize:"13px", fontWeight: abaAtiva === a.id ? "700" : "400",
            background: abaAtiva === a.id ? "rgba(56,189,248,0.15)" : "#1e293b",
            color: abaAtiva === a.id ? "#38bdf8" : "#64748b",
            borderBottom: abaAtiva === a.id ? "2px solid #38bdf8" : "2px solid transparent",
          }}>
            {a.label} <span style={{ marginLeft:"6px", background:"#1e293b", padding:"2px 8px", borderRadius:"10px", fontSize:"11px" }}>{a.count}</span>
          </button>
        ))}
      </div>

      {/* ABA: Posições Abertas */}
      {abaAtiva === "abertas" && (
        <>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{
            padding:"9px 20px", borderRadius:"8px", cursor:"pointer",
            background: mostrarForm ? "#334155" : "#1e293b",
            color: mostrarForm ? "#94a3b8" : "#38bdf8",
            fontWeight:"bold", marginBottom:"16px", fontSize:"13px",
            border:"1px solid #334155"
          }}>
            {mostrarForm ? "✕ Cancelar" : "+ Adicionar Posição"}
          </button>

          {mostrarForm && (
            <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"16px",
              borderRadius:"12px", marginBottom:"16px", display:"flex", gap:"12px", flexWrap:"wrap" }}>
              {[
                { key:"ticker", placeholder:"Ticker (ex: VALE3.SA)" },
                { key:"nome", placeholder:"Nome (ex: Vale)" },
                { key:"quantidade", placeholder:"Quantidade", type:"number" },
                { key:"preco_entrada", placeholder:"Preço de Entrada", type:"number" },
              ].map(f => (
                <input key={f.key} type={f.type||"text"} placeholder={f.placeholder}
                  value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                  style={{ padding:"10px", borderRadius:"6px", border:"1px solid #334155",
                    background:"#0f172a", color:"#f1f5f9", fontSize:"13px", flex:1, minWidth:"150px" }} />
              ))}
              <select value={form.mercado} onChange={e => setForm({...form, mercado: e.target.value})}
                style={{ padding:"10px", borderRadius:"6px", border:"1px solid #334155",
                  background:"#0f172a", color:"#f1f5f9", fontSize:"13px" }}>
                <option value="B3">B3</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="NYSE">NYSE</option>
                <option value="CRYPTO">CRYPTO</option>
                <option value="COMMODITY">COMMODITY</option>
              </select>
              <button onClick={adicionar} style={{
                padding:"10px 20px", borderRadius:"6px", border:"none", cursor:"pointer",
                background:"linear-gradient(135deg,#16a34a,#15803d)", color:"white", fontWeight:"bold", fontSize:"13px"
              }}>Adicionar</button>
            </div>
          )}

          {carregando ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"15px" }}>Carregando portfólio...</p>
            </div>
          ) : posicoes.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"40px", marginBottom:"12px" }}>📭</p>
              <p style={{ fontSize:"15px", marginBottom:"8px" }}>Nenhuma posição aberta</p>
              <p style={{ fontSize:"13px" }}>Adicione uma posição ou clique em "+ Portfólio" na aba Mercado</p>
            </div>
          ) : (
            <div style={{ overflowX:"auto", borderRadius:"12px", border:"1px solid #1e293b" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#0a1520" }}>
                    {["Ticker","Nome","Mercado","Setor","Qtd","Entrada","Valor Invest.","Preço Atual","Valor Atual","P&L","Alvo/Stop","Dias","Ações"].map(h => (
                      <th key={h} style={{ padding:"14px 14px", textAlign:"left", color:"#64748b",
                        fontSize:"10px", fontWeight:"700", letterSpacing:"0.05em",
                        borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ opacity: atualizando ? 0.4 : 1, transition: "opacity 0.3s" }}>
                  {posicoes.map((p, i) => {
                    const pl = (p.preco_atual - p.preco_entrada) * p.quantidade
                    const plPct = ((p.preco_atual - p.preco_entrada) / p.preco_entrada * 100).toFixed(2)
                    const valorInvestido = p.quantidade * p.preco_entrada
                    const valorAtual = p.quantidade * p.preco_atual
                    const alvo = p.alvo_lucro || (p.preco_entrada * 1.05)
                    const stop = p.stop_loss || (p.preco_entrada * 0.98)
                    const pctAlvo = p.pct_alvo || ((alvo - p.preco_entrada) / p.preco_entrada * 100)
                    const pctStop = p.pct_stop || ((p.preco_entrada - stop) / p.preco_entrada * 100)
                    const progressoAlvo = Math.min(Math.max(((p.preco_atual - stop) / (alvo - stop)) * 100, 0), 100)
                    const dias = diasNaOperacao(p.data)
                    const estaEditando = editando === i
                    const emLucro = pl >= 0
                    const setor = getSetor(p.ticker)
                    return (
                      <tr key={i} style={{
                        borderBottom:"1px solid #0f172a",
                        background: estaEditando ? "#1e3a4a" : i % 2 === 0 ? "#0d1829" : "#0a1520",
                        transition:"background 0.15s"
                      }}
                      onMouseEnter={e => { if (!estaEditando) e.currentTarget.style.background = "#1e293b" }}
                      onMouseLeave={e => { if (!estaEditando) e.currentTarget.style.background = i % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                        <td style={{ padding:"14px 14px", fontWeight:"700", color:"#38bdf8", fontSize:"13px", whiteSpace:"nowrap" }}>
                          {p.ticker}
                          <div style={{ marginTop:"3px" }}>
                            <span style={{
                              fontSize:"9px", fontWeight:"700", padding:"2px 6px", borderRadius:"4px",
                              background: p.origem === "swing" ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)",
                              color: p.origem === "swing" ? "#f59e0b" : "#38bdf8"
                            }}>
                              {p.origem === "swing" ? "⚡ Swing" : "📈 Longo"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px", whiteSpace:"nowrap" }}>{p.nome}</td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ padding:"2px 7px", borderRadius:"12px", fontSize:"10px", fontWeight:"600",
                            background: p.mercado==="B3" ? "rgba(34,197,94,0.15)" : "rgba(56,189,248,0.15)",
                            color: p.mercado==="B3" ? "#22c55e" : "#38bdf8" }}>
                            {p.mercado}
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ padding:"2px 7px", borderRadius:"12px", fontSize:"10px", fontWeight:"600",
                            background:"rgba(167,139,250,0.15)", color:"#a78bfa" }}>
                            {setor}
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>
                          {estaEditando ? (
                            <input type="number" value={editForm.quantidade}
                              onChange={e => setEditForm({...editForm, quantidade: e.target.value})}
                              style={{ width:"60px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8",
                                background:"#0f172a", color:"#f1f5f9", fontSize:"12px" }} />
                          ) : p.quantidade}
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>
                          {estaEditando ? (
                            <input type="number" value={editForm.preco_entrada}
                              onChange={e => setEditForm({...editForm, preco_entrada: e.target.value})}
                              style={{ width:"80px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8",
                                background:"#0f172a", color:"#f1f5f9", fontSize:"12px" }} />
                          ) : `${moeda(p.mercado)} ${fmt(p.preco_entrada)}`}
                        </td>
                        <td style={{ padding:"14px 14px", color:"#94a3b8", fontSize:"12px" }}>
                          {moeda(p.mercado)} {fmt(valorInvestido)}
                        </td>
                        <td style={{ padding:"14px 14px", fontWeight:"600", fontSize:"12px" }}>
                          <span style={{ color: "#e2e8f0" }}>
                            {moeda(p.mercado)} {fmt(p.preco_atual)}
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px", color: emLucro ? "#4ade80" : "#f87171", fontSize:"12px", fontWeight:"600" }}>
                          {moeda(p.mercado)} {fmt(valorAtual)}
                        </td>
                        <td style={{ padding:"14px 14px", whiteSpace:"nowrap" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                            <span style={{ color: emLucro ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                              {emLucro ? "▲" : "▼"} {moeda(p.mercado)} {fmt(Math.abs(pl))}
                            </span>
                            <span style={{
                              fontSize:"10px", fontWeight:"700",
                              color: emLucro ? "#4ade80" : "#f87171",
                              background: emLucro ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                              padding:"2px 6px", borderRadius:"4px",
                              width:"fit-content", display:"inline-block"
                            }}>
                              {emLucro ? "+" : ""}{plPct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"14px 14px", minWidth:"110px" }}>
                          <div style={{ fontSize:"9px", color:"#64748b", marginBottom:"3px", display:"flex", justifyContent:"space-between" }}>
                            <span style={{ color:"#f87171" }}>
                              Stop {fmt(stop)} ({pctStop >= 0 ? "-" : "+"}{Math.abs(pctStop).toFixed(1)}%)
                            </span>
                            <span style={{ color:"#4ade80" }}>
                              Alvo {fmt(alvo)} (+{pctAlvo.toFixed(1)}%)
                            </span>
                          </div>
                          <div style={{ background:"#1e293b", borderRadius:"4px", height:"6px", width:"100%", position:"relative" }}>
                            <div style={{
                              background: progressoAlvo > 50 ? "#4ade80" : progressoAlvo > 20 ? "#f59e0b" : "#f87171",
                              borderRadius:"4px", height:"6px", width:`${progressoAlvo}%`,
                              transition:"width 0.3s"
                            }}/>
                          </div>
                          <div style={{ fontSize:"9px", color:"#64748b", marginTop:"2px", textAlign:"center" }}>
                            {progressoAlvo.toFixed(0)}% do caminho
                          </div>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{
                            color: dias > 3 ? "#f87171" : dias > 1 ? "#f59e0b" : "#4ade80",
                            fontSize:"12px", fontWeight:"700"
                          }}>
                            {dias}d
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                            {estaEditando ? (
                              <>
                                <button onClick={() => salvarEdicao(i)} style={{
                                  padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer",
                                  background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600" }}>✓</button>
                                <button onClick={() => setEditando(null)} style={{
                                  padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer",
                                  background:"#334155", color:"white", fontSize:"11px" }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => abrirHistoricoAtivo(p)} style={{
                                  padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer",
                                  background:"#0ea5e9", color:"white", fontSize:"11px", fontWeight:"600" }} title="Ver Diário de Preços">📈</button>
                                <button onClick={() => setModalEncerrar({idx: i, ...p})} style={{
                                  padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer",
                                  background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600",
                                  whiteSpace:"nowrap" }}>🏁</button>
                                <button onClick={() => iniciarEdicao(i)} style={{
                                  padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer",
                                  background:"#d97706", color:"white", fontSize:"11px" }}>✏️</button>
                                <button onClick={() => {
                                  if (window.confirm(`Remover ${p.ticker} sem registrar no histórico?`)) remover(i)
                                }} style={{
                                  padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer",
                                  background:"#dc2626", color:"white", fontSize:"11px" }}>🗑️</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ABA: Histórico de Trades */}
      {abaAtiva === "historico" && (
        <>
          {historico.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"40px", marginBottom:"12px" }}>📜</p>
              <p style={{ fontSize:"15px", marginBottom:"8px" }}>Nenhuma operação encerrada</p>
              <p style={{ fontSize:"13px" }}>Quando encerrar uma posição, ela aparecerá aqui com o resultado</p>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", gap:"12px", marginBottom:"16px", flexWrap:"wrap" }}>
                {[
                  { label:"Total de Trades", valor: historico.length, cor:"#38bdf8" },
                  { label:"Trades Lucrativos", valor: historico.filter(h => h.pl >= 0).length, cor:"#4ade80" },
                  { label:"Trades com Prejuízo", valor: historico.filter(h => h.pl < 0).length, cor:"#f87171" },
                  { label:"P&L Total Realizado (BR / US)", valor:`R$ ${fmt(lucroRealizadoBR)} | US$ ${fmt(lucroRealizadoUS)}`,
                    cor: (lucroRealizadoBR + lucroRealizadoUS) >= 0 ? "#4ade80" : "#f87171" },
                ].map((card, i) => (
                  <div key={i} style={{
                    background:"rgba(255,255,255,0.03)", border:"1px solid #1e293b",
                    padding:"12px 16px", borderRadius:"10px", flex:1, minWidth:"120px", textAlign:"center"
                  }}>
                    <p style={{ color:"#64748b", fontSize:"11px", margin:"0 0 4px 0" }}>{card.label}</p>
                    <p style={{ color:card.cor, fontSize:"16px", fontWeight:"800", margin:0 }}>{card.valor}</p>
                  </div>
                ))}
              </div>
              <div style={{ overflowX:"auto", borderRadius:"12px", border:"1px solid #1e293b" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#0a1520" }}>
                      {["Ticker","Nome","Qtd","Entrada","Saída","P&L","Retorno","Dias","Data Saída"].map(h => (
                        <th key={h} style={{ padding:"14px 14px", textAlign:"left", color:"#64748b",
                          fontSize:"10px", fontWeight:"700", letterSpacing:"0.05em",
                          borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>
                          {h.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h, i) => (
                      <tr key={i} style={{
                        borderBottom:"1px solid #0f172a",
                        background: i % 2 === 0 ? "#0d1829" : "#0a1520"
                      }}>
                        <td style={{ padding:"14px 14px", fontWeight:"700", color:"#38bdf8", fontSize:"13px" }}>{h.ticker}</td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>{h.nome}</td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>{h.quantidade}</td>
                        <td style={{ padding:"14px 14px", color:"#94a3b8", fontSize:"12px" }}>
                          {moeda(h.mercado)} {fmt(h.preco_entrada)}
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px", fontWeight:"600" }}>
                          {moeda(h.mercado)} {fmt(h.preco_saida)}
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ color: h.pl >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                            {h.pl >= 0 ? "▲" : "▼"} {moeda(h.mercado)} {fmt(Math.abs(h.pl))}
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{
                            padding:"3px 8px", borderRadius:"12px", fontSize:"11px", fontWeight:"700",
                            background: h.pl >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                            color: h.pl >= 0 ? "#4ade80" : "#f87171"
                          }}>
                            {h.pl >= 0 ? "+" : ""}{h.pl_pct}%
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#94a3b8", fontSize:"12px" }}>{h.dias}d</td>
                        <td style={{ padding:"14px 14px", color:"#475569", fontSize:"11px" }}>{h.data_saida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
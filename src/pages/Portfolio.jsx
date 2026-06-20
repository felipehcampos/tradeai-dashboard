import { useState, useEffect } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, BarChart, Bar, Cell } from "recharts"
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
    } else { return 0 }
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
  const [cotacaoDolar, setCotacaoDolar] = useState(null)
  const [filtroOrigem, setFiltroOrigem] = useState("todos")

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

  const buscarCotacaoDolar = async () => {
    try {
      const res = await fetch("https://brapi.dev/api/v2/currency?currency=USD-BRL")
      const data = await res.json()
      const cotacao = data?.currency?.[0]?.bidPrice
      if (cotacao) setCotacaoDolar(parseFloat(cotacao))
    } catch {
      console.error("Erro ao buscar cotação do dólar")
    }
  }

  useEffect(() => {
    carregarPortfolio()
    buscarCotacaoDolar()
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
        const dados = res.data.dados || []
        setDadosHistorico(dados)
        if (dados.length > 0) {
          const ultimoFechamento = dados[dados.length - 1].fechamento
          setPosicoes(prev => prev.map(pos =>
            pos.ticker === p.ticker ? { ...pos, preco_atual: ultimoFechamento } : pos
          ))
          setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
        }
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

  const apagarHistorico = (i) => {
    if (!window.confirm("Apagar este trade do histórico?")) return
    const novoHist = historico.filter((_, idx) => idx !== i)
    setHistorico(novoHist)
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(novoHist))
  }

  const apagarTodoHistorico = () => {
    if (!window.confirm("Apagar TODO o histórico de trades? Esta ação não pode ser desfeita.")) return
    setHistorico([])
    localStorage.removeItem(HISTORICO_KEY)
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
        ticker: p.ticker, nome: p.nome, mercado: p.mercado,
        quantidade: parseFloat(editForm.quantidade),
        preco_medio: parseFloat(editForm.preco_entrada),
        alvo_lucro: p.alvo_lucro, stop_loss: p.stop_loss,
        pct_alvo: p.pct_alvo, pct_stop: p.pct_stop, origem: p.origem
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
        ticker: p.ticker, nome: p.nome, mercado: p.mercado,
        quantidade: p.quantidade, preco_entrada: p.preco_entrada,
        preco_saida: saida, pl, pl_pct: plPct,
        data_entrada: p.data,
        data_saida: new Date().toLocaleDateString("pt-BR"),
        dias: diasNaOperacao(p.data),
        origem: p.origem || "manual"
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
    buscarCotacaoDolar()
    try {
      const tickers = posicoes.map(p => p.ticker)
      const res = await api.post(`${API}/precos`, { tickers })
      if (res.data.sucesso) {
        const precos = res.data.precos
        const precosNormalizados = {}
        Object.keys(precos).forEach(key => {
          if (precos[key] != null) precosNormalizados[key.toUpperCase().trim()] = precos[key]
        })
        const novas = posicoes.map(p => {
          const precoValido = precosNormalizados[p.ticker.toUpperCase().trim()]
          return { ...p, preco_atual: precoValido != null ? parseFloat(precoValido) : p.preco_atual }
        })
        setPosicoes([...novas])
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      alert("Erro ao atualizar preços.")
    } finally {
      setAtualizando(false)
    }
  }

  const moeda = (mercado) => mercado === "B3" ? "R$" : "US$"

  const posicoesFiltradas = filtroOrigem === "todos"
    ? posicoes
    : posicoes.filter(p => filtroOrigem === "swing" ? p.origem === "swing" : p.origem !== "swing")

  // ── CÁLCULOS FINANCEIROS ──
  const invB3 = posicoes.filter(p=>p.mercado==="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)
  const atuB3 = posicoes.filter(p=>p.mercado==="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_atual, 0)
  const lucroAbertoB3 = atuB3 - invB3

  const invIntl = posicoes.filter(p=>p.mercado!=="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)
  const atuIntl = posicoes.filter(p=>p.mercado!=="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_atual, 0)
  const lucroAbertoIntl = atuIntl - invIntl

  const dolar = cotacaoDolar || 5.7 // fallback caso API falhe
  const patrimonioTotalBRL = atuB3 + (atuIntl * dolar)
  const lucroAbertoBRL = lucroAbertoB3 + (lucroAbertoIntl * dolar)

  const lucroRealizadoBR = historico.filter(h=>h.mercado==="B3").reduce((acc,h)=>acc+h.pl, 0)
  const lucroRealizadoUS = historico.filter(h=>h.mercado!=="B3").reduce((acc,h)=>acc+h.pl, 0)
  const lucroRealizadoBRL = lucroRealizadoBR + (lucroRealizadoUS * dolar)

  const resultadoTotalBRL = lucroAbertoBRL + lucroRealizadoBRL

  // Média % dos trades encerrados
  const mediaRetorno = historico.length > 0
    ? (historico.reduce((acc, h) => acc + parseFloat(h.pl_pct), 0) / historico.length).toFixed(2)
    : null

  const taxaAcerto = historico.length > 0
    ? ((historico.filter(h => h.pl >= 0).length / historico.length) * 100).toFixed(0)
    : null

  const totalFicticioGrafico = posicoesFiltradas.reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)

  const dadosPorAtivo = posicoesFiltradas.map(p => ({
    name: p.ticker,
    value: parseFloat((p.quantidade * p.preco_entrada).toFixed(2)),
    percent: totalFicticioGrafico > 0 ? ((p.quantidade * p.preco_entrada / totalFicticioGrafico) * 100).toFixed(1) : 0
  }))

  const dadosPorSetor = Object.entries(
    posicoesFiltradas.reduce((acc, p) => {
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

  // ── PERFORMANCE MENSAL: corrigido para usar data_saida no formato DD/MM/AAAA ──
  const historicoMensal = historico.reduce((acc, h) => {
    if (!h.data_saida) return acc
    const partes = h.data_saida.split("/")
    if (partes.length < 3) return acc
    const dia = partes[0], mes = partes[1], ano = partes[2]
    const chave = `${ano}-${mes}` // chave para ordenar corretamente
    const label = new Date(`${ano}-${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    if (!acc[chave]) acc[chave] = { mes: label, chave, pl_br: 0, pl_us: 0, trades: 0, lucrativos: 0 }
    if (h.mercado === "B3") acc[chave].pl_br += parseFloat(h.pl)
    else acc[chave].pl_us += parseFloat(h.pl)
    acc[chave].trades++
    if (parseFloat(h.pl) >= 0) acc[chave].lucrativos++
    return acc
  }, {})
  const dadosMensais = Object.values(historicoMensal).sort((a, b) => a.chave.localeCompare(b.chave))

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Modal Histórico de Preços */}
      {modalHistorico && (
        <div onClick={() => setModalHistorico(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"16px", padding:"24px", maxWidth:"560px", width:"100%", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
              <h3 style={{ color:"#38bdf8", margin:0, fontSize:"18px", fontWeight:"800" }}>📈 Histórico — {modalHistorico.ticker}</h3>
              <button onClick={() => setModalHistorico(null)} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"16px" }}>✕</button>
            </div>
            <p style={{ color:"#64748b", fontSize:"12px", margin:"0 0 16px 0" }}>
              Preço de Entrada Original: <strong style={{ color:"#e2e8f0" }}>{moeda(modalHistorico.mercado)} {fmt(modalHistorico.preco_entrada)}</strong>
            </p>
            {carregandoHist ? (
              <div style={{ textAlign:"center", padding:"40px", color:"#64748b" }}>
                <span style={{ width:"24px", height:"24px", border:"2px solid #38bdf8", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite", marginBottom:"12px" }} />
                <p style={{ fontSize:"13px" }}>Buscando histórico diário...</p>
              </div>
            ) : dadosHistorico.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px", color:"#64748b" }}>
                <p style={{ fontSize:"13px" }}>Nenhum dado encontrado.</p>
              </div>
            ) : (
              <>
                <div style={{ background:"#060d1a", borderRadius:"8px", padding:"12px 12px 0 0", marginBottom:"16px" }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={dadosHistorico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="data" stroke="#475569" strokeWidth={0.5} style={{ fontSize:"10px" }} />
                      <YAxis stroke="#475569" strokeWidth={0.5} style={{ fontSize:"10px" }} domain={['auto','auto']} />
                      <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"6px", fontSize:"12px" }}
                        formatter={(value) => [`${moeda(modalHistorico.mercado)} ${fmt(value)}`, "Fechamento"]} />
                      <ReferenceLine y={modalHistorico.preco_entrada} stroke="#f59e0b" strokeDasharray="3 3" label={{ value:'Entrada', fill:'#f59e0b', fontSize:10, position:'insideTopLeft' }} />
                      <Line type="monotone" dataKey="fechamento" stroke="#38bdf8" strokeWidth={2} dot={{ r:3, strokeWidth:1 }} activeDot={{ r:5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ overflowY:"auto", flex:1, border:"1px solid #1e293b", borderRadius:"8px" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                    <thead>
                      <tr style={{ background:"#0a1520", position:"sticky", top:0, zIndex:1 }}>
                        <th style={{ padding:"10px", color:"#64748b", textAlign:"left" }}>DATA</th>
                        <th style={{ padding:"10px", color:"#64748b", textAlign:"right" }}>FECHAMENTO</th>
                        <th style={{ padding:"10px", color:"#64748b", textAlign:"right" }}>P&L DESDE ENTRADA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosHistorico.map((dia, idx) => {
                        const varPct = ((dia.fechamento - modalHistorico.preco_entrada) / modalHistorico.preco_entrada * 100).toFixed(2)
                        const lucro = dia.fechamento >= modalHistorico.preco_entrada
                        return (
                          <tr key={idx} style={{ borderBottom:"1px solid #1e293b", background: idx % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                            <td style={{ padding:"10px", color:"#94a3b8" }}>{dia.data}</td>
                            <td style={{ padding:"10px", color:"#e2e8f0", textAlign:"right", fontWeight:"600" }}>{moeda(modalHistorico.mercado)} {fmt(dia.fechamento)}</td>
                            <td style={{ padding:"10px", textAlign:"right", fontWeight:"700", color: lucro ? "#4ade80" : "#f87171" }}>
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
            <button onClick={() => setModalHistorico(null)} style={{ marginTop:"16px", padding:"10px", borderRadius:"8px", border:"1px solid #334155", background:"#1e293b", color:"#94a3b8", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal Encerrar Posição */}
      {modalEncerrar && (
        <div onClick={() => setModalEncerrar(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"16px", padding:"28px", maxWidth:"420px", width:"100%" }}>
            <h3 style={{ color:"#f59e0b", margin:"0 0 8px 0" }}>🏁 Encerrar Posição</h3>
            <p style={{ color:"#64748b", fontSize:"13px", margin:"0 0 20px 0" }}>
              {modalEncerrar.ticker} — {modalEncerrar.quantidade} cotas @ {moeda(modalEncerrar.mercado)} {fmt(modalEncerrar.preco_entrada)}
            </p>
            <p style={{ color:"#94a3b8", fontSize:"13px", marginBottom:"8px" }}>Preço de saída:</p>
            <input type="number" value={precoSaida} onChange={e => setPrecoSaida(e.target.value)} placeholder="Ex: 85.50"
              style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid #334155", background:"#0f172a", color:"#f1f5f9", fontSize:"14px", marginBottom:"16px", boxSizing:"border-box" }} />
            {precoSaida && (
              <div style={{ padding:"12px", borderRadius:"8px", marginBottom:"16px", background: (parseFloat(precoSaida) - modalEncerrar.preco_entrada) >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)" }}>
                <p style={{ margin:0, fontSize:"13px", color:"#94a3b8" }}>Resultado estimado:</p>
                <p style={{ margin:"4px 0 0 0", fontSize:"18px", fontWeight:"800", color: (parseFloat(precoSaida) - modalEncerrar.preco_entrada) >= 0 ? "#4ade80" : "#f87171" }}>
                  {moeda(modalEncerrar.mercado)} {fmt((parseFloat(precoSaida) - modalEncerrar.preco_entrada) * modalEncerrar.quantidade)}
                  {" "}({((parseFloat(precoSaida) - modalEncerrar.preco_entrada) / modalEncerrar.preco_entrada * 100).toFixed(2)}%)
                </p>
              </div>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={encerrarPosicao} style={{ flex:1, padding:"12px", borderRadius:"8px", border:"none", cursor:"pointer", background:"linear-gradient(135deg,#16a34a,#15803d)", color:"white", fontWeight:"700", fontSize:"13px" }}>✅ Confirmar</button>
              <button onClick={() => { setModalEncerrar(null); setPrecoSaida("") }} style={{ padding:"12px 16px", borderRadius:"8px", border:"1px solid #334155", cursor:"pointer", background:"#1e293b", color:"#94a3b8", fontSize:"13px" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h2 style={{ color:"#38bdf8", margin:"0 0 4px 0", fontSize:"22px", fontWeight:"800" }}>💼 Portfólio</h2>
          <div style={{ display:"flex", gap:"12px", alignItems:"center", flexWrap:"wrap" }}>
            {ultimaAtualizacao && <span style={{ color:"#64748b", fontSize:"12px" }}>Atualizado às {ultimaAtualizacao}</span>}
            {cotacaoDolar && (
              <span style={{ padding:"3px 10px", borderRadius:"6px", background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", fontSize:"12px", color:"#94a3b8" }}>
                💵 USD/BRL: <strong style={{ color:"#38bdf8" }}>R$ {cotacaoDolar.toFixed(2)}</strong>
              </span>
            )}
          </div>
        </div>
        {posicoes.length > 0 && (
          <button onClick={atualizarPrecos} disabled={atualizando} style={{
            padding:"9px 20px", borderRadius:"8px", border:"none", cursor:"pointer",
            background: atualizando ? "#334155" : "linear-gradient(135deg,#38bdf8,#0ea5e9)",
            color: atualizando ? "#94a3b8" : "#0f172a", fontWeight:"bold", fontSize:"13px", minWidth:"160px",
            boxShadow: atualizando ? "none" : "0 2px 8px rgba(56,189,248,0.3)"
          }}>
            {atualizando ? (
              <span style={{ display:"flex", alignItems:"center", gap:"8px", justifyContent:"center" }}>
                <span style={{ width:"12px", height:"12px", border:"2px solid #94a3b8", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }} />
                Atualizando...
              </span>
            ) : "🔄 Atualizar Preços"}
          </button>
        )}
      </div>

      {/* ── LINHA 1: VISÃO CONSOLIDADA ── */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
        {[
          {
            label: "💼 Patrimônio Total",
            valor: `R$ ${fmt(patrimonioTotalBRL)}`,
            sub: cotacaoDolar ? `B3 + Intl convertido (USD ${fmt(cotacaoDolar)})` : "B3 + Intl convertido",
            cor: "#38bdf8", bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.2)"
          },
          {
            label: "📈 Lucro em Aberto",
            valor: `R$ ${fmt(lucroAbertoBRL)}`,
            pct: patrimonioTotalBRL > 0 ? ` (${(lucroAbertoBRL / (patrimonioTotalBRL - lucroAbertoBRL) * 100).toFixed(1)}%)` : "",
            sub: `B3: R$ ${fmt(lucroAbertoB3)} | Intl: US$ ${fmt(lucroAbertoIntl)}`,
            cor: lucroAbertoBRL >= 0 ? "#4ade80" : "#f87171",
            bg: lucroAbertoBRL >= 0 ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
            border: lucroAbertoBRL >= 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"
          },
          {
            label: "✅ Lucro Realizado",
            valor: `R$ ${fmt(lucroRealizadoBRL)}`,
            pct: mediaRetorno ? ` (média ${parseFloat(mediaRetorno) >= 0 ? "+" : ""}${mediaRetorno}%/trade)` : "",
            sub: `BR: R$ ${fmt(lucroRealizadoBR)} | US: US$ ${fmt(lucroRealizadoUS)}`,
            cor: lucroRealizadoBRL >= 0 ? "#4ade80" : "#f87171",
            bg: lucroRealizadoBRL >= 0 ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
            border: lucroRealizadoBRL >= 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"
          },
          {
            label: "💰 Resultado Total",
            valor: `R$ ${fmt(resultadoTotalBRL)}`,
            pct: patrimonioTotalBRL > 0 ? ` (${(resultadoTotalBRL / (patrimonioTotalBRL - resultadoTotalBRL) * 100).toFixed(1)}%)` : "",
            sub: "Aberto + Realizado em R$",
            cor: resultadoTotalBRL >= 0 ? "#a78bfa" : "#f87171",
            bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.2)"
          },
        ].map((card, i) => (
          <div key={i} style={{ background:card.bg, border:`1px solid ${card.border}`, padding:"14px 18px", borderRadius:"12px", flex:1, minWidth:"180px" }}>
            <p style={{ color:"#64748b", fontSize:"11px", margin:"0 0 4px 0", fontWeight:"500" }}>{card.label}</p>
            <p style={{ color:card.cor, fontSize:"18px", fontWeight:"800", margin:"0 0 2px 0" }}>
              {card.valor}
              {card.pct && <span style={{ fontSize:"12px", fontWeight:"600", opacity:0.8 }}>{card.pct}</span>}
            </p>
            <p style={{ color:"#475569", fontSize:"10px", margin:0 }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── LINHA 2: ESTATÍSTICAS DE TRADES ── */}
      {historico.length > 0 && (
        <div style={{ display:"flex", gap:"10px", marginBottom:"24px", flexWrap:"wrap" }}>
          {[
            {
              label: "🎯 Taxa de Acerto",
              valor: `${taxaAcerto}%`,
              sub: `${historico.filter(h=>h.pl>=0).length} lucro / ${historico.filter(h=>h.pl<0).length} prejuízo`,
              cor: parseFloat(taxaAcerto) >= 60 ? "#4ade80" : parseFloat(taxaAcerto) >= 40 ? "#f59e0b" : "#f87171",
              bg: "rgba(56,189,248,0.04)", border: "rgba(56,189,248,0.15)"
            },
            {
              label: "📊 Retorno Médio por Trade",
              valor: `${parseFloat(mediaRetorno) >= 0 ? "+" : ""}${mediaRetorno}%`,
              sub: `${historico.length} trade${historico.length > 1 ? "s" : ""} encerrado${historico.length > 1 ? "s" : ""}`,
              cor: parseFloat(mediaRetorno) >= 0 ? "#4ade80" : "#f87171",
              bg: "rgba(74,222,128,0.04)", border: "rgba(74,222,128,0.15)"
            },
            {
              label: "🏆 Melhor Trade",
              valor: (() => {
                if (historico.length === 0) return "—"
                const melhor = historico.reduce((max, h) => parseFloat(h.pl_pct) > parseFloat(max.pl_pct) ? h : max, historico[0])
                return `${melhor.ticker} +${melhor.pl_pct}%`
              })(),
              sub: "maior % de retorno",
              cor: "#4ade80", bg: "rgba(74,222,128,0.04)", border: "rgba(74,222,128,0.15)"
            },
            {
              label: "📉 Pior Trade",
              valor: (() => {
                if (historico.length === 0) return "—"
                const pior = historico.reduce((min, h) => parseFloat(h.pl_pct) < parseFloat(min.pl_pct) ? h : min, historico[0])
                return `${pior.ticker} ${parseFloat(pior.pl_pct) >= 0 ? "+" : ""}${pior.pl_pct}%`
              })(),
              sub: "menor % de retorno",
              cor: "#f87171", bg: "rgba(248,113,113,0.04)", border: "rgba(248,113,113,0.15)"
            },
          ].map((card, i) => (
            <div key={i} style={{ background:card.bg, border:`1px solid ${card.border}`, padding:"14px 18px", borderRadius:"12px", flex:1, minWidth:"160px" }}>
              <p style={{ color:"#64748b", fontSize:"11px", margin:"0 0 4px 0", fontWeight:"500" }}>{card.label}</p>
              <p style={{ color:card.cor, fontSize:"17px", fontWeight:"800", margin:"0 0 2px 0" }}>{card.valor}</p>
              <p style={{ color:"#475569", fontSize:"10px", margin:0 }}>{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── GRÁFICO + FILTROS ── */}
      {posicoes.length > 0 && (
        <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"20px", borderRadius:"12px", marginBottom:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"8px" }}>
            <h3 style={{ color:"#94a3b8", fontSize:"13px", fontWeight:"600", letterSpacing:"0.05em", margin:0 }}>
              📊 DISTRIBUIÇÃO NOMINAL DO PORTFÓLIO
            </h3>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
              {["ativo","setor"].map(modo => (
                <button key={modo} onClick={() => setModoGrafico(modo)} style={{
                  padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
                  fontSize:"12px", fontWeight: modoGrafico === modo ? "700" : "400",
                  background: modoGrafico === modo ? "#38bdf8" : "#1e293b",
                  color: modoGrafico === modo ? "#0f172a" : "#64748b", transition:"all 0.2s"
                }}>
                  {modo === "ativo" ? "Por Ativo" : "Por Setor"}
                </button>
              ))}
              <div style={{ width:"1px", background:"#1e293b", margin:"0 2px" }} />
              {[{id:"todos",label:"Todos"},{id:"swing",label:"⚡ Swing"},{id:"longo",label:"📈 Longo"}].map(f => (
                <button key={f.id} onClick={() => setFiltroOrigem(f.id)} style={{
                  padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
                  fontSize:"12px", fontWeight: filtroOrigem === f.id ? "700" : "400",
                  background: filtroOrigem === f.id ? (f.id==="swing" ? "#f59e0b" : f.id==="longo" ? "#38bdf8" : "#64748b") : "#1e293b",
                  color: filtroOrigem === f.id ? "#0f172a" : "#64748b", transition:"all 0.2s"
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {dadosGrafico.slice().sort((a,b) => b.value - a.value).map((item, i) => {
              const maxVal = Math.max(...dadosGrafico.map(d => d.value))
              const pct = totalFicticioGrafico > 0 ? ((item.value / totalFicticioGrafico) * 100).toFixed(1) : 0
              const largura = maxVal > 0 ? (item.value / maxVal) * 100 : 0
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div style={{ width:"90px", textAlign:"right", flexShrink:0 }}>
                    <span style={{ color:"#e2e8f0", fontSize:"12px", fontWeight:"700" }}>{item.name}</span>
                  </div>
                  <div style={{ flex:1, background:"#1e293b", borderRadius:"4px", height:"22px" }}>
                    <div style={{ width:`${largura}%`, height:"100%", borderRadius:"4px", background:CORES[i%CORES.length], transition:"width 0.4s ease", minWidth: largura > 0 ? "4px" : "0" }} />
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

      {/* ── SUB-ABAS ── */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
        {[
          { id:"abertas", label:"💼 Posições Abertas", count: posicoesFiltradas.length },
          { id:"historico", label:"📜 Histórico de Trades", count: historico.length },
          { id:"performance", label:"📈 Performance", count: dadosMensais.length }
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

      {/* ── ABA: POSIÇÕES ABERTAS ── */}
      {abaAtiva === "abertas" && (
        <>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{
            padding:"9px 20px", borderRadius:"8px", cursor:"pointer",
            background: mostrarForm ? "#334155" : "#1e293b", color: mostrarForm ? "#94a3b8" : "#38bdf8",
            fontWeight:"bold", marginBottom:"16px", fontSize:"13px", border:"1px solid #334155"
          }}>
            {mostrarForm ? "✕ Cancelar" : "+ Adicionar Posição"}
          </button>

          {mostrarForm && (
            <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"16px", borderRadius:"12px", marginBottom:"16px", display:"flex", gap:"12px", flexWrap:"wrap" }}>
              {[
                { key:"ticker", placeholder:"Ticker (ex: VALE3.SA)" },
                { key:"nome", placeholder:"Nome (ex: Vale)" },
                { key:"quantidade", placeholder:"Quantidade", type:"number" },
                { key:"preco_entrada", placeholder:"Preço de Entrada", type:"number" },
              ].map(f => (
                <input key={f.key} type={f.type||"text"} placeholder={f.placeholder} value={form[f.key]}
                  onChange={e => setForm({...form, [f.key]: e.target.value})}
                  style={{ padding:"10px", borderRadius:"6px", border:"1px solid #334155", background:"#0f172a", color:"#f1f5f9", fontSize:"13px", flex:1, minWidth:"150px" }} />
              ))}
              <select value={form.mercado} onChange={e => setForm({...form, mercado: e.target.value})}
                style={{ padding:"10px", borderRadius:"6px", border:"1px solid #334155", background:"#0f172a", color:"#f1f5f9", fontSize:"13px" }}>
                <option value="B3">B3</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="NYSE">NYSE</option>
                <option value="CRYPTO">CRYPTO</option>
                <option value="COMMODITY">COMMODITY</option>
              </select>
              <button onClick={adicionar} style={{ padding:"10px 20px", borderRadius:"6px", border:"none", cursor:"pointer", background:"linear-gradient(135deg,#16a34a,#15803d)", color:"white", fontWeight:"bold", fontSize:"13px" }}>Adicionar</button>
            </div>
          )}

          {carregando ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"15px" }}>Carregando portfólio...</p>
            </div>
          ) : posicoesFiltradas.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"40px", marginBottom:"12px" }}>📭</p>
              <p style={{ fontSize:"15px" }}>Nenhuma posição {filtroOrigem !== "todos" ? `do tipo ${filtroOrigem}` : "aberta"}</p>
            </div>
          ) : (
            <div style={{ overflowX:"auto", borderRadius:"12px", border:"1px solid #1e293b" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#0a1520" }}>
                    {["Ticker","Nome","Mercado","Setor","Qtd","Entrada","Valor Invest.","Preço Atual","Valor Atual","P&L","Alvo/Stop","Dias","Ações"].map(h => (
                      <th key={h} style={{ padding:"14px 14px", textAlign:"left", color:"#64748b", fontSize:"10px", fontWeight:"700", letterSpacing:"0.05em", borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ opacity: atualizando ? 0.4 : 1, transition:"opacity 0.3s" }}>
                  {posicoesFiltradas.map((p) => {
                    const idxReal = posicoes.indexOf(p)
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
                    const estaEditando = editando === idxReal
                    const emLucro = pl >= 0
                    const setor = getSetor(p.ticker)
                    return (
                      <tr key={p.ticker} style={{
                        borderBottom:"1px solid #0f172a",
                        background: estaEditando ? "#1e3a4a" : idxReal % 2 === 0 ? "#0d1829" : "#0a1520",
                        transition:"background 0.15s"
                      }}
                      onMouseEnter={e => { if (!estaEditando) e.currentTarget.style.background = "#1e293b" }}
                      onMouseLeave={e => { if (!estaEditando) e.currentTarget.style.background = idxReal % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                        <td style={{ padding:"14px 14px", fontWeight:"700", color:"#38bdf8", fontSize:"13px", whiteSpace:"nowrap" }}>
                          {p.ticker}
                          <div style={{ marginTop:"3px" }}>
                            <span style={{ fontSize:"9px", fontWeight:"700", padding:"2px 6px", borderRadius:"4px", background: p.origem==="swing" ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)", color: p.origem==="swing" ? "#f59e0b" : "#38bdf8" }}>
                              {p.origem === "swing" ? "⚡ Swing" : "📈 Longo"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px", whiteSpace:"nowrap" }}>{p.nome}</td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ padding:"2px 7px", borderRadius:"12px", fontSize:"10px", fontWeight:"600", background: p.mercado==="B3" ? "rgba(34,197,94,0.15)" : "rgba(56,189,248,0.15)", color: p.mercado==="B3" ? "#22c55e" : "#38bdf8" }}>{p.mercado}</span>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ padding:"2px 7px", borderRadius:"12px", fontSize:"10px", fontWeight:"600", background:"rgba(167,139,250,0.15)", color:"#a78bfa" }}>{setor}</span>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>
                          {estaEditando ? (
                            <input type="number" value={editForm.quantidade} onChange={e => setEditForm({...editForm, quantidade: e.target.value})}
                              style={{ width:"60px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8", background:"#0f172a", color:"#f1f5f9", fontSize:"12px" }} />
                          ) : p.quantidade}
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>
                          {estaEditando ? (
                            <input type="number" value={editForm.preco_entrada} onChange={e => setEditForm({...editForm, preco_entrada: e.target.value})}
                              style={{ width:"80px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8", background:"#0f172a", color:"#f1f5f9", fontSize:"12px" }} />
                          ) : `${moeda(p.mercado)} ${fmt(p.preco_entrada)}`}
                        </td>
                        <td style={{ padding:"14px 14px", color:"#94a3b8", fontSize:"12px" }}>{moeda(p.mercado)} {fmt(valorInvestido)}</td>
                        <td style={{ padding:"14px 14px", fontWeight:"600", fontSize:"12px" }}>
                          <span style={{ color:"#e2e8f0" }}>{moeda(p.mercado)} {fmt(p.preco_atual)}</span>
                        </td>
                        <td style={{ padding:"14px 14px", color: emLucro ? "#4ade80" : "#f87171", fontSize:"12px", fontWeight:"600" }}>{moeda(p.mercado)} {fmt(valorAtual)}</td>
                        <td style={{ padding:"14px 14px", whiteSpace:"nowrap" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                            <span style={{ color: emLucro ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>{emLucro ? "▲" : "▼"} {moeda(p.mercado)} {fmt(Math.abs(pl))}</span>
                            <span style={{ fontSize:"10px", fontWeight:"700", color: emLucro ? "#4ade80" : "#f87171", background: emLucro ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", padding:"2px 6px", borderRadius:"4px", width:"fit-content", display:"inline-block" }}>
                              {emLucro ? "+" : ""}{plPct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"14px 14px", minWidth:"110px" }}>
                          <div style={{ fontSize:"9px", color:"#64748b", marginBottom:"3px", display:"flex", justifyContent:"space-between" }}>
                            <span style={{ color:"#f87171" }}>Stop {fmt(stop)} ({pctStop >= 0 ? "-" : "+"}{Math.abs(pctStop).toFixed(1)}%)</span>
                            <span style={{ color:"#4ade80" }}>Alvo {fmt(alvo)} (+{pctAlvo.toFixed(1)}%)</span>
                          </div>
                          <div style={{ background:"#1e293b", borderRadius:"4px", height:"6px", width:"100%" }}>
                            <div style={{ background: progressoAlvo > 50 ? "#4ade80" : progressoAlvo > 20 ? "#f59e0b" : "#f87171", borderRadius:"4px", height:"6px", width:`${progressoAlvo}%`, transition:"width 0.3s" }}/>
                          </div>
                          <div style={{ fontSize:"9px", color:"#64748b", marginTop:"2px", textAlign:"center" }}>{progressoAlvo.toFixed(0)}% do caminho</div>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ color: dias > 3 ? "#f87171" : dias > 1 ? "#f59e0b" : "#4ade80", fontSize:"12px", fontWeight:"700" }}>{dias}d</span>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                            {estaEditando ? (
                              <>
                                <button onClick={() => salvarEdicao(idxReal)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600" }}>✓</button>
                                <button onClick={() => setEditando(null)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#334155", color:"white", fontSize:"11px" }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => abrirHistoricoAtivo(p)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#0ea5e9", color:"white", fontSize:"11px", fontWeight:"600" }} title="Ver Diário">📈</button>
                                <button onClick={() => setModalEncerrar({idx: idxReal, ...p})} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600", whiteSpace:"nowrap" }}>🏁</button>
                                <button onClick={() => iniciarEdicao(idxReal)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#d97706", color:"white", fontSize:"11px" }}>✏️</button>
                                <button onClick={() => { if (window.confirm(`Remover ${p.ticker}?`)) remover(idxReal) }} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#dc2626", color:"white", fontSize:"11px" }}>🗑️</button>
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

      {/* ── ABA: HISTÓRICO ── */}
      {abaAtiva === "historico" && (
        <>
          {historico.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"40px", marginBottom:"12px" }}>📜</p>
              <p style={{ fontSize:"15px", marginBottom:"8px" }}>Nenhuma operação encerrada</p>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", gap:"12px", marginBottom:"16px", flexWrap:"wrap", alignItems:"stretch" }}>
                {[
                  { label:"Total de Trades", valor: historico.length, cor:"#38bdf8" },
                  { label:"Trades Lucrativos", valor: historico.filter(h => h.pl >= 0).length, cor:"#4ade80" },
                  { label:"Trades com Prejuízo", valor: historico.filter(h => h.pl < 0).length, cor:"#f87171" },
                  { label:"P&L Total Realizado (BR / US)", valor:`R$ ${fmt(lucroRealizadoBR)} | US$ ${fmt(lucroRealizadoUS)}`, cor: (lucroRealizadoBR + lucroRealizadoUS) >= 0 ? "#4ade80" : "#f87171" },
                ].map((card, i) => (
                  <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid #1e293b", padding:"12px 16px", borderRadius:"10px", flex:1, minWidth:"120px", textAlign:"center" }}>
                    <p style={{ color:"#64748b", fontSize:"11px", margin:"0 0 4px 0" }}>{card.label}</p>
                    <p style={{ color:card.cor, fontSize:"16px", fontWeight:"800", margin:0 }}>{card.valor}</p>
                  </div>
                ))}
                <button onClick={apagarTodoHistorico} style={{ padding:"12px 16px", borderRadius:"10px", border:"1px solid #dc2626", background:"rgba(220,38,38,0.08)", color:"#f87171", fontSize:"12px", fontWeight:"600", cursor:"pointer", whiteSpace:"nowrap", alignSelf:"stretch" }}>
                  🗑️ Apagar Tudo
                </button>
              </div>
              <div style={{ overflowX:"auto", borderRadius:"12px", border:"1px solid #1e293b" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#0a1520" }}>
                      {["Ticker","Nome","Tipo","Qtd","Entrada","Saída","P&L","Retorno","Dias","Data Saída","Ação"].map(h => (
                        <th key={h} style={{ padding:"14px 14px", textAlign:"left", color:"#64748b", fontSize:"10px", fontWeight:"700", letterSpacing:"0.05em", borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #0f172a", background: i % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                        <td style={{ padding:"14px 14px", fontWeight:"700", color:"#38bdf8", fontSize:"13px" }}>{h.ticker}</td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>{h.nome}</td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ fontSize:"10px", fontWeight:"700", padding:"3px 8px", borderRadius:"4px", background: h.origem==="swing" ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)", color: h.origem==="swing" ? "#f59e0b" : "#38bdf8" }}>
                            {h.origem === "swing" ? "⚡ Swing" : "📈 Longo"}
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px" }}>{h.quantidade}</td>
                        <td style={{ padding:"14px 14px", color:"#94a3b8", fontSize:"12px" }}>{moeda(h.mercado)} {fmt(h.preco_entrada)}</td>
                        <td style={{ padding:"14px 14px", color:"#e2e8f0", fontSize:"12px", fontWeight:"600" }}>{moeda(h.mercado)} {fmt(h.preco_saida)}</td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ color: h.pl >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                            {h.pl >= 0 ? "▲" : "▼"} {moeda(h.mercado)} {fmt(Math.abs(h.pl))}
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px" }}>
                          <span style={{ padding:"3px 8px", borderRadius:"12px", fontSize:"11px", fontWeight:"700", background: h.pl >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: h.pl >= 0 ? "#4ade80" : "#f87171" }}>
                            {h.pl >= 0 ? "+" : ""}{h.pl_pct}%
                          </span>
                        </td>
                        <td style={{ padding:"14px 14px", color:"#94a3b8", fontSize:"12px" }}>{h.dias}d</td>
                        <td style={{ padding:"14px 14px", color:"#475569", fontSize:"11px" }}>{h.data_saida}</td>
                        <td style={{ padding:"14px 14px" }}>
                          <button onClick={() => apagarHistorico(i)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#dc2626", color:"white", fontSize:"11px", fontWeight:"600" }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ── ABA: PERFORMANCE MENSAL ── */}
      {abaAtiva === "performance" && (
        <>
          {dadosMensais.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
              <p style={{ fontSize:"40px", marginBottom:"12px" }}>📊</p>
              <p style={{ fontSize:"15px", marginBottom:"8px" }}>Nenhum dado de performance ainda</p>
              <p style={{ fontSize:"13px" }}>Encerre posições para ver o histórico mensal aqui</p>
            </div>
          ) : (
            <>
              {dadosMensais.some(d => d.pl_br !== 0) && (
                <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"20px", borderRadius:"12px", marginBottom:"16px" }}>
                  <h3 style={{ color:"#94a3b8", fontSize:"13px", fontWeight:"600", margin:"0 0 16px 0" }}>📊 P&L MENSAL — MERCADO BRASILEIRO (R$)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dadosMensais} margin={{ top:5, right:10, left:10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="mes" stroke="#475569" style={{ fontSize:"11px" }} />
                      <YAxis stroke="#475569" style={{ fontSize:"11px" }} />
                      <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"6px", fontSize:"12px" }}
                        formatter={(value) => [`R$ ${fmt(value)}`, "P&L"]} />
                      <Bar dataKey="pl_br" radius={[4,4,0,0]}>
                        {dadosMensais.map((d, i) => <Cell key={i} fill={d.pl_br >= 0 ? "#4ade80" : "#f87171"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {dadosMensais.some(d => d.pl_us !== 0) && (
                <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"20px", borderRadius:"12px", marginBottom:"16px" }}>
                  <h3 style={{ color:"#94a3b8", fontSize:"13px", fontWeight:"600", margin:"0 0 16px 0" }}>📊 P&L MENSAL — MERCADO INTERNACIONAL (US$)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dadosMensais} margin={{ top:5, right:10, left:10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="mes" stroke="#475569" style={{ fontSize:"11px" }} />
                      <YAxis stroke="#475569" style={{ fontSize:"11px" }} />
                      <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"6px", fontSize:"12px" }}
                        formatter={(value) => [`US$ ${fmt(value)}`, "P&L"]} />
                      <Bar dataKey="pl_us" radius={[4,4,0,0]}>
                        {dadosMensais.map((d, i) => <Cell key={i} fill={d.pl_us >= 0 ? "#38bdf8" : "#f87171"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ overflowX:"auto", borderRadius:"12px", border:"1px solid #1e293b" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#0a1520" }}>
                      {["Mês","Trades","Taxa de Acerto","Retorno Médio","P&L BR (R$)","P&L Intl (US$)"].map(h => (
                        <th key={h} style={{ padding:"14px 16px", textAlign:"left", color:"#64748b", fontSize:"10px", fontWeight:"700", letterSpacing:"0.05em", borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosMensais.map((d, i) => {
                      const taxa = d.trades > 0 ? ((d.lucrativos / d.trades) * 100).toFixed(0) : 0
                      const retornoMedioMes = historico
                        .filter(h => {
                          if (!h.data_saida) return false
                          const p = h.data_saida.split("/")
                          if (p.length < 3) return false
                          return `${p[2]}-${p[1]}` === d.chave
                        })
                        .reduce((acc, h, _, arr) => acc + parseFloat(h.pl_pct) / arr.length, 0)
                        .toFixed(2)
                      return (
                        <tr key={i} style={{ borderBottom:"1px solid #0f172a", background: i % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                          <td style={{ padding:"14px 16px", color:"#e2e8f0", fontSize:"13px", fontWeight:"700" }}>{d.mes}</td>
                          <td style={{ padding:"14px 16px", color:"#94a3b8", fontSize:"12px" }}>{d.trades}</td>
                          <td style={{ padding:"14px 16px" }}>
                            <span style={{ padding:"3px 8px", borderRadius:"12px", fontSize:"11px", fontWeight:"700", background: parseFloat(taxa) >= 50 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: parseFloat(taxa) >= 50 ? "#4ade80" : "#f87171" }}>
                              {taxa}%
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            <span style={{ color: parseFloat(retornoMedioMes) >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"12px" }}>
                              {parseFloat(retornoMedioMes) >= 0 ? "+" : ""}{retornoMedioMes}%
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            <span style={{ color: d.pl_br >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                              {d.pl_br >= 0 ? "▲ " : "▼ "}R$ {fmt(Math.abs(d.pl_br))}
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px" }}>
                            <span style={{ color: d.pl_us >= 0 ? "#38bdf8" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                              {d.pl_us >= 0 ? "▲ " : "▼ "}US$ {fmt(Math.abs(d.pl_us))}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
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
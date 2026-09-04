import { useState, useEffect } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, BarChart, Bar, Cell } from "recharts"
import api from "../services/api"

const CORES = ["#38bdf8","#4ade80","#f59e0b","#f87171","#a78bfa","#34d399","#fb923c","#60a5fa","#e879f9","#facc15"]
const API = import.meta.env.VITE_API_URL

const fmt = (valor) => (Number(valor) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})

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

// Normaliza a origem para exibição: "LONGO" ou "RAPIDO"
const normOrigem = (o) => {
  const v = (o || "LONGO").toString().toUpperCase()
  if (v === "SWING" || v === "RAPIDO" || v === "RÁPIDO") return "RAPIDO"
  return "LONGO"
}

const diasNaOperacao = (dataStr) => {
  if (!dataStr) return 0
  let data
  if (typeof dataStr === "string" && dataStr.includes("T")) {
    data = new Date(dataStr)
  } else if (typeof dataStr === "string" && dataStr.includes("/")) {
    const partes = dataStr.split("/")
    if (partes.length === 3) {
      data = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`)
    } else { return 0 }
  } else {
    data = new Date(dataStr)
  }
  if (isNaN(data.getTime())) return 0
  return Math.floor((new Date() - data) / (1000 * 60 * 60 * 24))
}

// Formata data ISO/timestamp do banco para DD/MM/AAAA
const fmtData = (dataStr) => {
  if (!dataStr) return "—"
  const d = new Date(dataStr)
  if (isNaN(d.getTime())) return dataStr
  return d.toLocaleDateString("pt-BR")
}

export default function Portfolio() {
  const [posicoes, setPosicoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [historico, setHistorico] = useState([])
  const [abaAtiva, setAbaAtiva] = useState("abertas")
  const [form, setForm] = useState({
    ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "",
    origem: "LONGO", alvo_lucro: "", stop_loss: "", data_entrada: "", setor: ""
  })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [atualizando, setAtualizando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [modoGrafico, setModoGrafico] = useState("ativo")
  const [modalEncerrar, setModalEncerrar] = useState(null)
  const [precoSaida, setPrecoSaida] = useState("")
  const [qtdVenderParcial, setQtdVenderParcial] = useState("")
  const [modalHistorico, setModalHistorico] = useState(null)
  const [dadosHistorico, setDadosHistorico] = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)
  const [cotacaoDolar, setCotacaoDolar] = useState(null)
  const [filtroOrigem, setFiltroOrigem] = useState("todos")
  const [ordemData, setOrdemData] = useState("asc")
  const [editHist, setEditHist] = useState(null)      // id do trade do histórico em edição
  const [editHistForm, setEditHistForm] = useState({})

  const carregarPortfolio = async () => {
    try {
      const res = await api.get(`${API}/portfolio`)
      if (res.data.sucesso) {
        const mapeado = res.data.dados.map(p => ({
          id: p.id,
          ticker: p.ticker,
          nome: p.nome || p.ticker,
          mercado: p.mercado || "B3",
          setor: p.setor || getSetor(p.ticker),
          quantidade: parseFloat(p.quantidade),
          preco_entrada: parseFloat(p.preco_entrada ?? p.preco_medio),
          preco_atual: parseFloat(p.preco_atual ?? p.preco_entrada ?? p.preco_medio),
          alvo_lucro: p.alvo_lucro != null ? parseFloat(p.alvo_lucro) : null,
          stop_loss: p.stop_loss != null ? parseFloat(p.stop_loss) : null,
          pct_alvo: p.pct_alvo != null ? parseFloat(p.pct_alvo) : null,
          pct_stop: p.pct_stop != null ? parseFloat(p.pct_stop) : null,
          origem: normOrigem(p.origem),
          data: p.data_entrada || p.criado_em,
          dias: p.dias != null ? parseInt(p.dias) : diasNaOperacao(p.data_entrada || p.criado_em)
        }))
        setPosicoes(mapeado)
      }
    } catch {
      console.error("Erro ao carregar portfólio")
    } finally {
      setCarregando(false)
    }
  }

  // ── HISTÓRICO AGORA VEM DO BANCO (não mais localStorage) ──
  const carregarHistorico = async () => {
    try {
      const res = await api.get(`${API}/historico`)
      if (res.data.sucesso) {
        const mapeado = (res.data.dados || []).map(h => ({
          id: h.id,
          ticker: h.ticker,
          nome: h.nome || h.ticker,
          mercado: h.mercado || "B3",
          origem: normOrigem(h.origem),
          quantidade: parseFloat(h.quantidade || 0),
          preco_entrada: parseFloat(h.preco_entrada || 0),
          preco_saida: parseFloat(h.preco_saida || 0),
          alvo_lucro: h.alvo_lucro != null ? parseFloat(h.alvo_lucro) : null,
          stop_loss: h.stop_loss != null ? parseFloat(h.stop_loss) : null,
          data_entrada: h.data_entrada,
          data_saida: h.data_saida,
          dias: h.dias_duracao != null ? parseInt(h.dias_duracao) : 0,
          pl_pct: h.resultado_pct != null ? parseFloat(h.resultado_pct) : 0,
          status_final: h.status_final || "MANUAL",
          // P&L absoluto reconstruído (o banco guarda %, o dashboard usa R$/US$)
          pl: (parseFloat(h.preco_saida || 0) - parseFloat(h.preco_entrada || 0)) * parseFloat(h.quantidade || 0)
        }))
        setHistorico(mapeado)
      }
    } catch {
      console.error("Erro ao carregar histórico")
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
    carregarHistorico()
    buscarCotacaoDolar()
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
            pos.id === p.id ? { ...pos, preco_atual: ultimoFechamento } : pos
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

  const adicionar = async () => {
    if (!form.ticker || !form.quantidade || !form.preco_entrada) return
    try {
      const res = await api.post(`${API}/portfolio`, {
        ticker: form.ticker.toUpperCase(),
        nome: form.nome || form.ticker.toUpperCase(),
        mercado: form.mercado,
        setor: form.setor || null,
        quantidade: parseFloat(form.quantidade),
        preco_medio: parseFloat(form.preco_entrada),
        alvo_lucro: form.alvo_lucro ? parseFloat(form.alvo_lucro) : null,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        origem: normOrigem(form.origem),
        data_entrada: form.data_entrada || null
      })
      if (res.data.sucesso) {
        await carregarPortfolio()
        setForm({
          ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "",
          origem: "LONGO", alvo_lucro: "", stop_loss: "", data_entrada: "", setor: ""
        })
        setMostrarForm(false)
      } else {
        alert(res.data.erro || "Erro ao adicionar posição.")
      }
    } catch {
      alert("Erro ao adicionar posição.")
    }
  }

  const remover = async (p) => {
    try {
      await api.delete(`${API}/portfolio/${p.id}`)
      await carregarPortfolio()
    } catch {
      alert("Erro ao remover posição.")
    }
  }

  const iniciarEdicao = (p) => {
    setEditando(p.id)
    setEditForm({ quantidade: p.quantidade, preco_entrada: p.preco_entrada })
  }

  const salvarEdicao = async (p) => {
    try {
      // Sem endpoint PUT de portfolio: recria a linha por id, preservando origem/data/alvo/stop
      await api.delete(`${API}/portfolio/${p.id}`)
      await api.post(`${API}/portfolio`, {
        ticker: p.ticker, nome: p.nome, mercado: p.mercado, setor: p.setor,
        quantidade: parseFloat(editForm.quantidade),
        preco_medio: parseFloat(editForm.preco_entrada),
        alvo_lucro: p.alvo_lucro, stop_loss: p.stop_loss,
        pct_alvo: p.pct_alvo, pct_stop: p.pct_stop,
        origem: p.origem, data_entrada: p.data
      })
      await carregarPortfolio()
      setEditando(null)
    } catch {
      alert("Erro ao salvar edição.")
    }
  }

  const encerrarPosicao = async () => {
    if (!precoSaida || !modalEncerrar) return
    const p = modalEncerrar
    const saida = parseFloat(precoSaida)
    const qtdVender = qtdVenderParcial ? parseFloat(qtdVenderParcial) : parseFloat(p.quantidade)
    const resultado = ((saida - p.preco_entrada) / p.preco_entrada) * 100
    const statusFinal = resultado >= 0 ? "LUCRO" : "STOP"
    try {
      const res = await api.post(`${API}/portfolio/${p.id}/encerrar`, {
        preco_saida: saida,
        quantidade_vender: qtdVender,
        status_final: statusFinal
      })
      if (res.data.sucesso) {
        await carregarPortfolio()
        await carregarHistorico()
        setModalEncerrar(null)
        setPrecoSaida("")
        setQtdVenderParcial("")
      } else {
        alert(res.data.erro || "Erro ao encerrar posição.")
      }
    } catch {
      alert("Erro ao encerrar posição.")
    }
  }

  // ── EDIÇÃO DO HISTÓRICO (bate com o Excel) ──
  const iniciarEdicaoHist = (h) => {
    setEditHist(h.id)
    setEditHistForm({
      ticker: h.ticker, nome: h.nome, mercado: h.mercado, origem: h.origem,
      quantidade: h.quantidade, preco_entrada: h.preco_entrada, preco_saida: h.preco_saida,
      data_entrada: h.data_entrada ? new Date(h.data_entrada).toISOString().slice(0,10) : "",
      data_saida: h.data_saida ? new Date(h.data_saida).toISOString().slice(0,10) : "",
    })
  }

  const salvarEdicaoHist = async (id) => {
    try {
      const res = await api.put(`${API}/historico/${id}`, {
        ticker: editHistForm.ticker,
        nome: editHistForm.nome,
        mercado: editHistForm.mercado,
        origem: normOrigem(editHistForm.origem),
        quantidade: parseFloat(editHistForm.quantidade),
        preco_entrada: parseFloat(editHistForm.preco_entrada),
        preco_saida: parseFloat(editHistForm.preco_saida),
        data_entrada: editHistForm.data_entrada || null,
        data_saida: editHistForm.data_saida || null,
      })
      if (res.data.sucesso) {
        await carregarHistorico()
        setEditHist(null)
      } else {
        alert(res.data.erro || "Erro ao editar trade.")
      }
    } catch {
      alert("Erro ao editar trade.")
    }
  }

  const apagarHistorico = async (id) => {
    if (!window.confirm("Apagar este trade do histórico?")) return
    try {
      await api.delete(`${API}/historico/${id}`)
      await carregarHistorico()
    } catch {
      alert("Erro ao apagar trade.")
    }
  }

  const atualizarPrecos = async () => {
    if (posicoes.length === 0) return
    setAtualizando(true)
    buscarCotacaoDolar()
    try {
      const tickers = [...new Set(posicoes.map(p => p.ticker))]
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

  const posicoesFiltradas = (() => {
    const filtradas = filtroOrigem === "todos"
      ? posicoes
      : posicoes.filter(p => filtroOrigem === "swing" ? p.origem === "RAPIDO" : p.origem === "LONGO")
    return [...filtradas].sort((a, b) => {
      const da = new Date(a.data || 0)
      const db = new Date(b.data || 0)
      return ordemData === "asc" ? da - db : db - da
    })
  })()

  // ── CÁLCULOS FINANCEIROS ──
  const invB3 = posicoes.filter(p=>p.mercado==="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)
  const atuB3 = posicoes.filter(p=>p.mercado==="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_atual, 0)
  const lucroAbertoB3 = atuB3 - invB3

  const invIntl = posicoes.filter(p=>p.mercado!=="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_entrada, 0)
  const atuIntl = posicoes.filter(p=>p.mercado!=="B3").reduce((acc,p)=>acc+p.quantidade*p.preco_atual, 0)
  const lucroAbertoIntl = atuIntl - invIntl

  const dolar = cotacaoDolar || 5.7
  const patrimonioInvestidoBRL = invB3 + (invIntl * dolar)
  const patrimonioTotalBRL = atuB3 + (atuIntl * dolar)
  const lucroAbertoBRL = lucroAbertoB3 + (lucroAbertoIntl * dolar)

  const lucroRealizadoBR = historico.filter(h=>h.mercado==="B3").reduce((acc,h)=>acc+h.pl, 0)
  const lucroRealizadoUS = historico.filter(h=>h.mercado!=="B3").reduce((acc,h)=>acc+h.pl, 0)
  const lucroRealizadoBRL = lucroRealizadoBR + (lucroRealizadoUS * dolar)

  const resultadoTotalBRL = lucroAbertoBRL + lucroRealizadoBRL

  // ── CAPITAL MOVIMENTADO: tudo que ja foi comprado (fechados + abertos) ──
  // Diferente do capital em risco: aqui o mesmo dinheiro reusado em varios
  // trades conta cada vez, mostrando o giro total da operacao.
  const capMovFechadoBR = historico
    .filter(h => h.mercado === "B3")
    .reduce((acc,h) => acc + (parseFloat(h.preco_entrada)||0) * (parseFloat(h.quantidade)||0), 0)
  const capMovFechadoUS = historico
    .filter(h => h.mercado !== "B3")
    .reduce((acc,h) => acc + (parseFloat(h.preco_entrada)||0) * (parseFloat(h.quantidade)||0), 0)
  const capitalMovimentadoBRL = capMovFechadoBR + (capMovFechadoUS * dolar) + patrimonioInvestidoBRL
  // ── METRICAS FINANCEIRAS (aba Performance) ──
  // Dinheiro que entrou e saiu de cada trade fechado, ja convertido pra BRL.
  const _capInv = (h) => {
    const v = (parseFloat(h.preco_entrada) || 0) * (parseFloat(h.quantidade) || 0)
    return h.mercado === "B3" ? v : v * dolar
  }
  const _capRec = (h) => {
    const v = (parseFloat(h.preco_saida) || 0) * (parseFloat(h.quantidade) || 0)
    return h.mercado === "B3" ? v : v * dolar
  }

  const totalComprado = historico.reduce((acc, h) => acc + _capInv(h), 0)
  const totalVendido  = historico.reduce((acc, h) => acc + _capRec(h), 0)
  const retornoSobreMovimentado = totalComprado > 0
    ? ((totalVendido - totalComprado) / totalComprado * 100)
    : 0

  const vencedores = historico.filter(h => parseFloat(h.pl) >= 0)
  const perdedores = historico.filter(h => parseFloat(h.pl) < 0)

  const ganhoMedio = vencedores.length > 0
    ? vencedores.reduce((acc, h) => acc + parseFloat(h.pl_pct || 0), 0) / vencedores.length
    : 0
  const perdaMedia = perdedores.length > 0
    ? perdedores.reduce((acc, h) => acc + parseFloat(h.pl_pct || 0), 0) / perdedores.length
    : 0

  const melhorTrade = historico.length > 0
    ? historico.reduce((a, b) => parseFloat(a.pl_pct || 0) > parseFloat(b.pl_pct || 0) ? a : b)
    : null
  const piorTrade = historico.length > 0
    ? historico.reduce((a, b) => parseFloat(a.pl_pct || 0) < parseFloat(b.pl_pct || 0) ? a : b)
    : null

  // Curva de lucro acumulado, do trade mais antigo pro mais novo.
  const curvaAcumulada = (() => {
    const ordenado = [...historico]
      .filter(h => h.data_saida)
      .sort((a, b) => new Date(a.data_saida) - new Date(b.data_saida))
    let soma = 0
    return ordenado.map(h => {
      const pl = h.mercado === "B3" ? parseFloat(h.pl || 0) : parseFloat(h.pl || 0) * dolar
      soma += pl
      return {
        data: new Date(h.data_saida).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        ticker: h.ticker,
        acumulado: parseFloat(soma.toFixed(2))
      }
    })
  })()

  // MAE: quanto cada trade chegou a ficar negativo antes de terminar.
  // Serve pra saber se o stop esta apertado demais (matando vencedores).
  const tradesComMAE = historico
    .filter(h => h.mae_pct !== null && h.mae_pct !== undefined)
    .map(h => ({
      ...h,
      maeNum: parseFloat(h.mae_pct),
      resultNum: parseFloat(h.pl_pct || 0)
    }))
    .sort((a, b) => a.maeNum - b.maeNum)

  const vencedoresQueSofreram = tradesComMAE.filter(t => t.resultNum >= 0 && t.maeNum <= -4).length

  const mediaRetorno = historico.length > 0
    ? (historico.reduce((acc, h) => acc + parseFloat(h.pl_pct), 0) / historico.length).toFixed(2)
    : null

  const taxaAcerto = historico.length > 0
    ? ((historico.filter(h => h.pl >= 0).length / historico.length) * 100).toFixed(0)
    : null

  const posicoesNoStop = posicoes.filter(p => {
    const stop = p.stop_loss || (p.preco_entrada * 0.98)
    const alvo = p.alvo_lucro || (p.preco_entrada * 1.05)
    return (((p.preco_entrada - p.preco_atual) / (p.preco_entrada - stop)) * 100) > 80
  }).length

  const posicoesNoAlvo = posicoes.filter(p => {
    const stop = p.stop_loss || (p.preco_entrada * 0.98)
    const alvo = p.alvo_lucro || (p.preco_entrada * 1.05)
    return (((p.preco_atual - p.preco_entrada) / (alvo - p.preco_entrada)) * 100) > 80
  }).length

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

  // ── PERFORMANCE MENSAL (usa data_saida do banco em formato ISO) ──
  const historicoMensal = historico.reduce((acc, h) => {
    if (!h.data_saida) return acc
    const d = new Date(h.data_saida)
    if (isNaN(d.getTime())) return acc
    const ano = d.getFullYear()
    const mes = String(d.getMonth() + 1).padStart(2, "0")
    const chave = `${ano}-${mes}`
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    if (!acc[chave]) acc[chave] = { mes: label, chave, pl_br: 0, pl_us: 0, trades: 0, lucrativos: 0, cap_inv_br: 0, cap_inv_us: 0, cap_rec_br: 0, cap_rec_us: 0 }
    const capInv = parseFloat(h.preco_entrada) * parseFloat(h.quantidade)
    const capRec = parseFloat(h.preco_saida) * parseFloat(h.quantidade)
    if (h.mercado === "B3") {
      acc[chave].pl_br += parseFloat(h.pl)
      acc[chave].cap_inv_br += capInv
      acc[chave].cap_rec_br += capRec
    } else {
      acc[chave].pl_us += parseFloat(h.pl)
      acc[chave].cap_inv_us += capInv
      acc[chave].cap_rec_us += capRec
    }
    acc[chave].trades++
    if (parseFloat(h.pl) >= 0) acc[chave].lucrativos++
    return acc
  }, {})
  const dadosMensais = Object.values(historicoMensal).sort((a, b) => a.chave.localeCompare(b.chave))

  const inputStyle = { padding:"10px", borderRadius:"6px", border:"1px solid #334155", background:"#0f172a", color:"#f1f5f9", fontSize:"13px" }

  return (
  <div style={{ padding:"20px", width:"100%", boxSizing:"border-box" }}>

      {/* Modal Histórico de Preços */}
      {modalHistorico && (
        <div onClick={() => setModalHistorico(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"16px", padding:"24px", maxWidth:"560px", width:"100%", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={{ fontSize:"17px", fontWeight:"bold", color:"#f1f5f9" }}>📈 Histórico — {modalHistorico.ticker}</div>
              <button onClick={() => setModalHistorico(null)} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"16px" }}>✕</button>
            </div>
            <div style={{ fontSize:"13px", color:"#94a3b8", marginBottom:"16px" }}>
              Preço de Entrada Original: {moeda(modalHistorico.mercado)} {fmt(modalHistorico.preco_entrada)}
            </div>
            {carregandoHist ? (
              <div style={{ textAlign:"center", padding:"40px", color:"#64748b" }}>
                <div style={{ fontSize:"13px" }}>Buscando histórico diário...</div>
              </div>
            ) : dadosHistorico.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px", color:"#64748b" }}>
                <div style={{ fontSize:"13px" }}>Nenhum dado encontrado.</div>
              </div>
            ) : (
              <>
                <div style={{ height:"200px", marginBottom:"16px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosHistorico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="data" tick={{ fontSize:10, fill:"#64748b" }} />
                      <YAxis tick={{ fontSize:10, fill:"#64748b" }} domain={['auto','auto']} />
                      <Tooltip formatter={(value) => [`${moeda(modalHistorico.mercado)} ${fmt(value)}`, "Fechamento"]} />
                      <ReferenceLine y={modalHistorico.preco_entrada} stroke="#f59e0b" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="fechamento" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ overflowY:"auto", flex:1 }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                    <thead>
                      <tr style={{ position:"sticky", top:0, background:"#0d1829" }}>
                        <th style={{ padding:"6px", textAlign:"left", color:"#64748b" }}>DATA</th>
                        <th style={{ padding:"6px", textAlign:"right", color:"#64748b" }}>FECHAMENTO</th>
                        <th style={{ padding:"6px", textAlign:"right", color:"#64748b" }}>P&L DESDE ENTRADA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosHistorico.map((dia, idx) => {
                        const varPct = ((dia.fechamento - modalHistorico.preco_entrada) / modalHistorico.preco_entrada * 100).toFixed(2)
                        const lucro = dia.fechamento >= modalHistorico.preco_entrada
                        return (
                          <tr key={idx} style={{ borderBottom:"1px solid #1e293b" }}>
                            <td style={{ padding:"6px", color:"#94a3b8" }}>{dia.data}</td>
                            <td style={{ padding:"6px", textAlign:"right", color:"#f1f5f9" }}>{moeda(modalHistorico.mercado)} {fmt(dia.fechamento)}</td>
                            <td style={{ padding:"6px", textAlign:"right", color: lucro ? "#4ade80" : "#f87171" }}>
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

      {/* Modal Encerrar Posição (com venda parcial) */}
      {modalEncerrar && (
        <div onClick={() => setModalEncerrar(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"16px", padding:"28px", maxWidth:"420px", width:"100%" }}>
            <div style={{ fontSize:"18px", fontWeight:"bold", color:"#f1f5f9", marginBottom:"8px" }}>🏁 Encerrar Posição</div>
            <div style={{ fontSize:"13px", color:"#94a3b8", marginBottom:"20px" }}>
              {modalEncerrar.ticker} — {modalEncerrar.quantidade} cotas @ {moeda(modalEncerrar.mercado)} {fmt(modalEncerrar.preco_entrada)}
              <span style={{ marginLeft:8, padding:"2px 8px", borderRadius:"10px", fontSize:"11px", background: modalEncerrar.origem === "RAPIDO" ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)", color: modalEncerrar.origem === "RAPIDO" ? "#f59e0b" : "#38bdf8" }}>
                {modalEncerrar.origem === "RAPIDO" ? "⚡ Swing" : "📈 Longo"}
              </span>
            </div>

            <div style={{ fontSize:"13px", color:"#94a3b8", marginBottom:"6px" }}>Quantidade a vender (vazio = tudo: {modalEncerrar.quantidade}):</div>
            <input type="number" value={qtdVenderParcial} onChange={e => setQtdVenderParcial(e.target.value)}
              placeholder={`Máximo: ${modalEncerrar.quantidade}`}
              style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid #334155", background:"#0f172a", color:"#f1f5f9", fontSize:"14px", marginBottom:"16px", boxSizing:"border-box" }} />

            <div style={{ fontSize:"13px", color:"#94a3b8", marginBottom:"6px" }}>Preço de saída:</div>
            <input type="number" value={precoSaida} onChange={e => setPrecoSaida(e.target.value)} placeholder="Ex: 85.50"
              style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid #334155", background:"#0f172a", color:"#f1f5f9", fontSize:"14px", marginBottom:"16px", boxSizing:"border-box" }} />
            {precoSaida && (
              <div style={{ padding:"12px", borderRadius:"8px", marginBottom:"16px", background: (parseFloat(precoSaida) - modalEncerrar.preco_entrada) >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)" }}>
                <div style={{ fontSize:"12px", color:"#94a3b8", marginBottom:"4px" }}>Resultado estimado:</div>
                <div style={{ fontSize:"16px", fontWeight:"bold", color: (parseFloat(precoSaida) - modalEncerrar.preco_entrada) >= 0 ? "#4ade80" : "#f87171" }}>
                  {moeda(modalEncerrar.mercado)} {fmt((parseFloat(precoSaida) - modalEncerrar.preco_entrada) * (qtdVenderParcial ? parseFloat(qtdVenderParcial) : modalEncerrar.quantidade))}
                  {" "}({((parseFloat(precoSaida) - modalEncerrar.preco_entrada) / modalEncerrar.preco_entrada * 100).toFixed(2)}%)
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={encerrarPosicao} style={{ flex:1, padding:"12px 16px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontSize:"13px", fontWeight:"700" }}>✅ Confirmar</button>
              <button onClick={() => { setModalEncerrar(null); setPrecoSaida(""); setQtdVenderParcial("") }} style={{ padding:"12px 16px", borderRadius:"8px", border:"1px solid #334155", cursor:"pointer", background:"#1e293b", color:"#94a3b8", fontSize:"13px" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <div style={{ fontSize:"26px", fontWeight:"bold", color:"#f1f5f9" }}>💼 Portfólio</div>
          <div style={{ display:"flex", gap:"12px", marginTop:"4px", fontSize:"12px", color:"#64748b" }}>
            {ultimaAtualizacao && <span>Atualizado às {ultimaAtualizacao}</span>}
            {cotacaoDolar && <span>💵 USD/BRL: R$ {cotacaoDolar.toFixed(2)}</span>}
          </div>
        </div>
        {posicoes.length > 0 && (
          <button onClick={atualizarPrecos} disabled={atualizando} style={{ padding:"10px 18px", borderRadius:"8px", cursor:"pointer", background:"#1e293b", color:"#38bdf8", fontWeight:"bold", fontSize:"13px", border:"1px solid #334155" }}>
            {atualizando ? "Atualizando..." : "🔄 Atualizar Preços"}
          </button>
        )}
      </div>

      {/* ── LINHA 1: VISÃO CONSOLIDADA ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:"12px", marginBottom:"12px" }}>
        {[
                    { label: "Capital em aberto", valor: `R$ ${fmt(patrimonioInvestidoBRL)}`, sub: `${posicoes.length} posiç${posicoes.length !== 1 ? "ões" : "ão"} aberta${posicoes.length !== 1 ? "s" : ""} · vale R$ ${fmt(patrimonioTotalBRL)} hoje`, cor: "#38bdf8", bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.2)" },
          { label: "Lucro em aberto", valor: `R$ ${fmt(lucroAbertoBRL)}`, pct: patrimonioInvestidoBRL > 0 ? ` (${lucroAbertoBRL >= 0 ? "+" : ""}${(lucroAbertoBRL / patrimonioInvestidoBRL * 100).toFixed(1)}%)` : "", sub: "ainda não realizado — pode mudar", cor: lucroAbertoBRL >= 0 ? "#4ade80" : "#f87171", bg: lucroAbertoBRL >= 0 ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: lucroAbertoBRL >= 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)" },
          { label: "Lucro realizado", valor: `R$ ${fmt(lucroRealizadoBRL)}`, pct: mediaRetorno ? ` (${parseFloat(mediaRetorno) >= 0 ? "+" : ""}${mediaRetorno}% por trade)` : "", sub: `${historico.length} trades encerrados · dinheiro no bolso`, cor: lucroRealizadoBRL >= 0 ? "#4ade80" : "#f87171", bg: lucroRealizadoBRL >= 0 ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: lucroRealizadoBRL >= 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)" },
          { label: "Resultado acumulado", valor: `R$ ${fmt(resultadoTotalBRL)}`, sub: "realizado + em aberto", cor: resultadoTotalBRL >= 0 ? "#a78bfa" : "#f87171", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.2)" },
        ].map((card, i) => (
          <div key={i} style={{ padding:"16px", borderRadius:"12px", background: card.bg, border:`1px solid ${card.border}` }}>
            <div style={{ fontSize:"12px", color:"#94a3b8", marginBottom:"6px" }}>{card.label}</div>
            <div style={{ fontSize:"20px", fontWeight:"bold", color: card.cor }}>
              {card.valor}{card.pct && <span style={{ fontSize:"13px" }}>{card.pct}</span>}
            </div>
            <div style={{ fontSize:"11px", color:"#64748b", marginTop:"4px" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LINHA 2: PERFORMANCE E RISCO ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"12px", marginBottom:"24px" }}>
        {[
                    { label: "Total movimentado", valor: `R$ ${fmt(capitalMovimentadoBRL)}`, sub: "soma de tudo já comprado (o mesmo dinheiro conta cada vez que gira)", cor: "#94a3b8", bg: "rgba(148,163,184,0.04)", border: "rgba(148,163,184,0.15)" },
          ...(historico.length > 0 ? [{
            label: "🎯 Taxa de Acerto", valor: `${taxaAcerto}%`,
            sub: `${historico.filter(h=>h.pl>=0).length} lucro / ${historico.filter(h=>h.pl<0).length} prejuízo · ${historico.length} trades`,
            cor: parseFloat(taxaAcerto) >= 60 ? "#4ade80" : parseFloat(taxaAcerto) >= 40 ? "#f59e0b" : "#f87171",
            bg: "rgba(74,222,128,0.04)", border: "rgba(74,222,128,0.15)"
          },
          {
            label: "⏱️ Tempo Médio por Trade",
            valor: (() => {
              const tradesComDias = historico.filter(h => h.dias != null && h.dias > 0)
              if (tradesComDias.length === 0) return "—"
              const media = tradesComDias.reduce((acc, h) => acc + parseInt(h.dias), 0) / tradesComDias.length
              return `${media.toFixed(0)} dias`
            })(),
            sub: "média até encerrar posição", cor: "#f59e0b", bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.15)"
          }] : []),
          { label: "⚠️ Posições no Stop", valor: `${posicoesNoStop} ativo${posicoesNoStop !== 1 ? "s" : ""}`, sub: "80%+ do caminho ate o stop", cor: posicoesNoStop > 0 ? "#f87171" : "#64748b", bg: posicoesNoStop > 0 ? "rgba(248,113,113,0.06)" : "rgba(100,116,139,0.04)", border: posicoesNoStop > 0 ? "rgba(248,113,113,0.2)" : "rgba(100,116,139,0.15)" },
          { label: "✅ Posições no Alvo", valor: `${posicoesNoAlvo} ativo${posicoesNoAlvo !== 1 ? "s" : ""}`, sub: "80%+ do caminho ate o alvo", cor: posicoesNoAlvo > 0 ? "#4ade80" : "#64748b", bg: posicoesNoAlvo > 0 ? "rgba(74,222,128,0.06)" : "rgba(100,116,139,0.04)", border: posicoesNoAlvo > 0 ? "rgba(74,222,128,0.2)" : "rgba(100,116,139,0.15)" },
        ].map((card, i) => (
          <div key={i} style={{ padding:"14px", borderRadius:"12px", background: card.bg, border:`1px solid ${card.border}` }}>
            <div style={{ fontSize:"11px", color:"#94a3b8", marginBottom:"6px" }}>{card.label}</div>
            <div style={{ fontSize:"18px", fontWeight:"bold", color: card.cor }}>{card.valor}</div>
            <div style={{ fontSize:"10px", color:"#64748b", marginTop:"4px" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── GRÁFICO + FILTROS ── */}
      {posicoes.length > 0 && (
        <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"20px", marginBottom:"24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"12px" }}>
            <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", letterSpacing:"0.5px" }}>📊 DISTRIBUIÇÃO NOMINAL DO PORTFÓLIO</div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
              {["ativo","setor"].map(modo => (
                <button key={modo} onClick={() => setModoGrafico(modo)} style={{ padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight: modoGrafico === modo ? "700" : "400", background: modoGrafico === modo ? "#38bdf8" : "#1e293b", color: modoGrafico === modo ? "#0f172a" : "#64748b", transition:"all 0.2s" }}>
                  {modo === "ativo" ? "Por Ativo" : "Por Setor"}
                </button>
              ))}
              <div style={{ width:"1px", height:"20px", background:"#334155", margin:"0 4px" }} />
              {[{id:"todos",label:"Todos"},{id:"swing",label:"⚡ Swing"},{id:"longo",label:"📈 Longo"}].map(f => (
                <button key={f.id} onClick={() => setFiltroOrigem(f.id)} style={{ padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight: filtroOrigem === f.id ? "700" : "400", background: filtroOrigem === f.id ? (f.id==="swing" ? "#f59e0b" : f.id==="longo" ? "#38bdf8" : "#64748b") : "#1e293b", color: filtroOrigem === f.id ? "#0f172a" : "#64748b", transition:"all 0.2s" }}>
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
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"90px", fontSize:"12px", color:"#94a3b8", textAlign:"right", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</div>
                  <div style={{ flex:1, background:"#1e293b", borderRadius:"4px", height:"22px", position:"relative", overflow:"hidden" }}>
                    <div style={{ background: CORES[i % CORES.length], height:"100%", width:`${largura}%`, borderRadius: largura > 0 ? "4px" : "0", transition:"width 0.3s" }} />
                  </div>
                  <div style={{ width:"48px", fontSize:"12px", color:"#f1f5f9", fontWeight:"600" }}>{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SUB-ABAS ── */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" }}>
        {[
          { id:"abertas", label:"💼 Posições Abertas", count: posicoesFiltradas.length },
          { id:"historico", label:"📜 Histórico de Trades", count: historico.length },
          { id:"performance", label:"📈 Performance", count: dadosMensais.length }
        ].map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)} style={{ padding:"8px 20px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight: abaAtiva === a.id ? "700" : "400", background: abaAtiva === a.id ? "rgba(56,189,248,0.15)" : "#1e293b", color: abaAtiva === a.id ? "#38bdf8" : "#64748b", borderBottom: abaAtiva === a.id ? "2px solid #38bdf8" : "2px solid transparent" }}>
            {a.label} {a.count}
          </button>
        ))}
      </div>

      {/* ── ABA: POSIÇÕES ABERTAS ── */}
      {abaAtiva === "abertas" && (
        <>
          <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
            <button onClick={() => setMostrarForm(!mostrarForm)} style={{ padding:"9px 20px", borderRadius:"8px", cursor:"pointer", background: mostrarForm ? "#334155" : "#1e293b", color: mostrarForm ? "#94a3b8" : "#38bdf8", fontWeight:"bold", fontSize:"13px", border:"1px solid #334155" }}>
              {mostrarForm ? "✕ Cancelar" : "+ Adicionar Posição"}
            </button>
            <button onClick={() => setOrdemData(o => o === "asc" ? "desc" : "asc")} style={{ padding:"9px 16px", borderRadius:"8px", cursor:"pointer", background:"#1e293b", color:"#94a3b8", fontSize:"12px", fontWeight:"600", border:"1px solid #334155", display:"flex", alignItems:"center", gap:"6px" }}>
              {ordemData === "asc" ? "📅 Mais antigo primeiro" : "📅 Mais recente primeiro"}
            </button>
          </div>

          {mostrarForm && (
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", padding:"16px", background:"#0d1829", borderRadius:"12px", border:"1px solid #1e293b" }}>
              <input placeholder="Ticker (ex: VALE3.SA)" value={form.ticker} onChange={e => setForm({...form, ticker: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"150px" }} />
              <input placeholder="Nome (ex: Vale)" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"150px" }} />
              <input type="number" placeholder="Quantidade" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"110px" }} />
              <input type="number" placeholder="Preço de Entrada" value={form.preco_entrada} onChange={e => setForm({...form, preco_entrada: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"130px" }} />
              <input type="number" placeholder="Alvo (opcional)" value={form.alvo_lucro} onChange={e => setForm({...form, alvo_lucro: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"120px" }} />
              <input type="number" placeholder="Stop (opcional)" value={form.stop_loss} onChange={e => setForm({...form, stop_loss: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"120px" }} />
              <input type="date" placeholder="Data de entrada" value={form.data_entrada} onChange={e => setForm({...form, data_entrada: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"140px" }} />
              <select value={form.mercado} onChange={e => setForm({...form, mercado: e.target.value})} style={inputStyle}>
                <option value="B3">B3</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="NYSE">NYSE</option>
                <option value="CRYPTO">CRYPTO</option>
                <option value="COMMODITY">COMMODITY</option>
              </select>
              <select value={form.origem} onChange={e => setForm({...form, origem: e.target.value})} style={inputStyle}>
                <option value="LONGO">📈 Longo</option>
                <option value="RAPIDO">⚡ Swing</option>
              </select>
              <button onClick={adicionar} style={{ padding:"10px 20px", borderRadius:"6px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontWeight:"bold", fontSize:"13px" }}>Adicionar</button>
            </div>
          )}

          {carregando ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#64748b" }}>Carregando portfólio...</div>
          ) : posicoesFiltradas.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#64748b" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>📭</div>
              <div>Nenhuma posição {filtroOrigem !== "todos" ? `do tipo ${filtroOrigem}` : "aberta"}</div>
            </div>
          ) : (
            <div style={{ overflowX:"auto", background:"#0d1829", borderRadius:"12px", border:"1px solid #1e293b" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", minWidth:"1100px" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #1e293b" }}>
                    {["Ticker","Nome","Mercado","Setor","Qtd","Entrada","Valor Invest.","Preço Atual","P&L","Alvo/Stop","Dias","Ações"].map(h => (
                      <th key={h} style={{ padding:"12px 10px", textAlign:"left", color:"#64748b", fontSize:"11px", fontWeight:"600", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posicoesFiltradas.map((p, idxRow) => {
                    const pl = (p.preco_atual - p.preco_entrada) * p.quantidade
                    const plPct = ((p.preco_atual - p.preco_entrada) / p.preco_entrada * 100).toFixed(2)
                    const valorInvestido = p.quantidade * p.preco_entrada
                    const alvo = p.alvo_lucro || (p.preco_entrada * 1.05)
                    const stop = p.stop_loss || (p.preco_entrada * 0.98)
                    const pctAlvo = p.pct_alvo || ((alvo - p.preco_entrada) / p.preco_entrada * 100)
                    const pctStop = p.pct_stop || ((p.preco_entrada - stop) / p.preco_entrada * 100)
                    const progressoReal = ((p.preco_atual - p.preco_entrada) / (alvo - p.preco_entrada)) * 100
                    const progressoAlvo = Math.min(Math.max(progressoReal, 0), 100)
                    const dias = p.dias != null ? p.dias : diasNaOperacao(p.data)
                    const estaEditando = editando === p.id
                    const emLucro = pl >= 0
                    return (
                      <tr key={p.id} style={{ borderBottom:"1px solid #1e293b", background: idxRow % 2 === 0 ? "#0d1829" : "#0a1520" }}
                        onMouseEnter={e => { if (!estaEditando) e.currentTarget.style.background = "#1e293b" }}
                        onMouseLeave={e => { if (!estaEditando) e.currentTarget.style.background = idxRow % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                        <td style={{ padding:"12px 10px" }}>
                          <div style={{ fontWeight:"700", color:"#38bdf8" }}>{p.ticker}</div>
                          <div style={{ marginTop:"3px" }}>
                            <span style={{ padding:"1px 6px", borderRadius:"8px", fontSize:"10px", fontWeight:"600", background: p.origem === "RAPIDO" ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)", color: p.origem === "RAPIDO" ? "#f59e0b" : "#38bdf8" }}>
                              {p.origem === "RAPIDO" ? "⚡ Swing" : "📈 Longo"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"12px 10px", color:"#cbd5e1" }}>{p.nome}</td>
                        <td style={{ padding:"12px 10px" }}><span style={{ padding:"2px 8px", borderRadius:"6px", fontSize:"11px", background:"#1e293b", color:"#94a3b8" }}>{p.mercado}</span></td>
                        <td style={{ padding:"12px 10px" }}><span style={{ padding:"2px 8px", borderRadius:"6px", fontSize:"11px", background:"rgba(167,139,250,0.1)", color:"#a78bfa" }}>{p.setor}</span></td>
                        <td style={{ padding:"12px 10px", color:"#cbd5e1" }}>
                          {estaEditando ? (
                            <input type="number" value={editForm.quantidade} onChange={e => setEditForm({...editForm, quantidade: e.target.value})} style={{ width:"60px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8", background:"#0f172a", color:"#f1f5f9", fontSize:"12px" }} />
                          ) : p.quantidade}
                        </td>
                        <td style={{ padding:"12px 10px", color:"#cbd5e1" }}>
                          {estaEditando ? (
                            <input type="number" value={editForm.preco_entrada} onChange={e => setEditForm({...editForm, preco_entrada: e.target.value})} style={{ width:"80px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8", background:"#0f172a", color:"#f1f5f9", fontSize:"12px" }} />
                          ) : `${moeda(p.mercado)} ${fmt(p.preco_entrada)}`}
                        </td>
                        <td style={{ padding:"12px 10px", color:"#94a3b8" }}>{moeda(p.mercado)} {fmt(valorInvestido)}</td>
                        <td style={{ padding:"12px 10px", color:"#f1f5f9", fontWeight:"600" }}>{moeda(p.mercado)} {fmt(p.preco_atual)}</td>
                        <td style={{ padding:"12px 10px" }}>
                          <div style={{ color: emLucro ? "#4ade80" : "#f87171", fontWeight:"700" }}>
                            {emLucro ? "▲" : "▼"} {moeda(p.mercado)} {fmt(Math.abs(pl))}
                          </div>
                          <div style={{ fontSize:"11px", color: emLucro ? "#4ade80" : "#f87171" }}>{emLucro ? "+" : ""}{plPct}%</div>
                        </td>
                        <td style={{ padding:"12px 10px", minWidth:"180px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10px", marginBottom:"3px" }}>
                            <span style={{ color:"#f87171" }}>Stop {fmt(stop)} ({pctStop >= 0 ? "-" : "+"}{Math.abs(pctStop).toFixed(1)}%)</span>
                            <span style={{ color:"#4ade80" }}>Alvo {fmt(alvo)} (+{pctAlvo.toFixed(1)}%)</span>
                          </div>
                          <div style={{ background:"#1e293b", borderRadius:"4px", height:"6px", overflow:"hidden" }}>
                            <div style={{ background: progressoAlvo > 50 ? "#4ade80" : progressoAlvo > 20 ? "#f59e0b" : "#f87171", borderRadius:"4px", height:"6px", width:`${progressoAlvo}%`, transition:"width 0.3s" }} />
                          </div>
                          <div style={{ fontSize:"10px", color: progressoReal < 0 ? "#f87171" : "#64748b", textAlign:"center", marginTop:"2px" }}>{progressoReal.toFixed(0)}% do caminho</div>
                        </td>
                        <td style={{ padding:"12px 10px" }}>
                          <span style={{ color: dias > 3 ? "#f87171" : dias > 1 ? "#f59e0b" : "#4ade80", fontSize:"12px", fontWeight:"700" }}>{dias}d</span>
                        </td>
                        <td style={{ padding:"12px 10px" }}>
                          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                            {estaEditando ? (
                              <>
                                <button onClick={() => salvarEdicao(p)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600" }}>✓</button>
                                <button onClick={() => setEditando(null)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#334155", color:"white", fontSize:"11px" }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => abrirHistoricoAtivo(p)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#0ea5e9", color:"white", fontSize:"11px", fontWeight:"600" }} title="Ver Diário">📈</button>
                                <button onClick={() => setModalEncerrar(p)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600", whiteSpace:"nowrap" }}>🏁</button>
                                <button onClick={() => iniciarEdicao(p)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#d97706", color:"white", fontSize:"11px" }}>✏️</button>
                                <button onClick={() => { if (window.confirm(`Remover ${p.ticker}?`)) remover(p) }} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#dc2626", color:"white", fontSize:"11px" }}>🗑️</button>
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
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#64748b" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>📜</div>
              <div>Nenhuma operação encerrada</div>
            </div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"12px", marginBottom:"20px" }}>
                {[
                  { label:"Total de Trades", valor: historico.length, cor:"#38bdf8" },
                  { label:"Trades Lucrativos", valor: historico.filter(h => h.pl >= 0).length, cor:"#4ade80" },
                  { label:"Trades com Prejuízo", valor: historico.filter(h => h.pl < 0).length, cor:"#f87171" },
                  { label:"P&L Total Realizado (BR / US)", valor:`R$ ${fmt(lucroRealizadoBR)} | US$ ${fmt(lucroRealizadoUS)}`, cor: (lucroRealizadoBR + lucroRealizadoUS) >= 0 ? "#4ade80" : "#f87171" },
                ].map((card, i) => (
                  <div key={i} style={{ padding:"14px", borderRadius:"12px", background:"#0d1829", border:"1px solid #1e293b" }}>
                    <div style={{ fontSize:"11px", color:"#94a3b8", marginBottom:"6px" }}>{card.label}</div>
                    <div style={{ fontSize:"18px", fontWeight:"bold", color: card.cor }}>{card.valor}</div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX:"auto", background:"#0d1829", borderRadius:"12px", border:"1px solid #1e293b" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", minWidth:"1000px" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #1e293b" }}>
                      {["Ticker","Nome","Tipo","Qtd","Entrada","Saída","P&L","Retorno","Dias","Data Saída","Ações"].map(h => (
                        <th key={h} style={{ padding:"12px 10px", textAlign:"left", color:"#64748b", fontSize:"11px", fontWeight:"600", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h, i) => {
                      const emEdicao = editHist === h.id
                      return (
                        <tr key={h.id} style={{ borderBottom:"1px solid #1e293b", background: i % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                          {emEdicao ? (
                            <>
                              <td style={{ padding:"8px" }}><input value={editHistForm.ticker} onChange={e=>setEditHistForm({...editHistForm, ticker:e.target.value})} style={{ width:"90px", ...inputStyle, padding:"4px" }} /></td>
                              <td style={{ padding:"8px" }}><input value={editHistForm.nome} onChange={e=>setEditHistForm({...editHistForm, nome:e.target.value})} style={{ width:"110px", ...inputStyle, padding:"4px" }} /></td>
                              <td style={{ padding:"8px" }}>
                                <select value={editHistForm.origem} onChange={e=>setEditHistForm({...editHistForm, origem:e.target.value})} style={{ ...inputStyle, padding:"4px" }}>
                                  <option value="LONGO">📈 Longo</option>
                                  <option value="RAPIDO">⚡ Swing</option>
                                </select>
                              </td>
                              <td style={{ padding:"8px" }}><input type="number" value={editHistForm.quantidade} onChange={e=>setEditHistForm({...editHistForm, quantidade:e.target.value})} style={{ width:"60px", ...inputStyle, padding:"4px" }} /></td>
                              <td style={{ padding:"8px" }}><input type="number" value={editHistForm.preco_entrada} onChange={e=>setEditHistForm({...editHistForm, preco_entrada:e.target.value})} style={{ width:"80px", ...inputStyle, padding:"4px" }} /></td>
                              <td style={{ padding:"8px" }}><input type="number" value={editHistForm.preco_saida} onChange={e=>setEditHistForm({...editHistForm, preco_saida:e.target.value})} style={{ width:"80px", ...inputStyle, padding:"4px" }} /></td>
                              <td colSpan={2} style={{ padding:"8px", fontSize:"11px", color:"#64748b" }}>recalculado ao salvar</td>
                              <td style={{ padding:"8px" }}>
                                <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                                  <input type="date" value={editHistForm.data_entrada} onChange={e=>setEditHistForm({...editHistForm, data_entrada:e.target.value})} style={{ ...inputStyle, padding:"3px", fontSize:"11px" }} title="Entrada" />
                                  <input type="date" value={editHistForm.data_saida} onChange={e=>setEditHistForm({...editHistForm, data_saida:e.target.value})} style={{ ...inputStyle, padding:"3px", fontSize:"11px" }} title="Saída" />
                                </div>
                              </td>
                              <td style={{ padding:"8px" }}></td>
                              <td style={{ padding:"8px" }}>
                                <div style={{ display:"flex", gap:"4px" }}>
                                  <button onClick={() => salvarEdicaoHist(h.id)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#16a34a", color:"white", fontSize:"11px", fontWeight:"600" }}>✓</button>
                                  <button onClick={() => setEditHist(null)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#334155", color:"white", fontSize:"11px" }}>✕</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding:"12px 10px", fontWeight:"700", color:"#38bdf8" }}>{h.ticker}</td>
                              <td style={{ padding:"12px 10px", color:"#cbd5e1" }}>{h.nome}</td>
                              <td style={{ padding:"12px 10px" }}>
                                <span style={{ padding:"2px 8px", borderRadius:"8px", fontSize:"11px", background: h.origem === "RAPIDO" ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)", color: h.origem === "RAPIDO" ? "#f59e0b" : "#38bdf8" }}>
                                  {h.origem === "RAPIDO" ? "⚡ Swing" : "📈 Longo"}
                                </span>
                              </td>
                              <td style={{ padding:"12px 10px", color:"#cbd5e1" }}>{h.quantidade}</td>
                              <td style={{ padding:"12px 10px", color:"#94a3b8" }}>{moeda(h.mercado)} {fmt(h.preco_entrada)}</td>
                              <td style={{ padding:"12px 10px", color:"#94a3b8" }}>{moeda(h.mercado)} {fmt(h.preco_saida)}</td>
                              <td style={{ padding:"12px 10px" }}>
                                <span style={{ color: h.pl >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                                  {h.pl >= 0 ? "▲" : "▼"} {moeda(h.mercado)} {fmt(Math.abs(h.pl))}
                                </span>
                              </td>
                              <td style={{ padding:"12px 10px" }}>
                                <span style={{ padding:"2px 8px", borderRadius:"8px", fontSize:"12px", fontWeight:"600", background: h.pl >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: h.pl >= 0 ? "#4ade80" : "#f87171" }}>
                                  {h.pl >= 0 ? "+" : ""}{h.pl_pct}%
                                </span>
                              </td>
                              <td style={{ padding:"12px 10px", color:"#94a3b8" }}>{h.dias}d</td>
                              <td style={{ padding:"12px 10px", color:"#94a3b8" }}>{fmtData(h.data_saida)}</td>
                              <td style={{ padding:"12px 10px" }}>
                                <div style={{ display:"flex", gap:"4px" }}>
                                  <button onClick={() => iniciarEdicaoHist(h)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#d97706", color:"white", fontSize:"11px" }} title="Editar (bater com Excel)">✏️</button>
                                  <button onClick={() => apagarHistorico(h.id)} style={{ padding:"4px 8px", borderRadius:"4px", border:"none", cursor:"pointer", background:"#dc2626", color:"white", fontSize:"11px", fontWeight:"600" }}>🗑️</button>
                                </div>
                              </td>
                            </>
                          )}
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

      {/* ── ABA: PERFORMANCE MENSAL ── */}
      {abaAtiva === "performance" && (
        {/* ── O CAMINHO DO DINHEIRO ── */}
          <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"24px", marginBottom:"20px" }}>
            <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", marginBottom:"20px" }}>O CAMINHO DO DINHEIRO</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-around", flexWrap:"wrap", gap:"16px" }}>
              <div style={{ textAlign:"center", minWidth:"140px" }}>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"6px" }}>Comprei</div>
                <div style={{ fontSize:"26px", fontWeight:"bold", color:"#cbd5e1" }}>R$ {fmt(totalComprado)}</div>
                <div style={{ fontSize:"10px", color:"#475569", marginTop:"4px" }}>{historico.length} trades</div>
              </div>
              <div style={{ fontSize:"24px", color:"#334155" }}>→</div>
              <div style={{ textAlign:"center", minWidth:"140px" }}>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"6px" }}>Vendi</div>
                <div style={{ fontSize:"26px", fontWeight:"bold", color:"#cbd5e1" }}>R$ {fmt(totalVendido)}</div>
                <div style={{ fontSize:"10px", color:"#475569", marginTop:"4px" }}>tudo que voltou</div>
              </div>
              <div style={{ fontSize:"24px", color:"#334155" }}>=</div>
              <div style={{ textAlign:"center", minWidth:"160px" }}>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"6px" }}>Sobrou</div>
                <div style={{ fontSize:"30px", fontWeight:"bold", color: (totalVendido - totalComprado) >= 0 ? "#4ade80" : "#f87171" }}>
                  R$ {fmt(totalVendido - totalComprado)}
                </div>
                <div style={{ fontSize:"12px", color: retornoSobreMovimentado >= 0 ? "#4ade80" : "#f87171", marginTop:"4px", fontWeight:"600" }}>
                  {retornoSobreMovimentado >= 0 ? "+" : ""}{retornoSobreMovimentado.toFixed(2)}% sobre o movimentado
                </div>
              </div>
            </div>
          </div>

          {/* ── COMO VOCE OPERA ── */}
          <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
            <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", marginBottom:"16px" }}>COMO VOCÊ OPERA</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:"16px" }}>
              <div>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"4px" }}>Quando acerta, ganha</div>
                <div style={{ fontSize:"22px", fontWeight:"bold", color:"#4ade80" }}>+{ganhoMedio.toFixed(2)}%</div>
                <div style={{ fontSize:"10px", color:"#475569" }}>média de {vencedores.length} trades</div>
              </div>
              <div>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"4px" }}>Quando erra, perde</div>
                <div style={{ fontSize:"22px", fontWeight:"bold", color:"#f87171" }}>{perdaMedia.toFixed(2)}%</div>
                <div style={{ fontSize:"10px", color:"#475569" }}>média de {perdedores.length} trades</div>
              </div>
              <div>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"4px" }}>Melhor trade</div>
                <div style={{ fontSize:"22px", fontWeight:"bold", color:"#4ade80" }}>
                  {melhorTrade ? `+${parseFloat(melhorTrade.pl_pct).toFixed(2)}%` : "—"}
                </div>
                <div style={{ fontSize:"10px", color:"#475569" }}>{melhorTrade ? melhorTrade.ticker : ""}</div>
              </div>
              <div>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"4px" }}>Pior trade</div>
                <div style={{ fontSize:"22px", fontWeight:"bold", color:"#f87171" }}>
                  {piorTrade ? `${parseFloat(piorTrade.pl_pct).toFixed(2)}%` : "—"}
                </div>
                <div style={{ fontSize:"10px", color:"#475569" }}>{piorTrade ? piorTrade.ticker : ""}</div>
              </div>
              <div>
                <div style={{ fontSize:"11px", color:"#64748b", marginBottom:"4px" }}>Acerto</div>
                <div style={{ fontSize:"22px", fontWeight:"bold", color: parseFloat(taxaAcerto) >= 60 ? "#4ade80" : "#f59e0b" }}>{taxaAcerto}%</div>
                <div style={{ fontSize:"10px", color:"#475569" }}>{vencedores.length} de {historico.length}</div>
              </div>
            </div>
            {perdedores.length > 0 && ganhoMedio > 0 && (
              <div style={{ marginTop:"16px", paddingTop:"16px", borderTop:"1px solid #1e293b", fontSize:"12px", color:"#94a3b8" }}>
                Você ganha {(ganhoMedio / Math.abs(perdaMedia)).toFixed(1)}x mais quando acerta do que perde quando erra.
              </div>
            )}
          </div>

          {/* ── LUCRO ACUMULADO ── */}
          {curvaAcumulada.length > 1 && (
            <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
              <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", marginBottom:"16px" }}>LUCRO ACUMULADO</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={curvaAcumulada}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="data" tick={{ fontSize:11, fill:"#64748b" }} />
                  <YAxis tick={{ fontSize:11, fill:"#64748b" }} />
                  <Tooltip
                    contentStyle={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:"8px" }}
                    formatter={(value) => [`R$ ${fmt(value)}`, "Acumulado"]}
                    labelFormatter={(label, payload) => payload && payload[0] ? `${payload[0].payload.ticker} · ${label}` : label}
                  />
                  <Line type="monotone" dataKey="acumulado" stroke="#4ade80" strokeWidth={2} dot={{ r:3, fill:"#4ade80" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── CALIBRAGEM DO STOP ── */}
          {tradesComMAE.length > 0 && (
            <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
              <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", marginBottom:"8px" }}>CALIBRAGEM DO STOP</div>
              <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"16px" }}>
                Quanto cada trade chegou a ficar negativo antes de terminar. Vencedores que sofreram muito indicam stop apertado demais.
              </div>
              {vencedoresQueSofreram > 0 && (
                <div style={{ padding:"10px 14px", borderRadius:"8px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", marginBottom:"16px", fontSize:"12px", color:"#f59e0b" }}>
                  {vencedoresQueSofreram} trade{vencedoresQueSofreram !== 1 ? "s" : ""} que deu{vencedoresQueSofreram !== 1 ? "ram" : ""} lucro chegou a mais de 4% negativo antes de virar.
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {tradesComMAE.map((t, i) => {
                  const larguraMAE = Math.min(Math.abs(t.maeNum) * 8, 100)
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:"12px", fontSize:"12px" }}>
                      <div style={{ width:"80px", color:"#cbd5e1", fontWeight:"600" }}>{t.ticker.replace(".SA","")}</div>
                      <div style={{ width:"70px", color: t.maeNum <= -4 ? "#f87171" : "#64748b", textAlign:"right" }}>
                        {t.maeNum.toFixed(2)}%
                      </div>
                      <div style={{ flex:1, height:"6px", background:"#1e293b", borderRadius:"3px", overflow:"hidden" }}>
                        <div style={{ width:`${larguraMAE}%`, height:"100%", background: t.maeNum <= -4 ? "#f87171" : "#475569", borderRadius:"3px" }} />
                      </div>
                      <div style={{ width:"70px", textAlign:"right", color: t.resultNum >= 0 ? "#4ade80" : "#f87171", fontWeight:"600" }}>
                        {t.resultNum >= 0 ? "+" : ""}{t.resultNum.toFixed(2)}%
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:"flex", gap:"20px", marginTop:"16px", paddingTop:"12px", borderTop:"1px solid #1e293b", fontSize:"11px", color:"#475569" }}>
                <span>Barra = quanto ficou negativo no pior momento</span>
                <span>Direita = resultado final</span>
              </div>
            </div>
          )}
        <>
          {dadosMensais.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#64748b" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>📊</div>
              <div>Nenhum dado de performance ainda</div>
              <div style={{ fontSize:"12px", marginTop:"6px" }}>Encerre posições para ver o histórico mensal aqui</div>
            </div>
          ) : (
            <>
              {dadosMensais.some(d => d.pl_br !== 0) && (
                <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
                  <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", marginBottom:"16px" }}>📊 P&L MENSAL — MERCADO BRASILEIRO (R$)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dadosMensais}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="mes" tick={{ fontSize:11, fill:"#64748b" }} />
                      <YAxis tick={{ fontSize:11, fill:"#64748b" }} />
                      <Tooltip formatter={(value) => [`R$ ${fmt(value)}`, "P&L"]} />
                      <Bar dataKey="pl_br" radius={[4,4,0,0]}>
                        {dadosMensais.map((d, i) => <Cell key={i} fill={d.pl_br >= 0 ? "#4ade80" : "#f87171"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {dadosMensais.some(d => d.pl_us !== 0) && (
                <div style={{ background:"#0d1829", border:"1px solid #1e293b", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
                  <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8", marginBottom:"16px" }}>📊 P&L MENSAL — MERCADO INTERNACIONAL (US$)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dadosMensais}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="mes" tick={{ fontSize:11, fill:"#64748b" }} />
                      <YAxis tick={{ fontSize:11, fill:"#64748b" }} />
                      <Tooltip formatter={(value) => [`US$ ${fmt(value)}`, "P&L"]} />
                      <Bar dataKey="pl_us" radius={[4,4,0,0]}>
                        {dadosMensais.map((d, i) => <Cell key={i} fill={d.pl_us >= 0 ? "#38bdf8" : "#f87171"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ overflowX:"auto", background:"#0d1829", borderRadius:"12px", border:"1px solid #1e293b" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", minWidth:"1000px" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #1e293b" }}>
                      {["Mês","Trades","Taxa de Acerto","Retorno Médio","Capital Inv. BR","Capital Rec. BR","P&L BR (R$)","Capital Inv. Intl","Capital Rec. Intl","P&L Intl (US$)"].map(h => (
                        <th key={h} style={{ padding:"12px 10px", textAlign:"left", color:"#64748b", fontSize:"11px", fontWeight:"600", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosMensais.map((d, i) => {
                      const taxa = d.trades > 0 ? ((d.lucrativos / d.trades) * 100).toFixed(0) : 0
                      const retornoMedioMes = historico
                        .filter(h => {
                          if (!h.data_saida) return false
                          const dd = new Date(h.data_saida)
                          if (isNaN(dd.getTime())) return false
                          return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}` === d.chave
                        })
                        .reduce((acc, h, _, arr) => acc + parseFloat(h.pl_pct) / arr.length, 0)
                        .toFixed(2)
                      return (
                        <tr key={i} style={{ borderBottom:"1px solid #1e293b", background: i % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                          <td style={{ padding:"12px 10px", color:"#f1f5f9", fontWeight:"600" }}>{d.mes}</td>
                          <td style={{ padding:"12px 10px", color:"#cbd5e1" }}>{d.trades}</td>
                          <td style={{ padding:"12px 10px" }}>
                            <span style={{ padding:"2px 8px", borderRadius:"8px", fontSize:"12px", background: parseFloat(taxa) >= 50 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: parseFloat(taxa) >= 50 ? "#4ade80" : "#f87171" }}>{taxa}%</span>
                          </td>
                          <td style={{ padding:"12px 10px" }}>
                            <span style={{ color: parseFloat(retornoMedioMes) >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"12px" }}>
                              {parseFloat(retornoMedioMes) >= 0 ? "+" : ""}{retornoMedioMes}%
                            </span>
                          </td>
                          <td style={{ padding:"12px 10px", color:"#94a3b8" }}>R$ {fmt(d.cap_inv_br)}</td>
                          <td style={{ padding:"12px 10px" }}>
                            <span style={{ color: d.cap_rec_br >= d.cap_inv_br ? "#4ade80" : "#f87171", fontSize:"12px", fontWeight:"600" }}>R$ {fmt(d.cap_rec_br)}</span>
                          </td>
                          <td style={{ padding:"12px 10px" }}>
                            <div>
                              <div style={{ color: d.pl_br >= 0 ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                                {d.pl_br >= 0 ? "▲ " : "▼ "}R$ {fmt(Math.abs(d.pl_br))}
                              </div>
                              {d.cap_inv_br > 0 && (
                                <div style={{ fontSize:"10px", color: d.pl_br >= 0 ? "#4ade80" : "#f87171", opacity:0.8 }}>
                                  {d.pl_br >= 0 ? "+" : ""}{(d.pl_br / d.cap_inv_br * 100).toFixed(2)}% s/ capital
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding:"12px 10px", color:"#94a3b8" }}>{d.cap_inv_us > 0 ? `US$ ${fmt(d.cap_inv_us)}` : "—"}</td>
                          <td style={{ padding:"12px 10px" }}>
                            {d.cap_rec_us > 0 ? (
                              <span style={{ color: d.cap_rec_us >= d.cap_inv_us ? "#38bdf8" : "#f87171", fontSize:"12px", fontWeight:"600" }}>US$ {fmt(d.cap_rec_us)}</span>
                            ) : "—"}
                          </td>
                          <td style={{ padding:"12px 10px" }}>
                            {d.pl_us !== 0 ? (
                              <div>
                                <div style={{ color: d.pl_us >= 0 ? "#38bdf8" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                                  {d.pl_us >= 0 ? "▲ " : "▼ "}US$ {fmt(Math.abs(d.pl_us))}
                                </div>
                                {d.cap_inv_us > 0 && (
                                  <div style={{ fontSize:"10px", color: d.pl_us >= 0 ? "#38bdf8" : "#f87171", opacity:0.8 }}>
                                    {d.pl_us >= 0 ? "+" : ""}{(d.pl_us / d.cap_inv_us * 100).toFixed(2)}% s/ capital
                                  </div>
                                )}
                              </div>
                            ) : "—"}
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
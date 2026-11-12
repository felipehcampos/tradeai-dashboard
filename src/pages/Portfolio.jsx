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
  const [resultadoGeral, setResultadoGeral] = useState(null)  // 09/11/2026: mesma conta do Financeiro (backend)
  const [filtroOrigem, setFiltroOrigem] = useState("todos")
  const [ordemData, setOrdemData] = useState("asc")
  const [editHist, setEditHist] = useState(null)      // id do trade do histórico em edição
  const [editHistForm, setEditHistForm] = useState({})
  // ── Modal de histórico de preços: período e camadas ──
  const [histPeriodo, setHistPeriodo] = useState("30d")       // "30d" | "3m" | "6m"
  const [histMostrarEntrada, setHistMostrarEntrada] = useState(true)
  const [histMostrarAlvoStop, setHistMostrarAlvoStop] = useState(true)

    // ── ATR Trailing Stop (21,3) das posições: na compra e agora (30/09/2026) ──
  const [atrPos, setAtrPos] = useState({})
  const [atrCarregado, setAtrCarregado] = useState(false)
  const [atrAberto, setAtrAberto] = useState(null)   // 09/11: posição com a lista de dias do ATR aberta
  const [selPos, setSelPos] = useState(null)          // 10/11: posição escolhida (painel da direita)
  const [grafPos, setGrafPos] = useState({ ticker: null, velas: [], carregando: false, erro: null })
  const [grafTabela, setGrafTabela] = useState(false)   // 12/11: tabela diária dentro do gráfico ampliado
  const [grafAmp, setGrafAmp] = useState(null)   // 11/11: gráfico ampliado {ticker, pregoes, velas, carregando, erro}

  const carregarAtr = async (lista) => {
    try {
      const precos = {}
      lista.forEach(p => { if (p.preco_atual) precos[p.ticker.toUpperCase().trim()] = p.preco_atual })
      const res = await api.post(`${API}/portfolio/atr`, { precos })
      if (res.data.sucesso) setAtrPos(res.data.dados || {})
    } catch {
      console.error("Erro ao carregar ATR do portfólio")
    } finally {
      setAtrCarregado(true)
    }
  }

  // ── Próximas datas-com de dividendos/JCP das posições B3 (22/10/2026) ──
  const [dividendosPos, setDividendosPos] = useState({})
  const [dividendosHist, setDividendosHist] = useState({})   // {id: {total_liquido, eventos...}}
  const carregarDividendos = async (lista) => {
    try {
      const tickers = [...new Set(lista.map(p => (p.ticker || "").toUpperCase().trim()).filter(t => t.endsWith(".SA")))]
      if (!tickers.length) return
      const res = await api.post(`${API}/dividendos/proximos`, { tickers, dias: 30 })
      if (res.data.sucesso) setDividendosPos(res.data.dados || {})
    } catch {
      console.error("Erro ao carregar datas-com")
    }
  }
  const fmtDia = (iso) => iso ? iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/") : ""

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
          dias: p.dias != null ? parseInt(p.dias) : diasNaOperacao(p.data_entrada || p.criado_em),
          mfe_pct: p.mfe_pct != null ? parseFloat(p.mfe_pct) : null,
          mae_pct: p.mae_pct != null ? parseFloat(p.mae_pct) : null
        }))
        setPosicoes(mapeado)
        carregarAtr(mapeado)
        carregarDividendos(mapeado)
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
          pl: (parseFloat(h.preco_saida || 0) - parseFloat(h.preco_entrada || 0)) * parseFloat(h.quantidade || 0),
          mfe_pct: h.mfe_pct != null ? parseFloat(h.mfe_pct) : null,
          mae_pct: h.mae_pct != null ? parseFloat(h.mae_pct) : null
        }))
        setHistorico(mapeado)
        carregarDividendosHist()
      }
    } catch {
      console.error("Erro ao carregar histórico")
    }
  }

  // Proventos (dividendos/JCP) a que cada trade fechado teve direito — só B3
  const carregarDividendosHist = async () => {
    try {
      const res = await api.get(`${API}/dividendos/recebidos`)
      if (res.data?.sucesso) setDividendosHist(res.data.historico || {})
    } catch {
      console.error("Erro ao carregar dividendos do histórico")
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
    api.get(`${API}/resultado-geral`).then(r => { if (r.data.sucesso) setResultadoGeral(r.data) })
      .catch(e => console.warn("Resultado geral indisponível:", e?.message))
  }, [])

  // Busca o histórico de preços de uma posição para um período dado.
  // Atualiza o preço atual da posição só na primeira abertura (não ao trocar período).
  const buscarHistoricoAtivo = async (p, periodo, atualizarPreco = false) => {
    setCarregandoHist(true)
    setDadosHistorico([])
    try {
      const res = await api.get(`${API}/portfolio/historico/${p.ticker}`, {
        params: { data_inicio: p.data, periodo }
      })
      if (res.data.sucesso) {
        const dados = res.data.dados || []
        setDadosHistorico(dados)
        if (atualizarPreco && dados.length > 0) {
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

  // Abre o modal: período padrão 30d e busca inicial (atualiza o preço atual).
  const abrirHistoricoAtivo = async (p) => {
    setModalHistorico(p)
    setHistPeriodo("30d")
    await buscarHistoricoAtivo(p, "30d", true)
  }

  // Troca o período dentro do modal (rebusca sem mexer no preço atual).
  const trocarPeriodoHist = async (novoPeriodo) => {
    if (!modalHistorico) return
    setHistPeriodo(novoPeriodo)
    await buscarHistoricoAtivo(modalHistorico, novoPeriodo, false)
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
    setEditForm({ quantidade: p.quantidade, preco_entrada: p.preco_entrada, alvo_lucro: p.alvo_lucro ?? "", stop_loss: p.stop_loss ?? "" })
  }

    const salvarEdicao = async (p) => {
    try {
      // UPDATE in-place via PUT — preserva mfe_pct/mae_pct e os extremos.
      const res = await api.put(`${API}/portfolio/${p.id}`, {
        quantidade: parseFloat(editForm.quantidade),
        preco_medio: parseFloat(editForm.preco_entrada),
        preco_entrada: parseFloat(editForm.preco_entrada),
        alvo_lucro: editForm.alvo_lucro !== "" && editForm.alvo_lucro != null ? parseFloat(editForm.alvo_lucro) : null,
        stop_loss: editForm.stop_loss !== "" && editForm.stop_loss != null ? parseFloat(editForm.stop_loss) : null,
      })
      if (res.data?.sucesso === false) {
        alert(res.data.erro || "Erro ao salvar edição.")
        return
      }
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
        carregarAtr(novas)
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
      const setor = p.setor || getSetor(p.ticker)   // setor salvo pelo backend (15/10/2026)
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

  const inputStyle = { padding:"10px", borderRadius:"10px", border:"1px solid #1E3352", background:"#0A1424", color:"#E6EDF7", fontSize:"13px" }

  // ══════════ Future Intelligence (10/11/2026): lista resumida + painel da posição ══════════
  const fiBotao = (ativo = true) => ({
    height:"34px", padding:"0 16px", borderRadius:"999px", border:"1px solid var(--fi-borda-forte)",
    background: ativo ? "rgba(56,189,248,0.08)" : "#132238", color: ativo ? "var(--fi-texto)" : "var(--fi-texto-4)",
    fontSize:"12px", cursor: ativo ? "pointer" : "default", display:"inline-flex", alignItems:"center", gap:"6px",
  })
  const fiFiltro = (on, grande = false) => ({
    height: grande ? "34px" : "30px", padding:"0 14px", borderRadius:"999px", cursor:"pointer", fontSize: grande ? "13px" : "11.5px",
    fontWeight: on ? 600 : 400, border:`1px solid ${on ? "rgba(56,189,248,0.6)" : "var(--fi-borda-forte)"}`,
    background: on ? "rgba(56,189,248,0.14)" : "transparent", color: on ? "var(--fi-texto)" : "var(--fi-texto-3)",
    boxShadow: on ? "0 0 14px rgba(56,189,248,0.25)" : "none",
  })
  const fiPill = (cor, fundo, borda) => ({
    display:"inline-flex", alignItems:"center", gap:"4px", padding:"3px 9px", borderRadius:"999px",
    fontSize:"11px", fontWeight:600, whiteSpace:"nowrap", color:cor, background:fundo, border:`1px solid ${borda}`,
  })
  const P_OK = fiPill("#22D3A0", "rgba(34,211,160,0.10)", "rgba(34,211,160,0.35)")
  const P_WARN = fiPill("#FBBF24", "rgba(251,191,36,0.10)", "rgba(251,191,36,0.35)")
  const P_BAD = fiPill("#FB6474", "rgba(251,100,116,0.10)", "rgba(251,100,116,0.35)")
  const P_NEU = fiPill("#9DB0CB", "#132238", "#1E3352")
  const GRADE_POS = "150px 120px 100px minmax(180px, 1fr) 150px 130px"

  const posSelecionada = posicoesFiltradas.find(p => p.id === selPos) || posicoesFiltradas[0] || null

  // Gráfico de velas da posição escolhida (mesma rota do Mercado)
  useEffect(() => {
    const t = posSelecionada ? posSelecionada.ticker.toUpperCase().trim() : null
    if (!t) return
    let vivo = true
    setGrafPos({ ticker: t, velas: [], carregando: true, erro: null })
    api.get(`${API}/mercado/grafico/${t}`, { params: { pregoes: 90 } })
      .then(r => { if (vivo) setGrafPos({ ticker: t, velas: r.data.sucesso ? (r.data.velas || []) : [], carregando: false, erro: r.data.sucesso ? null : (r.data.erro || "erro") }) })
      .catch(e => { if (vivo) setGrafPos({ ticker: t, velas: [], carregando: false, erro: e?.message || "sem resposta" }) })
    return () => { vivo = false }
  }, [posSelecionada ? posSelecionada.ticker : null])

  // 11/11/2026 — gráfico ampliado (tela cheia), com escolha de período
  const abrirGrafAmp = (t, pregoes) => {
    setGrafAmp({ ticker: t, pregoes, velas: [], carregando: true, erro: null })
    api.get(`${API}/mercado/grafico/${t}`, { params: { pregoes } })
      .then(r => setGrafAmp(g => g && g.ticker === t && g.pregoes === pregoes ? { ...g, velas: r.data.sucesso ? (r.data.velas || []) : [], carregando: false, erro: r.data.sucesso ? null : (r.data.erro || "erro") } : g))
      .catch(e => setGrafAmp(g => g && g.ticker === t && g.pregoes === pregoes ? { ...g, carregando: false, erro: e?.message || "sem resposta" } : g))
  }
  useEffect(() => {
    if (!grafAmp) return
    const fechar = (e) => { if (e.key === "Escape") setGrafAmp(null) }
    window.addEventListener("keydown", fechar)
    return () => window.removeEventListener("keydown", fechar)
  }, [grafAmp ? true : false])

  const infoPosicao = (p) => {
    const pl = (p.preco_atual - p.preco_entrada) * p.quantidade
    const plPct = (p.preco_atual - p.preco_entrada) / p.preco_entrada * 100
    const alvo = p.alvo_lucro, stop = p.stop_loss
    const caminho = alvo && alvo !== p.preco_entrada ? (p.preco_atual - p.preco_entrada) / (alvo - p.preco_entrada) * 100 : null
    const paraStop = stop ? (stop / p.preco_atual - 1) * 100 : null
    const paraAlvo = alvo ? (alvo / p.preco_atual - 1) * 100 : null
    const pertoStop = stop && p.preco_entrada > stop ? (p.preco_entrada - p.preco_atual) / (p.preco_entrada - stop) * 100 > 80 : false
    let situacao
    if (stop && p.preco_atual <= stop) situacao = { txt: "Abaixo do stop", estilo: P_BAD }
    else if (alvo && p.preco_atual >= alvo) situacao = { txt: "Alvo atingido", estilo: P_OK }
    else if (pertoStop) situacao = { txt: "Perto do stop", estilo: P_WARN }
    else if (caminho != null && caminho > 80) situacao = { txt: "Perto do alvo", estilo: P_OK }
    else situacao = { txt: "Em andamento", estilo: P_NEU }
    return { pl, plPct, emLucro: pl >= 0, alvo, stop, caminho, paraStop, paraAlvo, situacao,
      dias: p.dias != null ? p.dias : diasNaOperacao(p.data), dv: dividendosPos[(p.ticker || "").toUpperCase().trim()] }
  }

  // Barra stop → alvo com marcas da entrada e do preço de agora
  const BarraCaminho = ({ p, info }) => {
    if (!info.alvo || !info.stop || info.alvo <= info.stop) return <span style={{ fontSize:"11px", color:"#5F7391" }}>sem alvo/stop</span>
    const pos = (v) => Math.max(0, Math.min(100, (v - info.stop) / (info.alvo - info.stop) * 100))
    const corAgora = info.emLucro ? "#22D3A0" : "#FB6474"
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"5px", paddingRight:"8px" }}>
        <div style={{ position:"relative", height:"8px", borderRadius:"999px",
          background:"linear-gradient(90deg, rgba(251,100,116,0.55) 0%, #132238 35%, #132238 65%, rgba(34,211,160,0.55) 100%)" }}>
          <span title={`entrada ${fmt(p.preco_entrada)}`} style={{ position:"absolute", left:`${pos(p.preco_entrada)}%`, top:"-3px", width:"2px", height:"14px", background:"#FBBF24", transform:"translateX(-50%)" }} />
          <span title={`agora ${fmt(p.preco_atual)}`} style={{ position:"absolute", left:`${pos(p.preco_atual)}%`, top:"-3px", width:"14px", height:"14px", borderRadius:"50%",
            background:corAgora, border:"2px solid #04070D", transform:"translateX(-50%)", boxShadow:`0 0 8px ${corAgora}` }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10.5px" }}>
          <span style={{ color:"#FB6474" }}>stop {info.paraStop != null ? `${info.paraStop.toFixed(1).replace(".", ",")}%` : "—"}</span>
          <span style={{ color:"#22D3A0" }}>alvo {info.paraAlvo != null ? `${info.paraAlvo >= 0 ? "+" : ""}${info.paraAlvo.toFixed(1).replace(".", ",")}%` : "—"}</span>
        </div>
      </div>
    )
  }

  const direcaoAtr = (a) => {
    const h = Array.isArray(a?.atr_hist) ? a.atr_hist : []
    if (h.length < 2) return null
    const verde = a.atr_cor === "VERDE", delta = h[h.length - 1].dist - h[0].dist, virou = h[0].cor !== h[h.length - 1].cor
    if (virou) return { txt: h[h.length - 1].cor === "VERDE" ? "▲ virou alta" : "▼ virou queda", cor: h[h.length - 1].cor === "VERDE" ? "#22D3A0" : "#FB6474" }
    if (Math.abs(delta) < 0.5) return { txt: "■ estável", cor: "#9DB0CB" }
    if (delta > 0) return { txt: verde ? "▲ ganhando força" : "▲ melhorando", cor: "#22D3A0" }
    return { txt: verde ? "▼ perdendo força" : "▼ piorando", cor: "#FB6474" }
  }

  const BarrinhasAtr = ({ h, alto = 16, larg = 6 }) => {
    const max = Math.max(...h.map(y => Math.abs(y.dist)), 1)
    return (
      <div style={{ display:"flex", alignItems:"flex-end", gap:"2px", height:`${alto}px` }}>
        {h.map((x, i) => (
          <div key={i} style={{ width:`${larg}px`, height:`${Math.max(3, Math.abs(x.dist) / max * alto)}px`, borderRadius:"1px",
            background: x.cor === "VERDE" ? "#22D3A0" : "#FB6474", opacity: i === h.length - 1 ? 1 : 0.55,
            boxShadow: i === h.length - 1 ? `0 0 6px ${x.cor === "VERDE" ? "#22D3A0" : "#FB6474"}` : "none" }} />
        ))}
      </div>
    )
  }

  const MiniAtr = ({ a, carregado }) => {
    if (!a || !a.atr_cor) return <span style={{ color:"#5F7391", fontSize:"12px" }}>{carregado ? "—" : "…"}</span>
    const verde = a.atr_cor === "VERDE", dist = verde ? a.atr_margem_pct : a.atr_falta_pct
    const d = direcaoAtr(a), h = Array.isArray(a.atr_hist) ? a.atr_hist : []
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
        <span style={verde ? P_OK : P_BAD}>{verde ? "alta" : "queda"}{dist != null ? ` · ${verde ? "" : "falta "}${Number(dist).toFixed(1).replace(".", ",")}%` : ""}</span>
        {h.length >= 2 && (
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <BarrinhasAtr h={h} alto={12} larg={5} />
            {d && <span style={{ fontSize:"10px", fontWeight:600, color:d.cor }}>{d.txt}</span>}
          </div>
        )}
      </div>
    )
  }

  const GraficoVelas = ({ p, dados = grafPos, H = 240, eixos = false }) => {
    const t = p.ticker.toUpperCase().trim()
    const caixa = (txt) => <div style={{ height:`${H}px`, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--fi-texto-4)", fontSize:"12px" }}>{txt}</div>
    if (dados.carregando || dados.ticker !== t) return caixa("Carregando gráfico…")
    if (dados.erro || !dados.velas.length) return caixa(`Gráfico indisponível agora (${dados.erro || "sem dados"}).`)
    const v = dados.velas
    const refs = [p.preco_entrada, p.alvo_lucro, p.stop_loss].filter(x => x)
    const vals = v.flatMap(x => [x.h, x.l]).concat(refs)
    const lo = Math.min(...vals) * 0.995, hi = Math.max(...vals) * 1.005
    const y = (q) => (1 - (q - lo) / (hi - lo)) * H, cw = 100 / v.length
    const linha = (q, cor, rot, abaixo) => !q ? null : (
      <div style={{ position:"absolute", left:0, right:0, top:`${y(q)}px`, borderTop:`1px dashed ${cor}`, boxShadow:`0 0 8px ${cor}` }}>
        <span style={{ position:"absolute", right:"6px", top: abaixo ? "4px" : "-18px", fontSize:"10px", fontWeight:600, color:cor, background:"rgba(4,7,13,0.7)", padding:"0 4px", borderRadius:"4px" }}>{rot} {fmt(q)}</span>
      </div>
    )
    return (
      <div role="img" aria-label={`Gráfico de velas de ${p.ticker} com entrada, alvo, stop e ATR`}
        style={{ position:"relative", height:`${H}px`, borderRadius:"10px", overflow:"hidden",
          backgroundImage:"linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
          backgroundSize:"100% 48px, 60px 100%" }}>
        {v.map((x, i) => {
          const up = x.c >= x.o, cor = up ? "#22D3A0" : "#FB6474", left = (i + 0.5) * cw
          const bt = y(Math.max(x.o, x.c)), bb = y(Math.min(x.o, x.c))
          return (
            <div key={i} title={`${x.data.split("-").reverse().join("/")} · fech ${fmt(x.c)} · máx ${fmt(x.h)} · mín ${fmt(x.l)}${x.atr ? ` · ATR ${fmt(x.atr)}` : ""}`}>
              <div style={{ position:"absolute", left:`calc(${left}% - 0.5px)`, top:`${y(x.h)}px`, height:`${Math.max(1, y(x.l) - y(x.h))}px`, width:"1px", background:cor, opacity:0.8 }} />
              <div style={{ position:"absolute", left: eixos ? `${left - cw * 0.32}%` : `calc(${left}% - ${Math.max(1.5, Math.min(3.5, cw * 3))}px)`, top:`${bt}px`, height:`${Math.max(1.5, bb - bt)}px`,
                width: eixos ? `${cw * 0.64}%` : `${Math.max(3, Math.min(7, cw * 6))}px`, borderRadius:"1.5px", background:cor }} />
              {x.atr != null && x.atr > lo && x.atr < hi && (
                <div style={{ position:"absolute", left:`calc(${left}% - ${v.length > 400 ? 1 : 2}px)`, top:`${y(x.atr) - (v.length > 400 ? 1 : 2)}px`, width: v.length > 400 ? "2px" : "4px", height: v.length > 400 ? "2px" : "4px", borderRadius:"50%",
                  background: x.atr_cor === "VERDE" ? "#A3E635" : "#FB6474", opacity:0.85 }} />
              )}
            </div>
          )
        })}
        {linha(p.alvo_lucro, "#22D3A0", "alvo")}
        {linha(p.preco_entrada, "#FBBF24", "entrada")}
        {linha(p.stop_loss, "#FB6474", "stop", true)}
        {eixos && [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => {
          const q = hi - f * (hi - lo)
          return <span key={"y" + f} style={{ position:"absolute", left:"6px", top:`${f * H}px`, transform: f === 0 ? "none" : f === 1 ? "translateY(-100%)" : "translateY(-50%)", fontSize:"10.5px", color:"var(--fi-texto-4)", background:"rgba(4,7,13,0.6)", padding:"0 4px", borderRadius:"4px", pointerEvents:"none" }}>{fmt(q)}</span>
        })}
        {eixos && v.map((x, i) => {
          const passo = Math.max(1, Math.round(v.length / 8))
          if (i % passo !== 0) return null
          return <span key={"x" + i} style={{ position:"absolute", left:`${(i + 0.5) * cw}%`, bottom:"4px", transform:"translateX(-50%)", fontSize:"10.5px", color:"var(--fi-texto-4)", pointerEvents:"none" }}>{v.length > 300 ? `${x.data.slice(5, 7)}/${x.data.slice(2, 4)}` : x.data.split("-").reverse().slice(0, 2).join("/")}</span>
        })}
      </div>
    )
  }

  const PainelPosicao = ({ p }) => {
    const info = infoPosicao(p), a = atrPos[String(p.id)], estaEditando = editando === p.id
    const h = Array.isArray(a?.atr_hist) ? a.atr_hist : [], d = direcaoAtr(a)
    const verdeAtr = a?.atr_cor === "VERDE", distAtr = a ? (verdeAtr ? a.atr_margem_pct : a.atr_falta_pct) : null
    const frac = info.caminho != null ? Math.max(0, Math.min(1, info.caminho / 100)) : 0
    const C = 2 * Math.PI * 50, corAnel = info.emLucro ? "#22D3A0" : "#FB6474"
    const dm = (x) => x ? x.split("-").reverse().slice(0, 2).join("/") : ""
    const titulo = { margin:0, fontSize:"13px", fontWeight:600, color:"var(--fi-texto-2)" }
    const celula = (rot, val, cor, sub) => (
      <div style={{ padding:"10px 12px", borderRadius:"12px", background:"#0A1424", border:"1px solid var(--fi-borda)" }}>
        <div style={{ fontSize:"10.5px", color:"var(--fi-texto-4)" }}>{rot}</div>
        <div style={{ fontSize:"14px", fontWeight:600, color: cor || "var(--fi-texto)", marginTop:"2px" }}>{val}</div>
        {sub && <div style={{ fontSize:"10.5px", color:"var(--fi-texto-4)", marginTop:"2px", whiteSpace:"nowrap" }}>{sub}</div>}
      </div>
    )
    return (
      <aside aria-label={`Posição ${p.ticker}`} style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
        <section className="fi-painel" style={{ padding:"18px", borderColor:"var(--fi-borda-forte)", boxShadow:"inset 0 0 40px rgba(56,189,248,0.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
            <div>
              <div className="fi-titulo" style={{ fontSize:"24px", fontWeight:700 }}>{p.ticker.replace(".SA","")}</div>
              <div style={{ fontSize:"12px", color:"var(--fi-texto-3)" }}>{p.nome} · {p.setor} · {info.dias} dias</div>
            </div>
            <span style={info.situacao.estilo}>{info.situacao.txt}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"18px", marginTop:"14px" }}>
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true" style={{ flex:"none" }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#132238" strokeWidth="9" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={corAnel} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${(C * Math.max(0.02, frac)).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 60 60)"
                style={{ filter:`drop-shadow(0 0 6px ${corAnel})` }} />
              <text x="60" y="60" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="22" fontWeight="700">
                {info.caminho != null ? `${info.caminho.toFixed(0)}%` : "—"}
              </text>
              <text x="60" y="78" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="10">do caminho</text>
            </svg>
            <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
              <span style={{ fontSize:"10px", color:"var(--fi-texto-4)", textTransform:"uppercase", letterSpacing:"1.2px" }}>Resultado</span>
              <span className="fi-titulo" style={{ fontSize:"30px", fontWeight:600, color:corAnel, textShadow:`0 0 20px ${info.emLucro ? "rgba(34,211,160,0.45)" : "rgba(251,100,116,0.45)"}` }}>
                {info.emLucro ? "+" : "−"}{moeda(p.mercado)} {fmt(Math.abs(info.pl))}
              </span>
              <span style={{ fontSize:"13px", color:corAnel, fontWeight:600 }}>{info.plPct >= 0 ? "+" : ""}{info.plPct.toFixed(2)}%</span>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:"8px", marginTop:"14px" }}>
            {celula("Entrada", `${moeda(p.mercado)} ${fmt(p.preco_entrada)}`)}
            {celula("Agora", `${moeda(p.mercado)} ${fmt(p.preco_atual)}`)}
            {celula("Quantidade", `${p.quantidade} · ${moeda(p.mercado)} ${fmt(p.quantidade * p.preco_entrada)}`)}
            {celula("Alvo", info.alvo ? fmt(info.alvo) : "—", "#22D3A0", info.alvo ? `faltam ${info.paraAlvo.toFixed(1).replace(".", ",")}%` : null)}
            {celula("Stop", info.stop ? fmt(info.stop) : "—", "#FB6474", info.stop ? `a ${Math.abs(info.paraStop).toFixed(1).replace(".", ",")}% daqui` : null)}
            {celula("MFE / MAE", `${p.mfe_pct != null ? `+${p.mfe_pct.toFixed(1)}` : "—"} / ${p.mae_pct != null ? p.mae_pct.toFixed(1) : "—"}%`)}
          </div>
          {estaEditando && (
            <div style={{ marginTop:"14px", padding:"14px", borderRadius:"12px", background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.3)" }}>
              <div style={{ fontSize:"12px", fontWeight:600, color:"var(--fi-texto-2)", marginBottom:"10px" }}>Editar posição</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:"10px" }}>
                {[["quantidade","Quantidade"],["preco_entrada","Preço de entrada"],["alvo_lucro","Alvo"],["stop_loss","Stop"]].map(([campo, rot]) => (
                  <label key={campo} style={{ display:"flex", flexDirection:"column", gap:"4px", fontSize:"11px", color:"var(--fi-texto-4)" }}>{rot}
                    <input type="number" step="any" value={editForm[campo] ?? ""} onChange={e => setEditForm(f => ({ ...f, [campo]: e.target.value }))}
                      style={{ ...inputStyle, padding:"8px", width:"100%", boxSizing:"border-box" }} />
                  </label>
                ))}
              </div>
              <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
                <button type="button" onClick={() => salvarEdicao(p)} style={{ ...fiBotao(), color:"#22D3A0", borderColor:"rgba(34,211,160,0.45)", background:"rgba(34,211,160,0.10)", fontWeight:600 }}>Salvar</button>
                <button type="button" onClick={() => setEditando(null)} style={fiBotao()}>Cancelar</button>
              </div>
            </div>
          )}
          {info.dv && (
            <div style={{ marginTop:"10px", ...P_WARN, whiteSpace:"normal", borderRadius:"10px", padding:"6px 10px" }}>
              Data-com {fmtDia(info.dv.data_com)} · R$ {info.dv.valor_bruto.toFixed(2)}/ação (≈ R$ {(info.dv.valor_liquido * p.quantidade).toFixed(2)} líquido). No dia ex o preço abre mais baixo: é o provento, não stop.
            </div>
          )}
          <div style={{ display:"flex", gap:"8px", marginTop:"14px", flexWrap:"wrap" }}>
            {!estaEditando && <button type="button" onClick={() => iniciarEdicao(p)} style={fiBotao()}>Editar</button>}
            <button type="button" onClick={() => setModalEncerrar(p)} style={{ ...fiBotao(), color:"#22D3A0", borderColor:"rgba(34,211,160,0.45)", background:"rgba(34,211,160,0.10)", fontWeight:600 }}>Encerrar</button>
            <button type="button" onClick={() => { if (window.confirm(`Remover ${p.ticker}?`)) remover(p) }} style={{ ...fiBotao(), color:"#FB6474", borderColor:"rgba(251,100,116,0.4)", background:"transparent" }}>Remover</button>
          </div>
        </section>

        <section className="fi-painel" style={{ padding:"18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"10px", gap:"8px", flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <h2 style={titulo}>Gráfico · últimos 90 pregões</h2>
              <button type="button" onClick={() => abrirGrafAmp(p.ticker.toUpperCase().trim(), 90)} title="Ampliar gráfico" aria-label="Ampliar gráfico"
                style={{ height:"26px", padding:"0 12px", borderRadius:"999px", border:"1px solid var(--fi-borda-forte)", background:"rgba(56,189,248,0.08)", color:"#38BDF8", fontSize:"11.5px", cursor:"pointer" }}>⤢ Ampliar</button>
            </div>
            <div style={{ display:"flex", gap:"12px", fontSize:"10.5px", color:"var(--fi-texto-3)" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:12, height:2, background:"#22D3A0" }} />alvo</span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:12, height:2, background:"#FBBF24" }} />entrada</span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:12, height:2, background:"#FB6474" }} />stop</span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:5, height:5, borderRadius:"50%", background:"#A3E635" }} />ATR</span>
            </div>
          </div>
          <GraficoVelas p={p} />
        </section>

        <section className="fi-painel" style={{ padding:"18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }}>
            <h2 style={titulo}>ATR (21,3)</h2>
            {a?.atr_cor && <span style={verdeAtr ? P_OK : P_BAD}>{verdeAtr ? "alta" : "queda"}{distAtr != null ? ` · ${verdeAtr ? "margem" : "falta"} ${Number(distAtr).toFixed(1).replace(".", ",")}%` : ""}</span>}
          </div>
          {!a?.atr_cor ? (
            <div style={{ fontSize:"12px", color:"var(--fi-texto-4)", marginTop:"8px" }}>{atrCarregado ? "Sem ATR para este ativo." : "Carregando…"}</div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"flex-end", gap:"16px", marginTop:"14px" }}>
                {h.length >= 2 && <BarrinhasAtr h={h} alto={46} larg={14} />}
                <div style={{ display:"flex", flexDirection:"column", gap:"4px", fontSize:"12px" }}>
                  {d && <span style={{ fontWeight:700, color:d.cor }}>{d.txt}</span>}
                  <span style={{ color:"var(--fi-texto-3)" }}>linha em {moeda(p.mercado)} {fmt(a.atr_linha)}{a.atr_desde ? ` · nessa cor desde ${dm(a.atr_desde)}` : ""}</span>
                  <span style={{ color:"var(--fi-texto-3)" }}>na compra: {a.atr_compra_cor === "VERDE" ? "alta" : a.atr_compra_cor === "VERMELHO" ? "queda" : "—"}</span>
                </div>
              </div>
              {h.length >= 2 && (
                <div style={{ display:"grid", gridTemplateColumns:`repeat(${h.length}, minmax(0, 1fr))`, gap:"6px", marginTop:"12px" }}>
                  {h.map((x, i) => (
                    <div key={i} style={{ textAlign:"center", padding:"6px 4px", borderRadius:"8px", background:"#0A1424", border:"1px solid var(--fi-borda)" }}>
                      <div style={{ fontSize:"10px", color:"var(--fi-texto-4)" }}>{i === h.length - 1 ? "agora" : dm(x.data)}</div>
                      <div style={{ fontSize:"12px", fontWeight:700, color: x.cor === "VERDE" ? "#22D3A0" : "#FB6474" }}>{x.dist > 0 ? "+" : ""}{Number(x.dist).toFixed(1).replace(".", ",")}%</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize:"10.5px", color:"#5F7391", marginTop:"10px" }}>+ margem acima da linha (alta) · − quanto falta para virar alta · margem abaixo de 2%: confira na XP</div>
            </>
          )}
        </section>
      </aside>
    )
  }

  return (
  <div style={{ width:"100%", boxSizing:"border-box" }}>

      {/* Modal Histórico de Preços */}
      {grafAmp && posSelecionada && posSelecionada.ticker.toUpperCase().trim() === grafAmp.ticker && (() => {
        const p = posSelecionada, altura = Math.max(320, Math.round(window.innerHeight * 0.92) - 150)
        const pill = (on) => ({ height:"30px", padding:"0 14px", borderRadius:"999px", fontSize:"12px", cursor:"pointer",
          border:`1px solid ${on ? "rgba(56,189,248,0.6)" : "var(--fi-borda-forte)"}`, background: on ? "rgba(56,189,248,0.15)" : "transparent", color: on ? "#38BDF8" : "var(--fi-texto-3)" })
        return (
          <div onClick={() => setGrafAmp(null)} style={{ position:"fixed", inset:0, background:"rgba(2,4,8,0.82)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"2vh 2vw" }}>
            <div role="dialog" aria-modal="true" aria-label={`Gráfico ampliado de ${p.ticker}`} onClick={e => e.stopPropagation()}
              style={{ width:"100%", height:"100%", background:"#0B1426", border:"1px solid #1E3352", borderRadius:"18px", boxShadow:"0 30px 80px rgba(0,0,0,0.6)", padding:"18px 20px", display:"flex", flexDirection:"column", gap:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:"10px", flexWrap:"wrap" }}>
                  <h2 className="fi-titulo" style={{ margin:0, fontSize:"22px", fontWeight:700 }}>{p.ticker.replace(".SA", "")}</h2>
                  <span style={{ fontSize:"12px", color:"var(--fi-texto-3)" }}>últimos {grafAmp.pregoes} pregões · entrada {fmt(p.preco_entrada)}{p.alvo_lucro ? ` · alvo ${fmt(p.alvo_lucro)}` : ""}{p.stop_loss ? ` · stop ${fmt(p.stop_loss)}` : ""}</span>
                </div>
                <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
                  {[[90, "3 meses"], [125, "6 meses"], [250, "1 ano"], [500, "2 anos"], [1260, "5 anos"]].map(([n, rot]) => (
                    <button key={n} type="button" onClick={() => abrirGrafAmp(grafAmp.ticker, n)} style={pill(grafAmp.pregoes === n)}>{rot}</button>
                  ))}
                  <button type="button" onClick={() => setGrafTabela(!grafTabela)} aria-pressed={grafTabela} style={pill(grafTabela)}>☰ Tabela diária</button>
                  <button type="button" onClick={() => setGrafAmp(null)} aria-label="Fechar gráfico ampliado" style={{ ...pill(false), color:"var(--fi-texto)" }}>✕ Fechar</button>
                </div>
              </div>
              <div style={{ display:"flex", gap:"14px", fontSize:"11px", color:"var(--fi-texto-3)", flexWrap:"wrap" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:12, height:2, background:"#22D3A0" }} />alvo</span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:12, height:2, background:"#FBBF24" }} />entrada</span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:12, height:2, background:"#FB6474" }} />stop</span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:5, height:5, borderRadius:"50%", background:"#A3E635" }} />ATR em alta</span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:"5px" }}><span style={{ width:5, height:5, borderRadius:"50%", background:"#FB6474" }} />ATR em queda</span>
                <span>· passe o mouse numa vela para ver os valores do dia · Esc fecha</span>
              </div>
              <div style={{ display:"flex", gap:"14px", minHeight:0 }}>
                <div style={{ flex:1, minWidth:0 }}><GraficoVelas p={p} dados={grafAmp} H={altura} eixos /></div>
                {grafTabela && (
                  <div style={{ width:"300px", flexShrink:0, height:`${altura}px`, overflowY:"auto", borderRadius:"12px", border:"1px solid #1E3352", background:"#0A1424" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                      <thead style={{ position:"sticky", top:0, background:"#0A1424" }}>
                        <tr>{["Data", "Fech.", "vs entrada"].map(h => (
                          <th key={h} style={{ padding:"9px 10px", textAlign: h === "Data" ? "left" : "right", color:"#5F7391", fontSize:"10.5px", fontWeight:500, textTransform:"uppercase", letterSpacing:"1px" }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {[...(grafAmp.velas || [])].reverse().map(v => {
                          const pct = p.preco_entrada ? (v.c / p.preco_entrada - 1) * 100 : null
                          return (
                            <tr key={v.data}>
                              <td style={{ padding:"7px 10px", borderTop:"1px solid #101D31", color:"var(--fi-texto-3)" }}>{v.data.split("-").reverse().join("/")}</td>
                              <td style={{ padding:"7px 10px", borderTop:"1px solid #101D31", textAlign:"right" }}>{fmt(v.c)}</td>
                              <td style={{ padding:"7px 10px", borderTop:"1px solid #101D31", textAlign:"right", fontWeight:600, color: pct == null ? "#5F7391" : pct >= 0 ? "#22D3A0" : "#FB6474" }}>
                                {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%`}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 12/11/2026: janela antiga "Histórico de preços" retirada a pedido do Felipe — o gráfico ampliado (3m a 5a + tabela diária) cobre o mesmo */}

      {/* Modal Encerrar Posição (com venda parcial) */}
      {modalEncerrar && (
        <div onClick={() => setModalEncerrar(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0B1426", border:"1px solid #1E3352", borderRadius:"18px", boxShadow:"0 30px 80px rgba(0,0,0,0.6)", padding:"28px", maxWidth:"420px", width:"100%" }}>
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

      {/* ── CABEÇALHO (Future Intelligence, 10/11/2026) ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"18px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin:0, fontSize:"24px", fontWeight:700 }}>Portfólio</h1>
          <div style={{ display:"flex", gap:"12px", marginTop:"2px", fontSize:"12px", color:"var(--fi-texto-4)", flexWrap:"wrap" }}>
            <span>{posicoes.length} posiç{posicoes.length !== 1 ? "ões" : "ão"} aberta{posicoes.length !== 1 ? "s" : ""}</span>
            {ultimaAtualizacao && <span>atualizado às {ultimaAtualizacao}</span>}
            {cotacaoDolar && <span>USD/BRL R$ {cotacaoDolar.toFixed(2)}</span>}
          </div>
        </div>
        {posicoes.length > 0 && (
          <button type="button" onClick={atualizarPrecos} disabled={atualizando} style={fiBotao(!atualizando)}>
            {atualizando ? "Atualizando…" : "Atualizar preços"}
          </button>
        )}
      </div>

      {/* ── RESUMO ── */}
      {(() => {
        const tot = resultadoGeral ? resultadoGeral.total : resultadoTotalBRL
        const pctAberto = patrimonioInvestidoBRL > 0 ? lucroAbertoBRL / patrimonioInvestidoBRL * 100 : null
        const cards = [
          { label: "Resultado acumulado", valor: `R$ ${fmt(tot)}`, cor: tot >= 0 ? "#38BDF8" : "#FB6474", destaque: true,
            sub: resultadoGeral ? `realizado + em aberto + dividendos (R$ ${fmt(resultadoGeral.dividendos_fechados)})` : "realizado + em aberto" },
          { label: "Em aberto", valor: `R$ ${fmt(lucroAbertoBRL)}`, extra: pctAberto != null ? `${pctAberto >= 0 ? "+" : ""}${pctAberto.toFixed(1)}%` : "",
            cor: lucroAbertoBRL >= 0 ? "#22D3A0" : "#FB6474", sub: `R$ ${fmt(patrimonioInvestidoBRL)} investidos · valem R$ ${fmt(patrimonioTotalBRL)}` },
          { label: "Realizado", valor: `R$ ${fmt(lucroRealizadoBRL)}`, extra: mediaRetorno ? `${parseFloat(mediaRetorno) >= 0 ? "+" : ""}${mediaRetorno}% por trade` : "",
            cor: lucroRealizadoBRL >= 0 ? "#22D3A0" : "#FB6474", sub: `${historico.length} trades encerrados` },
          { label: "Acerto", valor: taxaAcerto != null ? `${taxaAcerto}%` : "—", cor: parseFloat(taxaAcerto) >= 60 ? "#22D3A0" : "#FBBF24",
            sub: historico.length ? `${historico.filter(h => h.pl >= 0).length} lucro / ${historico.filter(h => h.pl < 0).length} prejuízo` : "sem trades fechados" },
        ]
        const avisos = [
          { label: "Perto ou abaixo do stop", valor: posicoesNoStop, cor: posicoesNoStop > 0 ? "#FB6474" : "var(--fi-texto-4)" },
          { label: "Perto do alvo", valor: posicoesNoAlvo, cor: posicoesNoAlvo > 0 ? "#22D3A0" : "var(--fi-texto-4)" },
          { label: "Tempo médio por trade", valor: (() => {
              const t = historico.filter(h => h.dias != null && h.dias > 0)
              return t.length ? `${(t.reduce((a, h) => a + parseInt(h.dias), 0) / t.length).toFixed(0)} dias` : "—"
            })(), cor: "var(--fi-texto)" },
          { label: "Total movimentado", valor: `R$ ${fmt(capitalMovimentadoBRL)}`, cor: "var(--fi-texto)" },
        ]
        return (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(230px, 1fr))", gap:"14px", marginBottom:"14px" }}>
              {cards.map((c, i) => (
                <div key={i} className="fi-painel" style={{ padding:"16px 18px", ...(c.destaque ? { borderColor:"rgba(56,189,248,0.45)", boxShadow:"0 0 26px rgba(56,189,248,0.12)" } : {}) }}>
                  <div style={{ fontSize:"11px", color:"var(--fi-texto-4)", textTransform:"uppercase", letterSpacing:"1.2px" }}>{c.label}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:"8px", marginTop:"6px", flexWrap:"wrap" }}>
                    <span className="fi-titulo" style={{ fontSize:"24px", fontWeight:600, color:c.cor, textShadow: c.destaque ? "0 0 18px rgba(56,189,248,0.45)" : "none" }}>{c.valor}</span>
                    {c.extra && <span style={{ fontSize:"12px", color:c.cor, fontWeight:600 }}>{c.extra}</span>}
                  </div>
                  <div style={{ fontSize:"11px", color:"var(--fi-texto-4)", marginTop:"4px" }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:"14px", marginBottom:"18px" }}>
              {avisos.map((a, i) => (
                <div key={i} className="fi-painel" style={{ padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px" }}>
                  <span style={{ fontSize:"12px", color:"var(--fi-texto-3)" }}>{a.label}</span>
                  <span className="fi-titulo" style={{ fontSize:"17px", fontWeight:600, color:a.cor }}>{a.valor}</span>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {/* ── DISTRIBUIÇÃO ── */}
      {posicoes.length > 0 && (
        <section className="fi-painel" style={{ padding:"18px", marginBottom:"18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px", flexWrap:"wrap", gap:"10px" }}>
            <h2 style={{ margin:0, fontSize:"13px", fontWeight:600, color:"var(--fi-texto-2)" }}>Distribuição do capital investido</h2>
            <div style={{ display:"flex", gap:"6px" }}>
              {["ativo","setor"].map(modo => (
                <button key={modo} type="button" onClick={() => setModoGrafico(modo)} style={fiFiltro(modoGrafico === modo)}>
                  {modo === "ativo" ? "Por ativo" : "Por setor"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", columnGap:"28px", rowGap:"8px" }}>
            {dadosGrafico.slice().sort((a,b) => b.value - a.value).map((item, i) => {
              const maxVal = Math.max(...dadosGrafico.map(d => d.value))
              const pct = totalFicticioGrafico > 0 ? (item.value / totalFicticioGrafico) * 100 : 0
              const largura = maxVal > 0 ? (item.value / maxVal) * 100 : 0
              const acimaLimite = modoGrafico === "setor" && pct > 25
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"110px", fontSize:"12px", color:"var(--fi-texto-3)", textAlign:"right", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name.replace(".SA","")}</div>
                  <div style={{ flex:1, background:"#132238", borderRadius:"999px", height:"8px", overflow:"hidden" }}>
                    <div style={{ height:"8px", width:`${largura}%`, borderRadius:"999px",
                      background: acimaLimite ? "linear-gradient(90deg,#FBBF24,#FB6474)" : "linear-gradient(90deg,#2563EB,#38BDF8)",
                      boxShadow: `0 0 10px ${acimaLimite ? "rgba(251,100,116,0.5)" : "rgba(56,189,248,0.45)"}` }} />
                  </div>
                  <div style={{ width:"52px", fontSize:"12px", fontWeight:600, color: acimaLimite ? "#FB6474" : "var(--fi-texto)" }}>{pct.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
          {modoGrafico === "setor" && <div style={{ fontSize:"10.5px", color:"#5F7391", marginTop:"10px" }}>Limite do método: 25% por setor (em vermelho quando passa).</div>}
        </section>
      )}

      {/* ── SUB-ABAS ── */}
      <div role="tablist" style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
        {[
          { id:"abertas", label:"Posições abertas", count: posicoesFiltradas.length },
          { id:"historico", label:"Histórico de trades", count: historico.length }
        ].map(a => (
          <button key={a.id} type="button" role="tab" aria-selected={abaAtiva === a.id} onClick={() => setAbaAtiva(a.id)} style={fiFiltro(abaAtiva === a.id, true)}>
            {a.label} <span style={{ opacity:0.7, marginLeft:"4px" }}>{a.count}</span>
          </button>
        ))}
        {abaAtiva === "abertas" && (
          <>
            <span style={{ flex:1 }} />
            <button type="button" onClick={() => setOrdemData(o => o === "asc" ? "desc" : "asc")} style={fiBotao()}>
              {ordemData === "asc" ? "Mais antigas primeiro" : "Mais recentes primeiro"}
            </button>
            <button type="button" onClick={() => setMostrarForm(!mostrarForm)} style={{ ...fiBotao(), ...(mostrarForm ? {} : { background:"rgba(34,211,160,0.12)", borderColor:"rgba(34,211,160,0.4)", color:"#22D3A0", fontWeight:600 }) }}>
              {mostrarForm ? "Cancelar" : "+ Adicionar posição"}
            </button>
          </>
        )}
      </div>

      {/* ── ABA: POSIÇÕES ABERTAS ── */}
      {abaAtiva === "abertas" && (
        <>
          {mostrarForm && (
            <div className="fi-painel" style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", padding:"16px" }}>
              <input aria-label="Ticker" placeholder="Ticker (ex: VALE3.SA)" value={form.ticker} onChange={e => setForm({...form, ticker: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"150px" }} />
              <input aria-label="Nome" placeholder="Nome (ex: Vale)" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"150px" }} />
              <input aria-label="Quantidade" type="number" placeholder="Quantidade" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"110px" }} />
              <input aria-label="Preço de entrada" type="number" placeholder="Preço de entrada" value={form.preco_entrada} onChange={e => setForm({...form, preco_entrada: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"130px" }} />
              <input aria-label="Alvo" type="number" placeholder="Alvo (opcional)" value={form.alvo_lucro} onChange={e => setForm({...form, alvo_lucro: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"120px" }} />
              <input aria-label="Stop" type="number" placeholder="Stop (opcional)" value={form.stop_loss} onChange={e => setForm({...form, stop_loss: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"120px" }} />
              <input aria-label="Data de entrada" type="date" value={form.data_entrada} onChange={e => setForm({...form, data_entrada: e.target.value})} style={{ ...inputStyle, flex:1, minWidth:"140px" }} />
              <select aria-label="Mercado" value={form.mercado} onChange={e => setForm({...form, mercado: e.target.value})} style={inputStyle}>
                <option value="B3">B3</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="NYSE">NYSE</option>
                <option value="CRYPTO">CRYPTO</option>
                <option value="COMMODITY">COMMODITY</option>
              </select>
              <button type="button" onClick={adicionar} style={{ ...fiBotao(), background:"rgba(34,211,160,0.15)", borderColor:"rgba(34,211,160,0.45)", color:"#22D3A0", fontWeight:600, height:"40px" }}>Adicionar</button>
            </div>
          )}

          {carregando ? (
            <div style={{ textAlign:"center", padding:"40px", color:"var(--fi-texto-4)" }}>Carregando portfólio…</div>
          ) : posicoesFiltradas.length === 0 ? (
            <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--fi-texto-4)" }}>Nenhuma posição aberta.</div>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"18px", alignItems:"flex-start" }}>
              {/* Lista resumida */}
              <section aria-label="Posições abertas" className="fi-painel" style={{ flex:"999 1 620px", minWidth:0, overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <div style={{ minWidth:"880px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:GRADE_POS, gap:"10px", padding:"12px 18px", fontSize:"10.5px", color:"#5F7391", textTransform:"uppercase", letterSpacing:"1.1px" }}>
                      <span>Ativo</span><span>Resultado</span><span>Preço</span><span>Caminho stop → alvo</span><span>ATR (21,3)</span><span>Situação</span>
                    </div>
                    {posicoesFiltradas.map(p => {
                      const info = infoPosicao(p)
                      const escolhida = posSelecionada && posSelecionada.id === p.id
                      return (
                        <div key={p.id} role="button" tabIndex={0} aria-pressed={!!escolhida}
                          onClick={() => setSelPos(p.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelPos(p.id) } }}
                          style={{ display:"grid", gridTemplateColumns:GRADE_POS, gap:"10px", alignItems:"center", padding:"12px 18px", cursor:"pointer",
                            borderTop:"1px solid #101D31", fontSize:"12.5px",
                            background: escolhida ? "linear-gradient(90deg, rgba(56,189,248,0.14), rgba(56,189,248,0))" : "transparent",
                            boxShadow: escolhida ? "inset 3px 0 0 #38BDF8" : "none" }}>
                          <div style={{ display:"flex", flexDirection:"column", minWidth:0 }}>
                            <span style={{ fontWeight:600, fontSize:"14px" }}>{p.ticker.replace(".SA","")}</span>
                            <span style={{ fontSize:"11px", color:"var(--fi-texto-4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.setor} · {info.dias}d</span>
                            {info.dv && <span style={{ fontSize:"10px", color:"#FBBF24" }}>data-com {info.dv.dias_ate === 0 ? "hoje" : info.dv.dias_ate === 1 ? "amanhã" : fmtDia(info.dv.data_com)}</span>}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column" }}>
                            <span style={{ fontWeight:600, color: info.emLucro ? "#22D3A0" : "#FB6474" }}>{info.emLucro ? "+" : "−"}{moeda(p.mercado)} {fmt(Math.abs(info.pl))}</span>
                            <span style={{ fontSize:"11px", color: info.emLucro ? "#22D3A0" : "#FB6474" }}>{info.plPct >= 0 ? "+" : ""}{info.plPct.toFixed(2)}%</span>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column" }}>
                            <span>{fmt(p.preco_atual)}</span>
                            <span style={{ fontSize:"11px", color:"var(--fi-texto-4)" }}>entrada {fmt(p.preco_entrada)}</span>
                          </div>
                          <BarraCaminho p={p} info={info} />
                          <MiniAtr a={atrPos[String(p.id)]} carregado={atrCarregado} />
                          <span><span style={info.situacao.estilo}>{info.situacao.txt}</span></span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding:"10px 18px", fontSize:"10.5px", color:"#5F7391", borderTop:"1px solid var(--fi-borda)" }}>
                  Clique numa posição para ver o gráfico, o ATR e as ações (editar, encerrar).
                </div>
              </section>

              {/* Painel da posição */}
              <div style={{ flex:"1 1 400px", minWidth:0 }}>
                {posSelecionada && PainelPosicao({ p: posSelecionada })}
              </div>
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
                  <div key={i} style={{ padding:"14px", borderRadius:"12px", background:"rgba(13,24,41,0.7)", border:"1px solid #16253D" }}>
                    <div style={{ fontSize:"11px", color:"#94a3b8", marginBottom:"6px" }}>{card.label}</div>
                    <div style={{ fontSize:"18px", fontWeight:"bold", color: card.cor }}>{card.valor}</div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX:"auto", background:"rgba(13,24,41,0.7)", borderRadius:"16px", border:"1px solid #16253D" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", minWidth:"1000px" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #101D31" }}>
                      {["Ticker","Nome","Tipo","Qtd","Entrada","Saída","P&L","Retorno","Dividendos","MFE / MAE","Dias","Data Saída","Ações"].map(h => (
                        <th key={h} style={{ padding:"12px 10px", textAlign:"left", color:"#64748b", fontSize:"11px", fontWeight:"600", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h, i) => {
                      const emEdicao = editHist === h.id
                      return (
                        <tr key={h.id} style={{ borderBottom:"1px solid #101D31", background: "transparent" }}>
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
                              <td colSpan={3} style={{ padding:"8px", fontSize:"11px", color:"#64748b" }}>recalculado ao salvar</td>
                              <td style={{ padding:"8px" }}>
                                <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                                  <input type="date" value={editHistForm.data_entrada} onChange={e=>setEditHistForm({...editHistForm, data_entrada:e.target.value})} style={{ ...inputStyle, padding:"3px", fontSize:"11px" }} title="Entrada" />
                                  <input type="date" value={editHistForm.data_saida} onChange={e=>setEditHistForm({...editHistForm, data_saida:e.target.value})} style={{ ...inputStyle, padding:"3px", fontSize:"11px" }} title="Saída" />
                                </div>
                              </td>
                              <td style={{ padding:"8px" }}></td>
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
                                {(() => {
                                  // Resultado somando os proventos líquidos do período (23/10/2026)
                                  const dv = dividendosHist[String(h.id)]
                                  if (!dv || !(dv.total_liquido > 0)) return null
                                  const comDiv = h.pl + dv.total_liquido
                                  return (
                                    <div title="P&L + dividendos/JCP líquidos a que o trade teve direito" style={{ fontSize:"10px", marginTop:"3px", color: comDiv >= 0 ? "#4ade80" : "#f87171", opacity:0.8 }}>
                                      c/ div: {comDiv < 0 ? "−" : ""}{moeda(h.mercado)} {fmt(Math.abs(comDiv))}
                                    </div>
                                  )
                                })()}
                              </td>
                              <td style={{ padding:"12px 10px" }}>
                                <span style={{ padding:"2px 8px", borderRadius:"8px", fontSize:"12px", fontWeight:"600", background: h.pl >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: h.pl >= 0 ? "#4ade80" : "#f87171" }}>
                                  {h.pl >= 0 ? "+" : ""}{h.pl_pct}%
                                </span>
                              </td>
                              <td style={{ padding:"12px 10px", fontSize:"12px" }}>
                                {(() => {
                                  const dv = dividendosHist[String(h.id)]
                                  if (!dv || !dv.eventos || dv.eventos.length === 0) return <span style={{ color:"#475569" }}>—</span>
                                  const dica = dv.eventos.map(e =>
                                    `${fmtDia(e.data_com)} · ${e.tipo} R$ ${e.por_acao.toFixed(4)}/ação → R$ ${e.liquido.toFixed(2)} líquido · ${e.pago ? "pago" : `a receber${e.pagamento ? " em " + e.pagamento.split("-").reverse().join("/") : ""}`}`
                                  ).join("\n") + `\nLucro com proventos: R$ ${(h.pl + dv.total_liquido).toFixed(2)}`
                                  return (
                                    <div title={dica} style={{ cursor:"help" }}>
                                      <div style={{ color:"#fbbf24", fontWeight:"600" }}>💰 R$ {dv.total_liquido.toFixed(2)}</div>
                                      {dv.a_receber > 0 && <div style={{ color:"#94a3b8", fontSize:"10px", marginTop:"2px" }}>a receber R$ {dv.a_receber.toFixed(2)}</div>}
                                    </div>
                                  )
                                })()}
                              </td>
                              <td style={{ padding:"12px 10px", fontSize:"11px" }}>
                                <div style={{ color:"#4ade80" }}>
                                  {h.mfe_pct != null ? `+${parseFloat(h.mfe_pct).toFixed(2)}%` : "—"}
                                </div>
                                <div style={{ color:"#f87171", marginTop:"2px" }}>
                                  {h.mae_pct != null ? `${parseFloat(h.mae_pct).toFixed(2)}%` : "—"}
                                </div>
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

      {abaAtiva === "performance" && (
        <>
        {/* ── O CAMINHO DO DINHEIRO ── */}
          <div style={{ background:"rgba(13,24,41,0.7)", border:"1px solid #16253D", borderRadius:"12px", padding:"24px", marginBottom:"20px" }}>
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
                                    {retornoSobreMovimentado >= 0 ? "+" : ""}{retornoSobreMovimentado.toFixed(2)}% sobre o comprado
                </div>
              </div>
            </div>
          </div>

          {/* ── COMO VOCE OPERA ── */}
          <div style={{ background:"rgba(13,24,41,0.7)", border:"1px solid #16253D", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
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
            <div style={{ background:"rgba(13,24,41,0.7)", border:"1px solid #16253D", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
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
            <div style={{ background:"rgba(13,24,41,0.7)", border:"1px solid #16253D", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
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
          {dadosMensais.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#64748b" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>📊</div>
              <div>Nenhum dado de performance ainda</div>
              <div style={{ fontSize:"12px", marginTop:"6px" }}>Encerre posições para ver o histórico mensal aqui</div>
            </div>
          ) : (
            <>
              {dadosMensais.some(d => d.pl_br !== 0) && (
                <div style={{ background:"rgba(13,24,41,0.7)", border:"1px solid #16253D", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
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
                <div style={{ background:"rgba(13,24,41,0.7)", border:"1px solid #16253D", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
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

              <div style={{ overflowX:"auto", background:"rgba(13,24,41,0.7)", borderRadius:"16px", border:"1px solid #16253D" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", minWidth:"1000px" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #101D31" }}>
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
                        <tr key={i} style={{ borderBottom:"1px solid #101D31", background: "transparent" }}>
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
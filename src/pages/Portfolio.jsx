import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import axios from "axios"

const STORAGE_KEY = "tradeai_portfolio"
const CORES = ["#38bdf8","#4ade80","#f59e0b","#f87171","#a78bfa","#34d399","#fb923c","#60a5fa","#e879f9","#facc15"]
const API = import.meta.env.VITE_API_URL

const fmt = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})

// Mapeamento automático de setor por ticker
const SETORES = {
  // Bancos
  "ITUB4.SA":"Bancos","BBAS3.SA":"Bancos","BBDC4.SA":"Bancos","SANB11.SA":"Bancos",
  "BPAC11.SA":"Bancos","BRSR6.SA":"Bancos",
  // Mineração
  "VALE3.SA":"Mineração","GGBR4.SA":"Siderurgia","CSNA3.SA":"Siderurgia",
  "USIM5.SA":"Siderurgia","CMIN3.SA":"Mineração","BRAP4.SA":"Mineração",
  // Petróleo
  "PETR4.SA":"Petróleo","PETR3.SA":"Petróleo","PRIO3.SA":"Petróleo",
  "RECV3.SA":"Petróleo","VBBR3.SA":"Energia","CSAN3.SA":"Energia",
  // Energia Elétrica
  "EGIE3.SA":"Energia","ENGI11.SA":"Energia","CMIG4.SA":"Energia",
  "CPFE3.SA":"Energia","TAEE11.SA":"Energia","ENBR3.SA":"Energia",
  // Varejo
  "MGLU3.SA":"Varejo","LREN3.SA":"Varejo","ALPA4.SA":"Varejo",
  "SOMA3.SA":"Varejo","SBFG3.SA":"Varejo",
  // Saúde
  "HAPV3.SA":"Saúde","RDOR3.SA":"Saúde","FLRY3.SA":"Saúde",
  "ODPV3.SA":"Saúde","DASA3.SA":"Saúde",
  // Agro
  "AGRO3.SA":"Agronegócio","SLCE3.SA":"Agronegócio","SMTO3.SA":"Agronegócio",
  "JBSS3.SA":"Agronegócio","MRFG3.SA":"Agronegócio","BEEF3.SA":"Agronegócio",
  // Telecom
  "VIVT3.SA":"Telecom","TIMS3.SA":"Telecom",
  // Tecnologia
  "TOTVS3.SA":"Tecnologia","LWSA3.SA":"Tecnologia",
  // Imobiliário
  "CYRE3.SA":"Imobiliário","MRVE3.SA":"Imobiliário","EZTC3.SA":"Imobiliário",
  "MULT3.SA":"Imobiliário","ALOS3.SA":"Imobiliário",
  // Internacional
  "NVDA":"Tecnologia","AAPL":"Tecnologia","MSFT":"Tecnologia","GOOGL":"Tecnologia",
  "META":"Tecnologia","AMZN":"Tecnologia","NFLX":"Entretenimento",
  "TSLA":"Veículos Elétricos","RIVN":"Veículos Elétricos",
  "JPM":"Bancos","BAC":"Bancos","GS":"Bancos","V":"Financeiro","MA":"Financeiro",
  "XOM":"Petróleo","CVX":"Petróleo","COP":"Petróleo","SLB":"Petróleo",
  "LLY":"Saúde","NVO":"Saúde","ABBV":"Saúde","PFE":"Saúde","MRNA":"Saúde",
  "AVGO":"Semicondutores","AMD":"Semicondutores","INTC":"Semicondutores",
  "TSM":"Semicondutores","QCOM":"Semicondutores","ARM":"Semicondutores",
  "COIN":"Crypto","MSTR":"Crypto","RIOT":"Crypto","MARA":"Crypto",
  "BTC-USD":"Crypto","ETH-USD":"Crypto","SOL-USD":"Crypto","XRP-USD":"Crypto",
  "GC=F":"Commodities","CL=F":"Commodities","SI=F":"Commodities",
  "SHEL.L":"Petróleo","BP.L":"Petróleo","UBER":"Tecnologia","PLTR":"Tecnologia",
}

const getSetor = (ticker) => SETORES[ticker] || "Outros"

export default function Portfolio() {
  const [posicoes, setPosicoes] = useState([])
  const [form, setForm] = useState({ ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "" })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [atualizando, setAtualizando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [modoGrafico, setModoGrafico] = useState("ativo") // "ativo" ou "setor"

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) setPosicoes(JSON.parse(salvo))
  }, [])

  const salvar = (novas) => {
    setPosicoes(novas)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novas))
  }

  const adicionar = () => {
    if (!form.ticker || !form.quantidade || !form.preco_entrada) return
    const nova = {
      ...form,
      quantidade: parseFloat(form.quantidade),
      preco_entrada: parseFloat(form.preco_entrada),
      preco_atual: parseFloat(form.preco_entrada),
      data: new Date().toLocaleDateString("pt-BR")
    }
    salvar([...posicoes, nova])
    setForm({ ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "" })
    setMostrarForm(false)
  }

  const remover = (i) => {
    const novas = posicoes.filter((_, idx) => idx !== i)
    salvar(novas)
  }

  const iniciarEdicao = (i) => {
    setEditando(i)
    setEditForm({ quantidade: posicoes[i].quantidade, preco_entrada: posicoes[i].preco_entrada })
  }

  const salvarEdicao = (i) => {
    const novas = posicoes.map((p, idx) => idx === i ? {
      ...p,
      quantidade: parseFloat(editForm.quantidade),
      preco_entrada: parseFloat(editForm.preco_entrada),
      preco_atual: p.preco_atual
    } : p)
    salvar(novas)
    setEditando(null)
  }

  const cancelarEdicao = () => setEditando(null)

  const atualizarPrecos = async () => {
    if (posicoes.length === 0) return
    setAtualizando(true)
    try {
      const tickers = posicoes.map(p => p.ticker)
      const res = await axios.post(`${API}/precos`, { tickers })
      if (res.data.sucesso) {
        const precos = res.data.precos
        const novas = posicoes.map(p => ({
          ...p,
          preco_atual: precos[p.ticker] || p.preco_atual
        }))
        salvar(novas)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      alert("Erro ao atualizar preços.")
    } finally {
      setAtualizando(false)
    }
  }

  const moeda = (mercado) => mercado === "B3" ? "R$" : "US$"

  const totalInvestido = posicoes.reduce((acc, p) => acc + p.quantidade * p.preco_entrada, 0)
  const totalAtual = posicoes.reduce((acc, p) => acc + p.quantidade * p.preco_atual, 0)
  const lucroTotal = totalAtual - totalInvestido
  const lucroPercent = totalInvestido > 0 ? (lucroTotal / totalInvestido * 100).toFixed(2) : 0

  // Dados gráfico por ativo
  const dadosPorAtivo = posicoes.map(p => ({
    name: p.ticker,
    value: parseFloat((p.quantidade * p.preco_entrada).toFixed(2)),
    percent: totalInvestido > 0 ? ((p.quantidade * p.preco_entrada / totalInvestido) * 100).toFixed(1) : 0
  }))

  // Dados gráfico por setor
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
    percent: totalInvestido > 0 ? ((valor / totalInvestido) * 100).toFixed(1) : 0
  })).sort((a, b) => b.value - a.value)

  const dadosGrafico = modoGrafico === "ativo" ? dadosPorAtivo : dadosPorSetor

  return (
    <div style={{ width: "100%" }}>

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
            fontWeight:"bold", fontSize:"13px",
            boxShadow: atualizando ? "none" : "0 2px 8px rgba(56,189,248,0.3)"
          }}>
            {atualizando ? "⏳ Atualizando..." : "🔄 Atualizar Preços"}
          </button>
        )}
      </div>

      {/* Cards resumo */}
      <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
        {[
          { label:"Total Investido", valor:`R$ ${fmt(totalInvestido)}`, cor:"#f1f5f9", bg:"rgba(255,255,255,0.05)" },
          { label:"Valor Atual", valor:`R$ ${fmt(totalAtual)}`, cor:"#38bdf8", bg:"rgba(56,189,248,0.08)" },
          { label:"Lucro/Prejuízo", valor:`R$ ${fmt(lucroTotal)} (${lucroPercent}%)`,
            cor: lucroTotal >= 0 ? "#4ade80" : "#f87171",
            bg: lucroTotal >= 0 ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)" },
          { label:"Posições Abertas", valor:posicoes.length, cor:"#a78bfa", bg:"rgba(167,139,250,0.08)" },
        ].map((card, i) => (
          <div key={i} style={{
            background:card.bg, border:`1px solid ${card.cor}20`,
            padding:"16px 20px", borderRadius:"12px", minWidth:"160px", flex:1, textAlign:"center"
          }}>
            <p style={{ color:"#64748b", fontSize:"11px", margin:"0 0 6px 0", fontWeight:"500" }}>{card.label}</p>
            <p style={{ color:card.cor, fontSize:"22px", fontWeight:"800", margin:0 }}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Gráfico com botões para alternar */}
      {posicoes.length > 0 && (
        <div style={{ background:"#0d1829", border:"1px solid #1e293b", padding:"20px", borderRadius:"12px", marginBottom:"24px" }}>
          
          {/* Header do gráfico com botões */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
            <h3 style={{ color:"#94a3b8", fontSize:"13px", fontWeight:"600", letterSpacing:"0.05em", margin:0 }}>
              📊 ALOCAÇÃO DO PORTFÓLIO
            </h3>
            <div style={{ display:"flex", gap:"6px" }}>
              <button onClick={() => setModoGrafico("ativo")} style={{
                padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
                fontSize:"12px", fontWeight: modoGrafico === "ativo" ? "700" : "400",
                background: modoGrafico === "ativo" ? "#38bdf8" : "#1e293b",
                color: modoGrafico === "ativo" ? "#0f172a" : "#64748b",
                transition:"all 0.2s"
              }}>
                Por Ativo
              </button>
              <button onClick={() => setModoGrafico("setor")} style={{
                padding:"5px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
                fontSize:"12px", fontWeight: modoGrafico === "setor" ? "700" : "400",
                background: modoGrafico === "setor" ? "#38bdf8" : "#1e293b",
                color: modoGrafico === "setor" ? "#0f172a" : "#64748b",
                transition:"all 0.2s"
              }}>
                Por Setor
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={dadosGrafico}
                cx="50%" cy="50%" outerRadius={115}
                dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${percent}%`}
                labelLine={true}>
                {dadosGrafico.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`R$ ${fmt(value)}`, "Valor"]}
                contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", color:"#e2e8f0" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Botão adicionar */}
      <button onClick={() => setMostrarForm(!mostrarForm)} style={{
        padding:"9px 20px", borderRadius:"8px", cursor:"pointer",
        background: mostrarForm ? "#334155" : "#1e293b",
        color: mostrarForm ? "#94a3b8" : "#38bdf8",
        fontWeight:"bold", marginBottom:"16px", fontSize:"13px",
        border:"1px solid #334155"
      }}>
        {mostrarForm ? "✕ Cancelar" : "+ Adicionar Posição"}
      </button>

      {/* Formulário */}
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

      {/* Tabela */}
      {posicoes.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px", color:"#64748b" }}>
          <p style={{ fontSize:"40px", marginBottom:"12px" }}>📭</p>
          <p style={{ fontSize:"15px", marginBottom:"8px" }}>Nenhuma posição cadastrada</p>
          <p style={{ fontSize:"13px" }}>Adicione uma posição ou clique em "+ Portfólio" na aba Mercado</p>
        </div>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:"12px", border:"1px solid #1e293b" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#0a1520" }}>
                {["Ticker","Nome","Mercado","Setor","Qtd","Entrada","Preço Atual","P&L","% Carteira","Data","Ações"].map(h => (
                  <th key={h} style={{ padding:"14px 12px", textAlign:"left", color:"#64748b",
                    fontSize:"11px", fontWeight:"700", letterSpacing:"0.05em",
                    borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posicoes.map((p, i) => {
                const pl = (p.preco_atual - p.preco_entrada) * p.quantidade
                const plPct = ((p.preco_atual - p.preco_entrada) / p.preco_entrada * 100).toFixed(2)
                const pctCarteira = totalInvestido > 0 ? ((p.quantidade * p.preco_entrada / totalInvestido) * 100).toFixed(1) : 0
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

                    <td style={{ padding:"14px 12px", fontWeight:"700", color:"#38bdf8", fontSize:"14px" }}>{p.ticker}</td>
                    <td style={{ padding:"14px 12px", color:"#e2e8f0", fontSize:"13px" }}>{p.nome}</td>
                    <td style={{ padding:"14px 12px" }}>
                      <span style={{ padding:"3px 8px", borderRadius:"12px", fontSize:"11px", fontWeight:"600",
                        background: p.mercado==="B3" ? "rgba(34,197,94,0.15)" : "rgba(56,189,248,0.15)",
                        color: p.mercado==="B3" ? "#22c55e" : "#38bdf8" }}>
                        {p.mercado}
                      </span>
                    </td>
                    <td style={{ padding:"14px 12px" }}>
                      <span style={{ padding:"3px 8px", borderRadius:"12px", fontSize:"11px", fontWeight:"600",
                        background:"rgba(167,139,250,0.15)", color:"#a78bfa" }}>
                        {setor}
                      </span>
                    </td>
                    <td style={{ padding:"14px 12px", color:"#e2e8f0", fontSize:"13px" }}>
                      {estaEditando ? (
                        <input type="number" value={editForm.quantidade}
                          onChange={e => setEditForm({...editForm, quantidade: e.target.value})}
                          style={{ width:"70px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8",
                            background:"#0f172a", color:"#f1f5f9", fontSize:"13px" }} />
                      ) : p.quantidade}
                    </td>
                    <td style={{ padding:"14px 12px", color:"#e2e8f0", fontSize:"13px" }}>
                      {estaEditando ? (
                        <input type="number" value={editForm.preco_entrada}
                          onChange={e => setEditForm({...editForm, preco_entrada: e.target.value})}
                          style={{ width:"90px", padding:"4px", borderRadius:"4px", border:"1px solid #38bdf8",
                            background:"#0f172a", color:"#f1f5f9", fontSize:"13px" }} />
                      ) : `${moeda(p.mercado)} ${fmt(p.preco_entrada)}`}
                    </td>
                    <td style={{ padding:"14px 12px", fontWeight:"600", fontSize:"13px" }}>
                      <span style={{ color: atualizando ? "#64748b" : "#e2e8f0" }}>
                        {moeda(p.mercado)} {fmt(p.preco_atual)}
                      </span>
                      {atualizando && <span style={{ fontSize:"10px", color:"#64748b", marginLeft:"4px" }}>⏳</span>}
                    </td>
                    <td style={{ padding:"14px 12px" }}>
                      <div>
                        <span style={{ color: emLucro ? "#4ade80" : "#f87171", fontWeight:"700", fontSize:"13px" }}>
                          {emLucro ? "▲" : "▼"} {moeda(p.mercado)} {fmt(Math.abs(pl))}
                        </span>
                        <span style={{ display:"block", fontSize:"11px", color: emLucro ? "#22c55e" : "#ef4444" }}>
                          {emLucro ? "+" : ""}{plPct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ background:"#1e293b", borderRadius:"4px", height:"6px", width:"70px" }}>
                          <div style={{ background:CORES[i % CORES.length], borderRadius:"4px",
                            height:"6px", width:`${Math.min(pctCarteira, 100)}%` }}/>
                        </div>
                        <span style={{ color:"#94a3b8", fontSize:"12px" }}>{pctCarteira}%</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 12px", color:"#64748b", fontSize:"11px" }}>{p.data}</td>
                    <td style={{ padding:"14px 12px" }}>
                      <div style={{ display:"flex", gap:"6px" }}>
                        {estaEditando ? (
                          <>
                            <button onClick={() => salvarEdicao(i)} style={{
                              padding:"5px 10px", borderRadius:"4px", border:"none", cursor:"pointer",
                              background:"#16a34a", color:"white", fontSize:"12px", fontWeight:"600" }}>✓ Salvar</button>
                            <button onClick={cancelarEdicao} style={{
                              padding:"5px 10px", borderRadius:"4px", border:"none", cursor:"pointer",
                              background:"#334155", color:"white", fontSize:"12px" }}>✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicao(i)} style={{
                              padding:"5px 10px", borderRadius:"4px", border:"none", cursor:"pointer",
                              background:"#d97706", color:"white", fontSize:"12px" }}>✏️</button>
                            <button onClick={() => remover(i)} style={{
                              padding:"5px 10px", borderRadius:"4px", border:"none", cursor:"pointer",
                              background:"#dc2626", color:"white", fontSize:"12px" }}>🗑️</button>
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
    </div>
  )
}
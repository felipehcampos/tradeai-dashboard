import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import axios from "axios"

const STORAGE_KEY = "tradeai_portfolio"
const CORES = ["#38bdf8","#4ade80","#f59e0b","#f87171","#a78bfa","#34d399","#fb923c","#60a5fa","#e879f9","#facc15"]
const API = import.meta.env.VITE_API_URL

const fmt = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})

export default function Portfolio() {
  const [posicoes, setPosicoes] = useState([])
  const [form, setForm] = useState({ ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "" })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [atualizando, setAtualizando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)

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
    setEditForm({
      quantidade: posicoes[i].quantidade,
      preco_entrada: posicoes[i].preco_entrada
    })
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
    } catch (e) {
      alert("Erro ao atualizar preços. Tente novamente.")
    } finally {
      setAtualizando(false)
    }
  }

  const moeda = (mercado) => mercado === "B3" ? "R$" : "US$"

  const totalInvestido = posicoes.reduce((acc, p) => acc + p.quantidade * p.preco_entrada, 0)
  const totalAtual = posicoes.reduce((acc, p) => acc + p.quantidade * p.preco_atual, 0)
  const lucroTotal = totalAtual - totalInvestido
  const lucroPercent = totalInvestido > 0 ? (lucroTotal / totalInvestido * 100).toFixed(2) : 0

  const dadosGrafico = posicoes.map(p => ({
    name: p.ticker,
    value: parseFloat((p.quantidade * p.preco_entrada).toFixed(2)),
    percent: totalInvestido > 0 ? ((p.quantidade * p.preco_entrada / totalInvestido) * 100).toFixed(1) : 0
  }))

  return (
    <div style={{width:"100%"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"12px"}}>
        <div>
          <h2 style={{color:"#38bdf8",margin:"0 0 4px 0",fontSize:"22px",fontWeight:"800"}}>💼 Portfólio</h2>
          {ultimaAtualizacao && (
            <span style={{color:"#64748b",fontSize:"12px"}}>Preços atualizados às {ultimaAtualizacao}</span>
          )}
        </div>
        {posicoes.length > 0 && (
          <button onClick={atualizarPrecos} disabled={atualizando} style={{
            padding:"9px 20px",borderRadius:"8px",border:"none",cursor:"pointer",
            background: atualizando ? "#334155" : "linear-gradient(135deg,#38bdf8,#0ea5e9)",
            color: atualizando ? "#94a3b8" : "#0f172a",
            fontWeight:"bold",fontSize:"13px",
            boxShadow: atualizando ? "none" : "0 2px 8px rgba(56,189,248,0.3)"
          }}>
            {atualizando ? "⏳ Atualizando preços..." : "🔄 Atualizar Preços"}
          </button>
        )}
      </div>

      {/* Cards resumo */}
      <div style={{display:"flex",gap:"12px",marginBottom:"24px",flexWrap:"wrap"}}>
        {[
          {label:"Total Investido", valor:`R$ ${fmt(totalInvestido)}`, cor:"#f1f5f9", bg:"rgba(255,255,255,0.05)"},
          {label:"Valor Atual", valor:`R$ ${fmt(totalAtual)}`, cor:"#38bdf8", bg:"rgba(56,189,248,0.08)"},
          {label:"Lucro/Prejuízo", valor:`R$ ${fmt(lucroTotal)} (${lucroPercent}%)`, 
            cor: lucroTotal >= 0 ? "#4ade80" : "#f87171",
            bg: lucroTotal >= 0 ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)"},
          {label:"Posições Abertas", valor:posicoes.length, cor:"#a78bfa", bg:"rgba(167,139,250,0.08)"},
        ].map((card, i) => (
          <div key={i} style={{background:card.bg,border:`1px solid ${card.cor}20`,
            padding:"16px 20px",borderRadius:"12px",minWidth:"160px",flex:1,textAlign:"center"}}>
            <p style={{color:"#64748b",fontSize:"11px",margin:"0 0 6px 0",fontWeight:"500"}}>{card.label}</p>
            <p style={{color:card.cor,fontSize:"22px",fontWeight:"800",margin:0}}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      {posicoes.length > 0 && (
        <div style={{background:"#0d1829",border:"1px solid #1e293b",padding:"20px",borderRadius:"12px",marginBottom:"24px"}}>
          <h3 style={{color:"#94a3b8",marginBottom:"16px",fontSize:"13px",fontWeight:"600",letterSpacing:"0.05em"}}>
            📊 ALOCAÇÃO DO PORTFÓLIO
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={dadosGrafico} cx="50%" cy="50%" outerRadius={110}
                dataKey="value" nameKey="name"
                label={({name, percent}) => `${name} ${percent}%`}
                labelLine={true}>
                {dadosGrafico.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `R$ ${fmt(value)}`}
                contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:"8px",color:"#e2e8f0"}} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Botão adicionar */}
      <button onClick={() => setMostrarForm(!mostrarForm)} style={{
        padding:"9px 20px",borderRadius:"8px",border:"none",cursor:"pointer",
        background: mostrarForm ? "#334155" : "#1e293b",
        color: mostrarForm ? "#94a3b8" : "#38bdf8",
        fontWeight:"bold",marginBottom:"16px",fontSize:"13px",
        border:"1px solid #334155"
      }}>
        {mostrarForm ? "✕ Cancelar" : "+ Adicionar Posição"}
      </button>

      {/* Formulário */}
      {mostrarForm && (
        <div style={{background:"#0d1829",border:"1px solid #1e293b",padding:"16px",
          borderRadius:"12px",marginBottom:"16px",display:"flex",gap:"12px",flexWrap:"wrap"}}>
          {[
            {key:"ticker", placeholder:"Ticker (ex: VALE3.SA)"},
            {key:"nome", placeholder:"Nome (ex: Vale)"},
            {key:"quantidade", placeholder:"Quantidade", type:"number"},
            {key:"preco_entrada", placeholder:"Preço de Entrada", type:"number"},
          ].map(f => (
            <input key={f.key} type={f.type||"text"} placeholder={f.placeholder}
              value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{padding:"10px",borderRadius:"6px",border:"1px solid #334155",
                background:"#0f172a",color:"#f1f5f9",fontSize:"13px",flex:1,minWidth:"150px"}} />
          ))}
          <select value={form.mercado} onChange={e => setForm({...form, mercado: e.target.value})}
            style={{padding:"10px",borderRadius:"6px",border:"1px solid #334155",
              background:"#0f172a",color:"#f1f5f9",fontSize:"13px"}}>
            <option value="B3">B3</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="NYSE">NYSE</option>
            <option value="CRYPTO">CRYPTO</option>
            <option value="COMMODITY">COMMODITY</option>
          </select>
          <button onClick={adicionar} style={{
            padding:"10px 20px",borderRadius:"6px",border:"none",cursor:"pointer",
            background:"linear-gradient(135deg,#16a34a,#15803d)",color:"white",fontWeight:"bold",fontSize:"13px"
          }}>Adicionar</button>
        </div>
      )}

      {/* Tabela */}
      {posicoes.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px",color:"#64748b"}}>
          <p style={{fontSize:"40px",marginBottom:"12px"}}>📭</p>
          <p style={{fontSize:"15px",marginBottom:"8px"}}>Nenhuma posição cadastrada</p>
          <p style={{fontSize:"13px"}}>Adicione uma posição ou clique em "+ Portfólio" na aba Mercado</p>
        </div>
      ) : (
        <div style={{overflowX:"auto",borderRadius:"12px",border:"1px solid #1e293b"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#0a1520"}}>
                {["Ticker","Nome","Mercado","Qtd","Entrada","Preço Atual","P&L","% Carteira","Data","Ações"].map(h => (
                  <th key={h} style={{padding:"14px 12px",textAlign:"left",color:"#64748b",
                    fontSize:"11px",fontWeight:"700",letterSpacing:"0.05em",
                    borderBottom:"1px solid #1e293b",whiteSpace:"nowrap"}}>
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
                return (
                  <tr key={i} style={{
                    borderBottom:"1px solid #0f172a",
                    background: estaEditando ? "#1e3a4a" : i % 2 === 0 ? "#0d1829" : "#0a1520",
                    transition:"background 0.15s"
                  }}
                  onMouseEnter={e => { if (!estaEditando) e.currentTarget.style.background = "#1e293b" }}
                  onMouseLeave={e => { if (!estaEditando) e.currentTarget.style.background = i % 2 === 0 ? "#0d1829" : "#0a1520" }}>

                    <td style={{padding:"14px 12px",fontWeight:"700",color:"#38bdf8",fontSize:"14px"}}>
                      {p.ticker}
                    </td>
                    <td style={{padding:"14px 12px",color:"#e2e8f0",fontSize:"13px"}}>{p.nome}</td>
                    <td style={{padding:"14px 12px"}}>
                      <span style={{padding:"3px 8px",borderRadius:"12px",fontSize:"11px",fontWeight:"600",
                        background: p.mercado==="B3" ? "rgba(34,197,94,0.15)" : "rgba(56,189,248,0.15)",
                        color: p.mercado==="B3" ? "#22c55e" : "#38bdf8"}}>
                        {p.mercado}
                      </span>
                    </td>
                    <td style={{padding:"14px 12px",color:"#e2e8f0",fontSize:"13px"}}>
                      {estaEditando ? (
                        <input type="number" value={editForm.quantidade}
                          onChange={e => setEditForm({...editForm, quantidade: e.target.value})}
                          style={{width:"70px",padding:"4px",borderRadius:"4px",border:"1px solid #38bdf8",
                            background:"#0f172a",color:"#f1f5f9",fontSize:"13px"}} />
                      ) : p.quantidade}
                    </td>
                    <td style={{padding:"14px 12px",color:"#e2e8f0",fontSize:"13px"}}>
                      {estaEditando ? (
                        <input type="number" value={editForm.preco_entrada}
                          onChange={e => setEditForm({...editForm, preco_entrada: e.target.value})}
                          style={{width:"90px",padding:"4px",borderRadius:"4px",border:"1px solid #38bdf8",
                            background:"#0f172a",color:"#f1f5f9",fontSize:"13px"}} />
                      ) : `${moeda(p.mercado)} ${fmt(p.preco_entrada)}`}
                    </td>
                    <td style={{padding:"14px 12px",fontWeight:"600",fontSize:"13px"}}>
                      <span style={{color: atualizando ? "#64748b" : "#e2e8f0"}}>
                        {moeda(p.mercado)} {fmt(p.preco_atual)}
                      </span>
                      {atualizando && <span style={{fontSize:"10px",color:"#64748b",marginLeft:"4px"}}>⏳</span>}
                    </td>
                    <td style={{padding:"14px 12px"}}>
                      <div>
                        <span style={{color: emLucro ? "#4ade80" : "#f87171",fontWeight:"700",fontSize:"13px"}}>
                          {emLucro ? "▲" : "▼"} {moeda(p.mercado)} {fmt(Math.abs(pl))}
                        </span>
                        <span style={{
                          display:"block",fontSize:"11px",
                          color: emLucro ? "#22c55e" : "#ef4444"
                        }}>
                          {emLucro ? "+" : ""}{plPct}%
                        </span>
                      </div>
                    </td>
                    <td style={{padding:"14px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <div style={{background:"#1e293b",borderRadius:"4px",height:"6px",width:"70px"}}>
                          <div style={{background:CORES[i % CORES.length],borderRadius:"4px",
                            height:"6px",width:`${Math.min(pctCarteira, 100)}%`}}/>
                        </div>
                        <span style={{color:"#94a3b8",fontSize:"12px"}}>{pctCarteira}%</span>
                      </div>
                    </td>
                    <td style={{padding:"14px 12px",color:"#64748b",fontSize:"11px"}}>{p.data}</td>
                    <td style={{padding:"14px 12px"}}>
                      <div style={{display:"flex",gap:"6px"}}>
                        {estaEditando ? (
                          <>
                            <button onClick={() => salvarEdicao(i)} style={{
                              padding:"5px 10px",borderRadius:"4px",border:"none",cursor:"pointer",
                              background:"#16a34a",color:"white",fontSize:"12px",fontWeight:"600"}}>✓ Salvar</button>
                            <button onClick={cancelarEdicao} style={{
                              padding:"5px 10px",borderRadius:"4px",border:"none",cursor:"pointer",
                              background:"#334155",color:"white",fontSize:"12px"}}>✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicao(i)} style={{
                              padding:"5px 10px",borderRadius:"4px",border:"none",cursor:"pointer",
                              background:"#d97706",color:"white",fontSize:"12px"}}>✏️</button>
                            <button onClick={() => remover(i)} style={{
                              padding:"5px 10px",borderRadius:"4px",border:"none",cursor:"pointer",
                              background:"#dc2626",color:"white",fontSize:"12px"}}>🗑️</button>
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
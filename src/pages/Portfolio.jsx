import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

const STORAGE_KEY = "tradeai_portfolio"
const CORES = ["#38bdf8","#4ade80","#f59e0b","#f87171","#a78bfa","#34d399","#fb923c","#60a5fa","#e879f9","#facc15"]

const fmt = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})

export default function Portfolio() {
  const [posicoes, setPosicoes] = useState([])
  const [form, setForm] = useState({ ticker: "", nome: "", mercado: "B3", quantidade: "", preco_entrada: "" })
  const [mostrarForm, setMostrarForm] = useState(false)

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
    <div>
      <h2 style={{color:"#38bdf8",marginBottom:"16px"}}>💼 Portfólio</h2>

      <div style={{display:"flex",gap:"16px",marginBottom:"24px",flexWrap:"wrap"}}>
        {[
          {label:"Total Investido", valor:`R$ ${fmt(totalInvestido)}`, cor:"#f1f5f9"},
          {label:"Valor Atual", valor:`R$ ${fmt(totalAtual)}`, cor:"#f1f5f9"},
          {label:"Lucro/Prejuízo", valor:`R$ ${fmt(lucroTotal)} (${lucroPercent}%)`, cor: lucroTotal >= 0 ? "#4ade80" : "#f87171"},
          {label:"Posições Abertas", valor:posicoes.length, cor:"#38bdf8"},
        ].map((card, i) => (
          <div key={i} style={{background:"#1e293b",padding:"16px",borderRadius:"8px",minWidth:"180px",flex:1}}>
            <p style={{color:"#94a3b8",fontSize:"12px",marginBottom:"4px"}}>{card.label}</p>
            <p style={{color:card.cor,fontSize:"20px",fontWeight:"bold"}}>{card.valor}</p>
          </div>
        ))}
      </div>

      {posicoes.length > 0 && (
        <div style={{background:"#1e293b",padding:"16px",borderRadius:"8px",marginBottom:"24px"}}>
          <h3 style={{color:"#94a3b8",marginBottom:"16px",fontSize:"14px"}}>📊 Alocação do Portfólio</h3>
          <div style={{display:"flex",gap:"24px",alignItems:"center",flexWrap:"wrap"}}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={dadosGrafico} cx="50%" cy="50%" outerRadius={100}
                  dataKey="value" nameKey="name" label={({name, percent}) => `${name} ${percent}%`}
                  labelLine={true}>
                  {dadosGrafico.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `R$ ${fmt(value)}`} contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:"8px"}} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{
        padding:"10px 20px",borderRadius:"8px",border:"none",cursor:"pointer",
        background:"#38bdf8",color:"#0f172a",fontWeight:"bold",marginBottom:"16px"
      }}>
        {mostrarForm ? "Cancelar" : "+ Adicionar Posição"}
      </button>

      {mostrarForm && (
        <div style={{background:"#1e293b",padding:"16px",borderRadius:"8px",marginBottom:"16px",display:"flex",gap:"12px",flexWrap:"wrap"}}>
          {[
            {key:"ticker", placeholder:"Ticker (ex: VALE3.SA)"},
            {key:"nome", placeholder:"Nome (ex: Vale)"},
            {key:"quantidade", placeholder:"Quantidade", type:"number"},
            {key:"preco_entrada", placeholder:"Preço de Entrada", type:"number"},
          ].map(f => (
            <input key={f.key} type={f.type||"text"} placeholder={f.placeholder}
              value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{padding:"10px",borderRadius:"6px",border:"1px solid #334155",
                background:"#0f172a",color:"#f1f5f9",fontSize:"14px",flex:1,minWidth:"150px"}} />
          ))}
          <select value={form.mercado} onChange={e => setForm({...form, mercado: e.target.value})}
            style={{padding:"10px",borderRadius:"6px",border:"1px solid #334155",
              background:"#0f172a",color:"#f1f5f9",fontSize:"14px"}}>
            <option value="B3">B3</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="NYSE">NYSE</option>
            <option value="CRYPTO">CRYPTO</option>
            <option value="COMMODITY">COMMODITY</option>
          </select>
          <button onClick={adicionar} style={{
            padding:"10px 20px",borderRadius:"6px",border:"none",cursor:"pointer",
            background:"#16a34a",color:"white",fontWeight:"bold"
          }}>Adicionar</button>
        </div>
      )}

      {posicoes.length === 0 ? (
        <p style={{color:"#94a3b8"}}>Nenhuma posição cadastrada. Adicione uma posição acima.</p>
      ) : (
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#1e293b"}}>
              {["Ticker","Nome","Mercado","Qtd","Entrada","Atual","P&L","% Carteira","Data",""].map(h => (
                <th key={h} style={{padding:"12px",textAlign:"left",color:"#94a3b8",borderBottom:"1px solid #334155"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posicoes.map((p, i) => {
              const pl = (p.preco_atual - p.preco_entrada) * p.quantidade
              const plPct = ((p.preco_atual - p.preco_entrada) / p.preco_entrada * 100).toFixed(2)
              const pctCarteira = totalInvestido > 0 ? ((p.quantidade * p.preco_entrada / totalInvestido) * 100).toFixed(1) : 0
              return (
                <tr key={i} style={{borderBottom:"1px solid #1e293b"}}>
                  <td style={{padding:"12px",fontWeight:"bold",color:"#38bdf8"}}>{p.ticker}</td>
                  <td style={{padding:"12px"}}>{p.nome}</td>
                  <td style={{padding:"12px",color:"#94a3b8",fontSize:"12px"}}>{p.mercado}</td>
                  <td style={{padding:"12px"}}>{p.quantidade}</td>
                  <td style={{padding:"12px"}}>{moeda(p.mercado)} {fmt(p.preco_entrada)}</td>
                  <td style={{padding:"12px"}}>{moeda(p.mercado)} {fmt(p.preco_atual)}</td>
                  <td style={{padding:"12px",color: pl >= 0 ? "#4ade80" : "#f87171"}}>
                    {moeda(p.mercado)} {fmt(pl)} ({plPct}%)
                  </td>
                  <td style={{padding:"12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{background:"#334155",borderRadius:"4px",height:"8px",width:"80px"}}>
                        <div style={{background:CORES[i % CORES.length],borderRadius:"4px",height:"8px",width:`${pctCarteira}%`}}/>
                      </div>
                      <span style={{color:"#94a3b8",fontSize:"12px"}}>{pctCarteira}%</span>
                    </div>
                  </td>
                  <td style={{padding:"12px",color:"#94a3b8",fontSize:"12px"}}>{p.data}</td>
                  <td style={{padding:"12px"}}>
                    <button onClick={() => remover(i)} style={{
                      padding:"4px 8px",borderRadius:"4px",border:"none",cursor:"pointer",
                      background:"#dc2626",color:"white",fontSize:"12px"
                    }}>Remover</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
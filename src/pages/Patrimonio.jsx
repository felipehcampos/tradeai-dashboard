import { useState, useEffect } from "react"
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import api from "../services/api"

// 12/11/2026 — Aba Patrimônio v2 (visual Future Intelligence, protótipo aprovado).
// Separa "dinheiro que eu coloquei" (custo) de valorização. Trading vem automático do
// Portfólio; renda fixa é calculada pelo CDI/pré; o resto é manual. Fotos mensais montam
// a evolução. Só lê e grava as tabelas próprias do patrimônio — nada do scanner.

const API = import.meta.env.VITE_API_URL

const CATS = [
  { id: "trading",    rot: "Trading",     cor: "#38BDF8" },
  { id: "renda_fixa", rot: "Renda fixa",  cor: "#22D3A0" },
  { id: "imovel",     rot: "Imóveis",     cor: "#FBBF24" },
  { id: "carro",      rot: "Carro",       cor: "#7E93B2" },
  { id: "caixa",      rot: "Caixa/Conta", cor: "#2563EB" },
  { id: "outros",     rot: "Outros",      cor: "#C8D4E6" },
]
const catInfo = (id) => CATS.find(c => c.id === id) || { id, rot: id, cor: "#9DB0CB" }

const fmtBRL = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtSinal = (v) => `${v >= 0 ? "+" : "−"}${fmtBRL(Math.abs(v))}`
const fmtPct = (v) => v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2).replace(".", ",")}%`
const pct1 = (v) => `${Number(v || 0).toFixed(1).replace(".", ",")}%`
const dataBR = (s) => s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—"
const dataCurta = (s) => { const [a, m, d] = String(s).slice(0, 10).split("-"); return `${d}/${m}/${a.slice(2)}` }
const corDe = (v) => Math.abs(v || 0) < 0.005 ? "var(--fi-texto-4)" : v > 0 ? "#22D3A0" : "#FB6474"

const FORM_VAZIO = { categoria: "renda_fixa", nome: "", valor: "", valor_aplicado: "", data_aplicacao: "", indexador: "cdi", taxa: "", observacao: "" }
const PERIODOS = [["30d", "30 dias", 31], ["6m", "6 meses", 183], ["12m", "12 meses", 366], ["tudo", "Tudo", null]]

export default function Patrimonio() {
  const [resumo, setResumo] = useState(null)
  const [evol, setEvol] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState(null)
  const [confirmarExcluir, setConfirmarExcluir] = useState(null)
  const [fotografando, setFotografando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [filtro, setFiltro] = useState(null)      // categoria selecionada na rosca
  const [aberto, setAberto] = useState(null)      // id do item com detalhes abertos ("tr" = trading)
  const [periodo, setPeriodo] = useState("tudo")
  const [novoMov, setNovoMov] = useState({ data: "", tipo: "aplicacao", valor: "", liquido: "" })   // 12/11: movimentações
  const [salvandoMov, setSalvandoMov] = useState(false)
  const [erroMov, setErroMov] = useState(null)
  const [verTodosMov, setVerTodosMov] = useState(false)

  const carregar = () => {
    setErro(null)
    Promise.all([api.get(`${API}/patrimonio`), api.get(`${API}/patrimonio/evolucao`)])
      .then(([r1, r2]) => {
        if (!r1.data.sucesso) throw new Error(r1.data.erro || "erro no resumo")
        setResumo(r1.data)
        setEvol(r2.data.sucesso ? r2.data : null)
      })
      .catch(e => setErro(e?.message || "sem resposta"))
      .finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const abrirNovo = () => { setErroForm(null); setForm({ ...FORM_VAZIO }) }
  const abrirEdicao = (it) => {
    setErroForm(null)
    setForm({
      id: it.id, categoria: it.categoria, nome: it.nome || "",
      valor: it.valor_cadastrado ?? "", valor_aplicado: it.valor_aplicado ?? "",
      data_aplicacao: it.data_aplicacao || "", indexador: it.indexador || "cdi",
      taxa: it.taxa ?? "", observacao: it.observacao || "", temMov: (it.movimentos || []).length > 0,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const salvar = () => {
    const rf = form.categoria === "renda_fixa"
    const corpo = {
      categoria: form.categoria, nome: form.nome, observacao: form.observacao,
      ...(rf && form.temMov ? { indexador: form.indexador, taxa: form.taxa }
        : rf ? { valor_aplicado: form.valor_aplicado, data_aplicacao: form.data_aplicacao, indexador: form.indexador, taxa: form.taxa }
             : { valor: form.valor }),
    }
    setSalvando(true); setErroForm(null)
    const req = form.id ? api.put(`${API}/patrimonio/itens/${form.id}`, corpo) : api.post(`${API}/patrimonio/itens`, corpo)
    req.then(r => {
      if (!r.data.sucesso) throw new Error(r.data.erro || "não salvou")
      setForm(null); carregar()
    }).catch(e => setErroForm(e?.message || "erro ao salvar"))
      .finally(() => setSalvando(false))
  }

  const excluir = (id) => {
    api.delete(`${API}/patrimonio/itens/${id}`)
      .then(() => { setConfirmarExcluir(null); setAberto(null); carregar() })
      .catch(e => setAviso(`Não excluiu: ${e?.message || "erro"}`))
  }

  const lancarMov = (id) => {
    setSalvandoMov(true); setErroMov(null)
    api.post(`${API}/patrimonio/itens/${id}/movimentos`, { movimentos: [novoMov] })
      .then(r => {
        if (!r.data.sucesso) throw new Error(r.data.erro || "não salvou")
        setNovoMov({ data: "", tipo: novoMov.tipo, valor: "", liquido: "" }); carregar()
      })
      .catch(e => setErroMov(e?.message || "erro"))
      .finally(() => setSalvandoMov(false))
  }
  const apagarMov = (idMov) => {
    api.delete(`${API}/patrimonio/movimentos/${idMov}`).then(() => carregar()).catch(e => setErroMov(e?.message || "erro"))
  }

  const tirarFoto = () => {
    setFotografando(true); setAviso(null)
    api.post(`${API}/patrimonio/snapshot`)
      .then(r => {
        if (!r.data.sucesso) throw new Error(r.data.erro || "erro")
        setAviso(`Foto de ${dataBR(r.data.data)} salva · total ${fmtBRL(r.data.total)}`)
        carregar()
      })
      .catch(e => setAviso(`Não salvou a foto: ${e?.message || "erro"}`))
      .finally(() => setFotografando(false))
  }

  // ── estilos ──
  const titulo = { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--fi-texto-2)" }
  const rotulo = { fontSize: "10.5px", color: "var(--fi-texto-4)", textTransform: "uppercase", letterSpacing: "1.1px" }
  const caixa = { padding: "12px 14px", borderRadius: "12px", background: "#0A1424", border: "1px solid var(--fi-borda)" }
  const inputS = { padding: "10px", borderRadius: "10px", border: "1px solid #1E3352", background: "#0A1424", color: "#E6EDF7", fontSize: "13px", minWidth: 0 }
  const pill = (cor = "#38BDF8", forte = false) => ({ height: "34px", padding: "0 16px", borderRadius: "999px", fontSize: "12.5px", cursor: "pointer",
    border: `1px solid ${forte ? cor + "73" : "var(--fi-borda-forte)"}`, background: forte ? cor + "1F" : "rgba(56,189,248,0.06)", color: forte ? cor : "var(--fi-texto)", fontWeight: forte ? 600 : 400 })
  const Bloco = (n, txt) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
      <span className="fi-titulo" style={{ fontSize: "12px", color: "#38BDF8", letterSpacing: "2px" }}>{n}</span>
      <span style={{ fontSize: "11px", color: "var(--fi-texto-4)", letterSpacing: "2px", textTransform: "uppercase" }}>{txt}</span>
    </div>
  )
  const tooltipEstilo = { background: "#0B1426", border: "1px solid #1E3352", borderRadius: "10px", fontSize: "12px" }

  if (carregando) return <div style={{ textAlign: "center", padding: "60px", color: "var(--fi-texto-4)" }}>Carregando patrimônio…</div>
  if (erro || !resumo) return (
    <div className="fi-painel" style={{ padding: "18px", borderColor: "rgba(251,100,116,0.4)" }}>
      <div style={{ color: "#FB6474", fontWeight: 600, fontSize: "13px" }}>Não consegui carregar o patrimônio ({erro || "sem dados"}).</div>
      <button type="button" onClick={() => { setCarregando(true); carregar() }} style={{ ...pill(), marginTop: "12px" }}>Tentar de novo</button>
    </div>
  )

  const total = resumo.total
  const cats = (resumo.categorias || []).filter(c => c.valor !== 0)
  const tr = resumo.trading_posicoes || {}
  const itens = resumo.itens || []
  const fotos = evol?.serie || []
  const temFoto = fotos.length > 0
  const compMes = evol?.composicao_mes || null
  const origemValoriz = (resumo.categorias || []).filter(c => Math.abs(c.valorizacao) >= 0.01)

  // série do gráfico = fotos + agora, cortada pelo período
  const serie = [...fotos]
  if (evol?.atual && (!serie.length || serie[serie.length - 1].data !== evol.atual.data)) serie.push({ ...evol.atual, agora: true })
  const diasPer = (PERIODOS.find(p => p[0] === periodo) || [])[2]
  const limite = diasPer ? new Date(Date.now() - diasPer * 864e5).toISOString().slice(0, 10) : null
  const serieF = serie.filter(p => !limite || p.data >= limite || p.agora)
  const serieG = serieF.map(p => ({ ...p, rot: p.agora ? "agora" : dataCurta(p.data) }))
  const mostraFiltros = serie.length >= 3

  // linhas da tabela: trading automático + itens, filtradas pela categoria
  const linhas = [
    { id: "tr", auto: true, categoria: "trading", nome: "Posições abertas", valor: tr.valor || 0, custo: tr.investido || 0,
      valorizacao: (tr.valor || 0) - (tr.investido || 0),
      sub: `automático · ${tr.posicoes || 0} posições do Portfólio${tr.dolar ? ` · dólar ${String(tr.dolar).replace(".", ",")}` : ""}` },
    ...itens.map(it => ({ ...it, sub: it.categoria === "renda_fixa" && it.indexador
      ? `${it.indexador === "cdi" ? `${String(it.taxa).replace(".", ",")}% do CDI` : `${String(it.taxa).replace(".", ",")}% a.a.`} · ${(it.movimentos || []).length ? `${it.movimentos.length} movimentações` : `desde ${dataBR(it.data_aplicacao)}`}`
      : it.categoria === "imovel" ? "custo investido até agora" : it.categoria === "carro" ? "valor FIPE / estimado" : "manual" })),
  ].filter(l => !filtro || l.categoria === filtro).sort((a, b) => b.valor - a.valor)

  // ── blocos (chamados como função para não perder o foco dos campos) ──
  const Formulario = () => {
    const rf = form.categoria === "renda_fixa"
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
    const lab = { display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", color: "var(--fi-texto-3)" }
    return (
      <section className="fi-painel" aria-label={form.id ? "Editar item" : "Novo item"} style={{ padding: "18px", borderColor: "rgba(56,189,248,0.45)" }}>
        <h2 style={{ ...titulo, marginBottom: "12px" }}>{form.id ? "Editar item" : "Novo item"}</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          {CATS.map(c => (
            <button key={c.id} type="button" onClick={() => setForm({ ...form, categoria: c.id })}
              style={{ ...pill(c.cor, form.categoria === c.id), height: "30px", fontSize: "12px" }}>{c.rot}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "10px" }}>
          <label style={lab}>Nome
            <input aria-label="Nome" style={inputS} value={form.nome} onChange={set("nome")}
              placeholder={rf ? "ex.: CDB Banco X" : form.categoria === "imovel" ? "ex.: Obra Rua Y" : form.categoria === "trading" ? "ex.: Caixa na corretora (Nubank)" : form.categoria === "carro" ? "ex.: Carro" : "ex.: Conta corrente"} />
          </label>
          {rf && form.temMov ? (<>
            <label style={lab}>Rende
              <select aria-label="Indexador" style={inputS} value={form.indexador} onChange={set("indexador")}>
                <option value="cdi">% do CDI</option>
                <option value="pre">Prefixado (% ao ano)</option>
              </select>
            </label>
            <label style={lab}>{form.indexador === "cdi" ? "Taxa (% do CDI, ex.: 110)" : "Taxa (% ao ano, ex.: 12,5)"}
              <input aria-label="Taxa" type="number" step="0.01" min="0" style={inputS} value={form.taxa} onChange={set("taxa")} />
            </label>
          </>) : rf ? (<>
            <label style={lab}>Valor aplicado (R$)
              <input aria-label="Valor aplicado" type="number" step="0.01" min="0" style={inputS} value={form.valor_aplicado} onChange={set("valor_aplicado")} />
            </label>
            <label style={lab}>Data da aplicação
              <input aria-label="Data da aplicação" type="date" style={inputS} value={form.data_aplicacao} onChange={set("data_aplicacao")} />
            </label>
            <label style={lab}>Rende
              <select aria-label="Indexador" style={inputS} value={form.indexador} onChange={set("indexador")}>
                <option value="cdi">% do CDI</option>
                <option value="pre">Prefixado (% ao ano)</option>
              </select>
            </label>
            <label style={lab}>{form.indexador === "cdi" ? "Taxa (% do CDI, ex.: 110)" : "Taxa (% ao ano, ex.: 12,5)"}
              <input aria-label="Taxa" type="number" step="0.01" min="0" style={inputS} value={form.taxa} onChange={set("taxa")} />
            </label>
          </>) : (
            <label style={lab}>
              {form.categoria === "imovel" ? "Custo investido até agora (R$)" : form.categoria === "carro" ? "Valor estimado / FIPE (R$)" : "Valor (R$)"}
              <input aria-label="Valor" type="number" step="0.01" min="0" style={inputS} value={form.valor} onChange={set("valor")} />
            </label>
          )}
          <label style={lab}>Observação (opcional)
            <input aria-label="Observação" style={inputS} value={form.observacao} onChange={set("observacao")} />
          </label>
        </div>
        <div style={{ fontSize: "11px", color: "var(--fi-texto-4)", marginTop: "8px", lineHeight: 1.6 }}>
          {rf && !form.temMov && "O rendimento é calculado sozinho todo dia. No total entra o valor líquido (já descontado o IR estimado). Se você coloca e tira dinheiro com frequência (ex.: caixinha), cadastre a primeira aplicação aqui e lance o resto em \"detalhes › movimentações\"."}
          {rf && form.temMov && "Este item usa as movimentações (aplicações e resgates com data). Para mudar valores, edite as movimentações nos detalhes do item."}
          {form.categoria === "imovel" && "Cada gasto novo que você somar aqui conta como dinheiro novo, não como valorização."}
          {form.categoria === "carro" && "O valor da primeira foto vira o ponto de partida; quando a FIPE mudar, a diferença aparece como valorização ou desvalorização."}
          {(form.categoria === "caixa" || form.categoria === "outros" || form.categoria === "trading") && "Aumentar ou diminuir este valor conta como dinheiro colocado ou retirado."}
        </div>
        {erroForm && <div style={{ fontSize: "12px", color: "#FB6474", marginTop: "10px" }}>{erroForm}</div>}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          <button type="button" onClick={salvar} disabled={salvando} style={pill("#22D3A0", true)}>{salvando ? "Salvando…" : "Salvar"}</button>
          <button type="button" onClick={() => setForm(null)} style={pill()}>Cancelar</button>
        </div>
      </section>
    )
  }

  const Detalhe = (l) => {
    const d = l.detalhe
    return (
      <div style={{ padding: "12px 14px", borderRadius: "12px", background: "#0A1424", border: "1px solid #1E3352", fontSize: "12px", color: "var(--fi-texto-3)", lineHeight: 1.7 }}>
        {l.auto && <>Vem do Portfólio: valor de hoje das posições ({fmtBRL(l.valor)}) contra o que foi investido ({fmtBRL(l.custo)}). Para mudar, edite as posições na aba Portfólio.</>}
        {!l.auto && l.categoria === "renda_fixa" && d && !d.incompleto && d.colocado != null && <>
          {d.movimentos} movimentações desde {dataBR(d.primeira)} · colocado {fmtBRL(d.colocado)} · bruto {fmtBRL(d.bruto)} · IR {fmtBRL(d.ir)}{d.iof > 0 ? ` · IOF ${fmtBRL(d.iof)}` : ""} · líquido {fmtBRL(d.liquido)}.
          Entra no total pelo líquido.{" "}
          {d.ultimo_ajuste
            ? <>Calibrado com o saldo do app em {dataBR(d.ultimo_ajuste.data)} (o cálculo dava {fmtBRL(d.ultimo_ajuste.calculado)}); de lá para cá o rendimento é calculado.</>
            : <>Para bater exatamente com o banco, lance um "Saldo do app" (bruto e líquido) de vez em quando.</>}
          {d.resgate_sem_saldo > 0 && <span style={{ color: "#FBBF24" }}> Há resgates maiores que o saldo calculado ({fmtBRL(d.resgate_sem_saldo)}) — confira se falta alguma aplicação.</span>}
        </>}
        {!l.auto && l.categoria === "renda_fixa" && d && !d.incompleto && d.colocado == null && <>
          Aplicado {fmtBRL(l.valor_aplicado)} em {dataBR(l.data_aplicacao)} · bruto {fmtBRL(d.bruto)} · IR {pct1(d.aliquota_ir * 100)} ({fmtBRL(d.ir)}) · {d.dias} dias.
          Entra no total pelo líquido.{d.antes_da_tabela_cdi && " Aplicação anterior a 28/01/2026: o trecho antes dessa data usa a primeira taxa da tabela de CDI."}
        </>}
        {!l.auto && l.categoria === "renda_fixa" && d && d.incompleto && <span style={{ color: "#FBBF24" }}>Cadastro incompleto — edite e preencha valor aplicado, data e taxa para o rendimento ser calculado.</span>}
        {!l.auto && l.categoria === "carro" && <>Valor de partida (primeira foto): {fmtBRL(l.custo)}. A diferença para o valor de hoje é a valorização ({fmtSinal(l.valorizacao)}).</>}
        {!l.auto && l.categoria === "imovel" && <>Lançado pelo custo investido. Aumentar o valor = dinheiro novo na obra, não valorização.</>}
        {!l.auto && ["caixa", "outros", "trading"].includes(l.categoria) && <>Valor lançado à mão. Atualize quando quiser.</>}
        {!l.auto && l.categoria === "renda_fixa" && Movimentos(l)}
        {!l.auto && l.observacao && <div style={{ marginTop: "4px" }}>Obs.: {l.observacao}</div>}
        {!l.auto && <div style={{ fontSize: "11px", color: "var(--fi-texto-4)", marginTop: "4px" }}>Atualizado em {dataBR(l.atualizado_em)}</div>}
        {!l.auto && (
          <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => abrirEdicao(l)} style={{ ...pill(), height: "28px", padding: "0 12px", color: "#38BDF8" }}>✎ Editar</button>
            {confirmarExcluir === l.id ? (<>
              <span style={{ fontSize: "11.5px", color: "#FB6474" }}>Excluir este item?</span>
              <button type="button" onClick={() => excluir(l.id)} style={{ ...pill("#FB6474", true), height: "28px", padding: "0 12px" }}>Sim</button>
              <button type="button" onClick={() => setConfirmarExcluir(null)} style={{ ...pill(), height: "28px", padding: "0 12px" }}>Não</button>
            </>) : (
              <button type="button" onClick={() => setConfirmarExcluir(l.id)} style={{ ...pill(), height: "28px", padding: "0 12px", color: "#FB6474" }}>✕ Excluir</button>
            )}
          </div>
        )}
      </div>
    )
  }

  const Movimentos = (l) => {
    const movs = [...(l.movimentos || [])].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    const mostrar = verTodosMov ? movs : movs.slice(0, 8)
    const inp = { ...inputS, padding: "6px 8px", fontSize: "12px" }
    return (
      <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--fi-borda)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "11px", color: "var(--fi-texto-4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Movimentações</div>
        {movs.length === 0 && <div style={{ fontSize: "11.5px", color: "var(--fi-texto-4)" }}>Nenhuma ainda. Ao lançar a primeira, a aplicação do cadastro ({fmtBRL(l.valor_aplicado)} em {dataBR(l.data_aplicacao)}) entra como a primeira da lista.</div>}
        {mostrar.map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "3px 0", fontSize: "12px" }}>
            <span style={{ color: "var(--fi-texto-3)", minWidth: "80px" }}>{dataBR(m.data)}</span>
            {m.tipo === "ajuste" ? (<>
              <span style={{ flex: 1, color: "#38BDF8" }}>saldo do app{m.liquido != null ? ` · líquido ${fmtBRL(m.liquido)}` : ""}</span>
              <b style={{ color: "#38BDF8" }}>{fmtBRL(m.valor)}</b>
            </>) : (<>
              <span style={{ flex: 1, color: m.valor >= 0 ? "#22D3A0" : "#FB6474" }}>{m.valor >= 0 ? "aplicação" : "resgate"}</span>
              <b style={{ color: m.valor >= 0 ? "#22D3A0" : "#FB6474" }}>{fmtSinal(m.valor)}</b>
            </>)}
            <button type="button" onClick={() => apagarMov(m.id)} aria-label="Apagar movimentação" title="Apagar"
              style={{ width: "22px", height: "22px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)", background: "transparent", color: "#FB6474", cursor: "pointer", fontSize: "10px" }}>✕</button>
          </div>
        ))}
        {movs.length > 8 && (
          <button type="button" onClick={() => setVerTodosMov(!verTodosMov)} style={{ background: "none", border: "none", color: "#38BDF8", fontSize: "11.5px", cursor: "pointer", padding: "4px 0" }}>
            {verTodosMov ? "mostrar menos" : `ver todas (${movs.length})`}
          </button>
        )}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px", alignItems: "center" }}>
          <input aria-label="Data da movimentação" type="date" style={inp} value={novoMov.data} onChange={e => setNovoMov({ ...novoMov, data: e.target.value })} />
          <select aria-label="Tipo" style={inp} value={novoMov.tipo} onChange={e => setNovoMov({ ...novoMov, tipo: e.target.value })}>
            <option value="aplicacao">Aplicação</option>
            <option value="resgate">Resgate</option>
            <option value="ajuste">Saldo do app (calibrar)</option>
          </select>
          <input aria-label={novoMov.tipo === "ajuste" ? "Saldo bruto do app" : "Valor da movimentação"} type="number" step="0.01" min="0"
            placeholder={novoMov.tipo === "ajuste" ? "Bruto (R$)" : "Valor (R$)"} style={{ ...inp, width: "120px" }} value={novoMov.valor} onChange={e => setNovoMov({ ...novoMov, valor: e.target.value })} />
          {novoMov.tipo === "ajuste" && (
            <input aria-label="Saldo líquido do app" type="number" step="0.01" min="0" placeholder="Líquido (R$)" style={{ ...inp, width: "120px" }}
              value={novoMov.liquido} onChange={e => setNovoMov({ ...novoMov, liquido: e.target.value })} />
          )}
          <button type="button" onClick={() => lancarMov(l.id)} disabled={salvandoMov || !novoMov.data || !novoMov.valor}
            style={{ ...pill("#22D3A0", true), height: "30px", padding: "0 12px", opacity: !novoMov.data || !novoMov.valor ? 0.5 : 1 }}>{salvandoMov ? "…" : "+ Lançar"}</button>
        </div>
        {erroMov && <div style={{ fontSize: "11.5px", color: "#FB6474", marginTop: "6px" }}>{erroMov}</div>}
      </div>
    )
  }

  const BarraComp = (rot, ini, larg, cor, valor, corTxt, destaque) => (
    <div style={{ display: "grid", gridTemplateColumns: "118px 1fr auto", gap: "10px", alignItems: "center", fontSize: "12px",
      ...(destaque ? { paddingTop: "8px", borderTop: "1px solid var(--fi-borda)" } : {}) }}>
      <span style={{ color: destaque ? "var(--fi-texto)" : "var(--fi-texto-3)", fontWeight: destaque ? 600 : 400 }}>{rot}</span>
      <div style={{ position: "relative", height: "14px" }}>
        <div style={{ position: "absolute", left: `${ini}%`, width: `${Math.max(0.8, larg)}%`, minWidth: "4px", height: "14px", borderRadius: "4px", background: cor }} />
      </div>
      <b style={{ color: corTxt || "var(--fi-texto)", whiteSpace: "nowrap" }}>{valor}</b>
    </div>
  )

  const Composicao = () => {
    if (!compMes) return (
      <div style={{ color: "var(--fi-texto-4)", fontSize: "12px", lineHeight: 1.6 }}>
        Aparece a partir da segunda foto: compara a foto anterior com agora e separa o que foi <b style={{ color: "#38BDF8" }}>dinheiro novo</b> do que foi <b style={{ color: "#22D3A0" }}>valorização</b>.
      </div>
    )
    const c = compMes, escala = Math.max(c.valor_inicial, c.valor_final, c.valor_inicial + Math.max(0, c.dinheiro_novo)) * 1.02 || 1
    const p = (v) => v / escala * 100
    const posNovo = c.dinheiro_novo >= 0 ? p(c.valor_inicial) : p(c.valor_inicial + c.dinheiro_novo)
    const aposNovo = c.valor_inicial + c.dinheiro_novo
    const posVal = c.valorizacao >= 0 ? p(aposNovo) : p(aposNovo + c.valorizacao)
    const novos = c.por_categoria.filter(x => Math.abs(x.dinheiro_novo) >= 0.01)
    const vals = c.por_categoria.filter(x => Math.abs(x.valorizacao) >= 0.01)
    return (<>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {BarraComp(`Foto de ${dataBR(c.de).slice(0, 5)}`, 0, p(c.valor_inicial), "#2A3B55", fmtBRL(c.valor_inicial))}
        {BarraComp(c.dinheiro_novo >= 0 ? "+ Dinheiro novo" : "− Dinheiro retirado", posNovo, Math.abs(p(c.dinheiro_novo)), "#38BDF8", fmtSinal(c.dinheiro_novo), "#38BDF8")}
        {BarraComp("± Valorização", posVal, Math.abs(p(c.valorizacao)), c.valorizacao >= 0 ? "#22D3A0" : "#FB6474", fmtSinal(c.valorizacao), corDe(c.valorizacao))}
        {BarraComp("= Agora", 0, p(c.valor_final), "linear-gradient(90deg, #2563EB, #38BDF8)", fmtBRL(c.valor_final), null, true)}
      </div>
      <div style={{ fontSize: "11.5px", color: "var(--fi-texto-3)", lineHeight: 1.7, padding: "10px 12px", borderRadius: "10px", background: "#0A1424", border: "1px solid var(--fi-borda)" }}>
        <b style={{ color: "#38BDF8" }}>Dinheiro novo</b>: {novos.length ? novos.map(x => `${x.rotulo} ${fmtSinal(x.dinheiro_novo)}`).join(" · ") : "nenhum"}<br />
        <b style={{ color: corDe(c.valorizacao) }}>Valorização</b>: {vals.length ? vals.map(x => `${x.rotulo} ${fmtSinal(x.valorizacao)}`).join(" · ") : "nenhuma"}
      </div>
    </>)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Patrimônio</h1>
          <div style={{ fontSize: "12px", color: "var(--fi-texto-4)", marginTop: "2px" }}>Trading, renda fixa, imóveis, carro e caixa num lugar só · foto automática todo dia 1º</div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={tirarFoto} disabled={fotografando} style={pill()}>{fotografando ? "Salvando foto…" : "📸 Tirar foto agora"}</button>
          <button type="button" onClick={abrirNovo} style={pill("#22D3A0", true)}>+ Novo item</button>
        </div>
      </div>

      {aviso && <div className="fi-painel" style={{ padding: "10px 16px", fontSize: "12.5px", color: aviso.startsWith("Não") ? "#FB6474" : "#22D3A0" }}>{aviso}</div>}
      {form && Formulario()}

      {/* 01 · QUANTO EU TENHO */}
      <section aria-label="Patrimônio total">
        {Bloco("01", "Quanto eu tenho · e quanto disso é dinheiro que eu coloquei")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
          <div className="fi-painel" style={{ flex: "999 1 560px", minWidth: 0, padding: "22px 24px", background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(13,24,41,0.85) 55%)", borderColor: "rgba(56,189,248,0.45)", boxShadow: "0 0 40px rgba(56,189,248,0.12)" }}>
            <div style={rotulo}>Patrimônio total · agora</div>
            <div className="fi-titulo" style={{ fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 600, color: "#38BDF8", textShadow: "0 0 30px rgba(56,189,248,0.55)", lineHeight: 1.1, marginTop: "6px" }}>{fmtBRL(total)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: "12px", marginTop: "20px" }}>
              <div style={caixa}>
                <div style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>Dinheiro que eu coloquei</div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>{fmtBRL(resumo.custo)}</div>
                <div style={{ fontSize: "11px", color: "var(--fi-texto-4)", marginTop: "2px" }}>compras, aplicações, gastos na obra</div>
              </div>
              <div style={caixa}>
                <div style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>Valorização acumulada</div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px", color: corDe(resumo.valorizacao) }}>{fmtSinal(resumo.valorizacao)}</div>
                <div style={{ fontSize: "11px", color: corDe(resumo.valorizacao), marginTop: "2px" }}>{resumo.valorizacao_pct != null ? `${fmtPct(resumo.valorizacao_pct)} sobre o que coloquei` : "—"}</div>
              </div>
              <div style={caixa}>
                <div style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>De onde vem a valorização</div>
                <div style={{ fontSize: "12px", marginTop: "6px", lineHeight: 1.7 }}>
                  {origemValoriz.length ? origemValoriz.map((c, i) => (
                    <span key={c.categoria}>{i > 0 && " · "}<span style={{ color: corDe(c.valorizacao) }}>{c.rotulo} {fmtSinal(c.valorizacao)}</span></span>
                  )) : <span style={{ color: "var(--fi-texto-4)" }}>nada ainda</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="fi-painel" style={{ flex: "1 1 300px", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px", justifyContent: "center" }}>
            {evol?.variacao_mes ? (<>
              <div>
                <div style={rotulo}>No mês (desde a foto de {dataBR(evol.base_mes_data).slice(0, 5)})</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: corDe(evol.variacao_mes.rs), marginTop: "4px" }}>{fmtSinal(evol.variacao_mes.rs)}</div>
                <div style={{ fontSize: "12px", color: "var(--fi-texto-3)" }}>{fmtPct(evol.variacao_mes.pct)} no patrimônio</div>
              </div>
              {compMes && (
                <div style={{ fontSize: "12px", color: "var(--fi-texto-3)", lineHeight: 1.6, paddingTop: "12px", borderTop: "1px solid var(--fi-borda)" }}>
                  Rentabilidade, <b>sem contar dinheiro novo</b>: <span style={{ color: corDe(compMes.rentabilidade_pct), fontWeight: 600 }}>{fmtPct(compMes.rentabilidade_pct)}</span><br />
                  CDI no mesmo período: <span style={{ color: "var(--fi-texto)", fontWeight: 600 }}>{fmtPct(compMes.cdi_pct)}</span>
                </div>
              )}
              {(evol.variacao_12m || evol.variacao_inicio) && evol.inicio_data !== evol.base_mes_data && (
                <div style={{ fontSize: "11.5px", color: "var(--fi-texto-4)", lineHeight: 1.6 }}>
                  Desde o início ({dataBR(evol.inicio_data)}): <span style={{ color: corDe(evol.variacao_inicio?.rs) }}>{fmtSinal(evol.variacao_inicio?.rs || 0)}</span>
                  {evol.composicao_inicio && <> · rentabilidade {fmtPct(evol.composicao_inicio.rentabilidade_pct)} × CDI {fmtPct(evol.composicao_inicio.cdi_pct)}</>}
                </div>
              )}
            </>) : (
              <div style={{ fontSize: "12px", color: "var(--fi-texto-3)", lineHeight: 1.7 }}>
                <div style={rotulo}>No mês</div>
                <div style={{ marginTop: "6px" }}>A variação aparece depois da primeira foto. A rentabilidade só é mostrada quando houver duas fotos para comparar — nada é estimado.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 02 · EVOLUÇÃO */}
      <section aria-label="Evolução">
        {Bloco("02", "Evolução · estou ficando mais rico?")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
          <div className="fi-painel" style={{ flex: "999 1 560px", minWidth: 0, padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
              <h2 style={titulo}>Patrimônio × dinheiro colocado</h2>
              {mostraFiltros && (
                <div role="group" aria-label="Período" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {PERIODOS.map(([id, rot]) => (
                    <button key={id} type="button" onClick={() => setPeriodo(id)}
                      style={{ height: "28px", padding: "0 12px", borderRadius: "999px", fontSize: "11.5px", cursor: "pointer",
                        border: `1px solid ${periodo === id ? "rgba(56,189,248,0.6)" : "#1E3352"}`, background: periodo === id ? "rgba(56,189,248,0.14)" : "transparent", color: periodo === id ? "#E6EDF7" : "#9DB0CB" }}>{rot}</button>
                  ))}
                </div>
              )}
            </div>
            {!temFoto ? (
              <div style={{ minHeight: "280px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 16px" }}>
                <svg viewBox="0 0 400 120" style={{ width: "260px", maxWidth: "100%", height: "90px", opacity: 0.55 }} aria-hidden="true">
                  <polyline points="0,100 60,92 120,95 180,70 240,62 300,40 360,30 400,18" fill="none" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 7" />
                  <circle cx="400" cy="18" r="5" fill="#38BDF8" />
                </svg>
                <div className="fi-titulo" style={{ fontSize: "18px", fontWeight: 600, marginTop: "8px" }}>Sua série começa na primeira foto</div>
                <div style={{ fontSize: "12.5px", color: "var(--fi-texto-3)", maxWidth: "440px", marginTop: "6px", lineHeight: 1.6 }}>
                  Cadastre seus itens (renda fixa, imóveis, carro, caixa) e registre a primeira foto. Depois o sistema fotografa sozinho todo dia 1º e a curva aparece aqui.
                </div>
                <button type="button" onClick={tirarFoto} disabled={fotografando || itens.length === 0}
                  title={itens.length === 0 ? "Cadastre ao menos um item antes" : ""}
                  style={{ marginTop: "16px", height: "38px", padding: "0 20px", borderRadius: "999px", border: "1px solid rgba(56,189,248,0.6)", background: "rgba(56,189,248,0.14)",
                    color: "#38BDF8", fontWeight: 600, cursor: itens.length === 0 ? "not-allowed" : "pointer", opacity: itens.length === 0 ? 0.5 : 1, boxShadow: "0 0 18px rgba(56,189,248,0.25)" }}>
                  {fotografando ? "Salvando…" : "📸 Registrar a primeira foto"}
                </button>
                {itens.length === 0 && <div style={{ fontSize: "11px", color: "#FBBF24", marginTop: "8px" }}>Cadastre seus itens primeiro (+ Novo item).</div>}
              </div>
            ) : (<>
              <div style={{ height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serieG} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="fiPatr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38BDF8" stopOpacity={0.32} /><stop offset="1" stopColor="#38BDF8" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#132238" vertical={false} />
                    <XAxis dataKey="rot" tick={{ fill: "#7E93B2", fontSize: 11 }} minTickGap={30} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#7E93B2", fontSize: 11 }} width={60} axisLine={false} tickLine={false} domain={["auto", "auto"]}
                      tickFormatter={(v) => Math.abs(v) >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `R$${Math.round(v)}`} />
                    <Tooltip contentStyle={tooltipEstilo} formatter={(v, n) => [fmtBRL(v), n === "total" ? "Patrimônio" : "Dinheiro colocado"]} />
                    <Area type="monotone" dataKey="total" stroke="#38BDF8" strokeWidth={3} fill="url(#fiPatr)" dot={{ r: 3, fill: "#38BDF8" }} style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.8))" }} />
                    <Line type="monotone" dataKey="custo" stroke="#7E93B2" strokeWidth={2} strokeDasharray="7 6" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "11.5px", color: "var(--fi-texto-3)", marginTop: "10px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 14, height: 3, background: "#38BDF8", borderRadius: 2 }} />Patrimônio</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 14, height: 0, borderTop: "2px dashed #7E93B2" }} />Dinheiro colocado</span>
                <span>· a distância entre as duas linhas é a valorização{fotos.length === 1 ? " · com uma foto só, o gráfico liga a foto ao valor de agora" : ""}</span>
              </div>
            </>)}
          </div>

          <div className="fi-painel" style={{ flex: "1 1 320px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={titulo}>De onde veio o crescimento do mês</h2>
            {Composicao()}
            <div style={{ fontSize: "11px", color: "var(--fi-texto-4)", lineHeight: 1.5 }}>Calculado comparando o "dinheiro colocado" de cada item entre uma foto e outra — você não precisa lançar aportes à mão.</div>
          </div>
        </div>
      </section>

      {/* 03 · ONDE ESTÁ */}
      <section aria-label="Composição">
        {Bloco("03", "Onde está · clique numa categoria para filtrar")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "flex-start" }}>
          <div className="fi-painel" style={{ flex: "1 1 300px", padding: "18px" }}>
            {cats.length === 0 ? <div style={{ color: "var(--fi-texto-4)", fontSize: "12px" }}>Sem valores ainda.</div> : (<>
              <div style={{ position: "relative", width: "180px", height: "180px", margin: "0 auto" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cats} dataKey="valor" nameKey="rotulo" innerRadius={58} outerRadius={82} paddingAngle={cats.length > 1 ? 2 : 0} stroke="none"
                      onClick={(d) => { const id = d?.categoria || d?.payload?.categoria; setFiltro(filtro === id ? null : id); setAberto(null) }} style={{ cursor: "pointer" }}>
                      {cats.map(c => <Cell key={c.categoria} fill={catInfo(c.categoria).cor} opacity={!filtro || filtro === c.categoria ? 1 : 0.25} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  {(() => { const s = cats.find(c => c.categoria === filtro); return s
                    ? <><span className="fi-titulo" style={{ fontSize: "20px", fontWeight: 700 }}>{pct1(s.pct)}</span><span style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>{s.rotulo}</span></>
                    : <><span className="fi-titulo" style={{ fontSize: "15px", fontWeight: 700 }}>{fmtBRL(total).replace(/,\d\d$/, "")}</span><span style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>total</span></> })()}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "12px" }}>
                {cats.map(c => {
                  const on = filtro === c.categoria, cor = catInfo(c.categoria).cor
                  return (
                    <button key={c.categoria} type="button" onClick={() => { setFiltro(on ? null : c.categoria); setAberto(null) }} aria-pressed={on}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", width: "100%", padding: "8px 10px", borderRadius: "10px", fontSize: "12.5px",
                        cursor: "pointer", color: "var(--fi-texto-2)", textAlign: "left", border: `1px solid ${on ? cor + "88" : "transparent"}`, background: on ? cor + "18" : "transparent", opacity: !filtro || on ? 1 : 0.5 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, boxShadow: `0 0 6px ${cor}` }} />{c.rotulo}</span>
                      <span style={{ display: "inline-flex", gap: "12px" }}><span style={{ color: "var(--fi-texto)", fontWeight: 600 }}>{fmtBRL(c.valor)}</span><span style={{ color: "var(--fi-texto-4)", minWidth: "44px", textAlign: "right" }}>{pct1(c.pct)}</span></span>
                    </button>
                  )
                })}
              </div>
            </>)}
          </div>

          <div className="fi-painel" style={{ flex: "999 1 560px", minWidth: 0, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 8px", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={titulo}>Itens · {filtro ? catInfo(filtro).rot : "todos"}</h2>
              {filtro && <button type="button" onClick={() => setFiltro(null)} style={{ ...pill(), height: "28px", padding: "0 12px", fontSize: "11.5px" }}>✕ mostrar todos</button>}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "720px" }}>
              <thead>
                <tr>
                  {["Item", "Valor", "Coloquei", "Valorização", "Peso no total", ""].map((h, i) => (
                    <th key={h || "x" + i} style={{ padding: "10px", textAlign: "left", color: "#5F7391", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.1px", width: h === "Peso no total" ? "170px" : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => {
                  const cor = catInfo(l.categoria).cor, peso = total ? l.valor / total * 100 : 0, ab = aberto === l.id
                  const tdS = { padding: "12px 10px", borderTop: "1px solid #101D31" }
                  return [
                    <tr key={l.id} onClick={() => { setAberto(ab ? null : l.id); setConfirmarExcluir(null) }} style={{ cursor: "pointer", background: ab ? "rgba(56,189,248,0.04)" : "transparent" }}>
                      <td style={tdS}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, flexShrink: 0 }} /><b>{l.nome}</b></div>
                        <div style={{ fontSize: "11px", color: "var(--fi-texto-4)", margin: "2px 0 0 17px" }}>{catInfo(l.categoria).rot} · {l.sub}</div>
                      </td>
                      <td style={{ ...tdS, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtBRL(l.valor)}</td>
                      <td style={{ ...tdS, color: "var(--fi-texto-3)", whiteSpace: "nowrap" }}>{fmtBRL(l.custo)}</td>
                      <td style={{ ...tdS, whiteSpace: "nowrap", color: corDe(l.valorizacao) }}>
                        {Math.abs(l.valorizacao) < 0.005 ? "—" : `${fmtSinal(l.valorizacao)}${l.custo ? ` (${fmtPct(l.valorizacao / l.custo * 100)})` : ""}`}
                      </td>
                      <td style={tdS}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: "#132238", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.max(1.5, Math.min(100, peso))}%`, borderRadius: "999px", background: cor, boxShadow: `0 0 8px ${cor}` }} />
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--fi-texto-2)", minWidth: "42px", textAlign: "right" }}>{pct1(peso)}</span>
                        </div>
                      </td>
                      <td style={{ ...tdS, color: "#38BDF8", fontSize: "12px", whiteSpace: "nowrap" }}>{ab ? "fechar ‹" : "detalhes ›"}</td>
                    </tr>,
                    ab && (
                      <tr key={l.id + "-det"}>
                        <td colSpan={6} style={{ padding: "0 10px 14px 27px" }}>{Detalhe(l)}</td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
            {itens.length === 0 && (
              <div style={{ padding: "14px 18px 18px", fontSize: "12px", color: "var(--fi-texto-4)" }}>
                Nenhum item cadastrado ainda. Use "+ Novo item" para lançar renda fixa, imóveis, carro, caixa e o caixa parado na corretora (categoria Trading).
              </div>
            )}
          </div>
        </div>
      </section>

      <div style={{ fontSize: "11px", color: "#5F7391", lineHeight: 1.6 }}>
        Os filtros de período aparecem a partir de 3 pontos no gráfico. Rentabilidade "sem dinheiro novo" = valorização ÷ (valor da foto anterior + metade do dinheiro novo). O patrimônio total usa a renda fixa pelo valor líquido de IR.
      </div>
    </div>
  )
}

import { useEffect, useState } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

// Aba "🧪 Scanner B" (09/11/2026) — sombra do scanner oficial. Só observação:
// o dinheiro real segue o scanner oficial até a revisão de 29/01/2027.

const brl = (v) => (v == null || isNaN(v)) ? "—" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`
const pct = (v, casas = 1) => (v == null || isNaN(v)) ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(casas)}%`
const dia = (iso) => iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : ""

const card = { background: "#0d1829", border: "1px solid #1e293b", borderRadius: "12px", padding: "16px 18px", marginBottom: "18px" }
const th = { padding: "10px 8px", textAlign: "left", color: "#64748b", fontSize: "11px", fontWeight: "700", borderBottom: "1px solid #1e293b", whiteSpace: "nowrap" }
const td = { padding: "10px 8px", fontSize: "12px", color: "#cbd5e1", borderBottom: "1px solid #111c2e", whiteSpace: "nowrap" }

function Selo({ desconto }) {
  const m = { REAL: ["✅ real", "#4ade80"], FALSO: ["⚠️ falso", "#fbbf24"], SEM: ["sem desconto", "#64748b"] }
  const [t, c] = m[desconto] || ["—", "#64748b"]
  return <span style={{ color: c, fontWeight: "700", fontSize: "11px" }}>{t}</span>
}

function LinhaPlacar({ nome, b, destaque }) {
  if (!b) return null
  const taxa = b.fechados ? Math.round(b.alvo / b.fechados * 100) : null
  return (
    <tr style={{ background: destaque ? "rgba(56,189,248,0.06)" : "transparent" }}>
      <td style={{ ...td, fontWeight: "700", color: destaque ? "#38bdf8" : "#e2e8f0" }}>{nome}</td>
      <td style={td}>{b.sinais}</td>
      <td style={td}>{b.fechados}</td>
      <td style={{ ...td, color: "#4ade80" }}>{b.alvo}{taxa != null ? ` (${taxa}%)` : ""}</td>
      <td style={{ ...td, color: "#f87171" }}>{b.stop}</td>
      <td style={{ ...td, fontWeight: "700", color: (b.media_fechados ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>{pct(b.media_fechados, 2)}</td>
      <td style={td}>{pct(b.media_todos, 2)}</td>
    </tr>
  )
}

export default function ScannerB() {
  const [dados, setDados] = useState(null)
  const [placar, setPlacar] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState("COMPRAR")

  const carregar = (data) => {
    setCarregando(true)
    Promise.all([
      api.get(`${API}/scanner-b`, { params: data ? { data } : {} }).catch(() => null),
      api.get(`${API}/scanner-b/placar`).catch(() => null),
    ]).then(([d, p]) => {
      setDados(d?.data?.sucesso ? d.data : null)
      setPlacar(p?.data?.sucesso ? p.data : null)
    }).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const lista = (dados?.sinais || []).filter(s => filtro === "TODOS" || s.sinal_oficial === filtro)
  const falsos = (dados?.sinais || []).filter(s => s.sinal_oficial === "COMPRAR" && s.desconto === "FALSO").length

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
        <div>
          <h2 style={{ color: "#38bdf8", margin: 0, fontSize: "20px" }}>🧪 Scanner B <span style={{ color: "#64748b", fontSize: "13px", fontWeight: "400" }}>(teste em paralelo)</span></h2>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: "6px 0 0 0", lineHeight: 1.5, maxWidth: "820px" }}>
            Lê os sinais do scanner oficial e mede o desconto também pela <b>mediana</b> de 6 meses (que não se deixa levar por picos de alta).
            <b style={{ color: "#fbbf24" }}> ⚠️ falso</b> = só parece barato porque um pico inflou a média.
            <b style={{ color: "#38bdf8" }}> Alvo B</b> = com pico forte, o alvo vira o preço normal (mediana).
            Só observação: <b>use o scanner oficial</b> até a revisão de 29/01/2027.
          </p>
        </div>
        {dados?.dias?.length > 1 && (
          <select value={dados.data_ref || ""} onChange={e => carregar(e.target.value)}
            style={{ background: "#0a1520", color: "#cbd5e1", border: "1px solid #1e293b", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}>
            {dados.dias.map(d => <option key={d} value={d}>{dia(d)}</option>)}
          </select>
        )}
      </div>

      {/* PLACAR */}
      <div style={card}>
        <div style={{ color: "#e2e8f0", fontWeight: "800", fontSize: "15px", marginBottom: "4px" }}>🏁 Placar: oficial × Scanner B</div>
        <div style={{ color: "#64748b", fontSize: "11px", marginBottom: "10px" }}>
          COMPRAR da B3 desde {dia(placar?.desde)} · 1 trade por ativo de cada vez · entra na abertura do dia do sinal, alvo pela máxima, stop pelo fechamento, prazo de 105 pregões.
          {placar?.b_nao_opera ? ` · O B deixou de operar ${placar.b_nao_opera} sinais (sem espaço até o preço normal).` : ""}
        </div>
        {carregando && !placar ? <div style={{ color: "#64748b", fontSize: "13px" }}>Carregando…</div> : !placar ? (
          <div style={{ color: "#64748b", fontSize: "13px" }}>Placar ainda vazio.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["", "Trades", "Fechados", "Bateram alvo", "Bateram stop", "Ganho médio (fechados)", "Ganho médio (todos)"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                <LinhaPlacar nome="Oficial" b={placar.oficial} />
                <LinhaPlacar nome="Scanner B (alvo B)" b={placar.b} destaque />
                <LinhaPlacar nome="   só desconto ✅ real" b={placar.desconto_real} />
                <LinhaPlacar nome="   só desconto ⚠️ falso" b={placar.desconto_falso} />
              </tbody>
            </table>
            <div style={{ color: "#475569", fontSize: "11px", marginTop: "8px" }}>
              "Todos" inclui os trades ainda abertos pelo preço de hoje. Período curto: números vão oscilar até janeiro. Referência de 10 anos: +1,4% por trade.
            </div>
          </div>
        )}
      </div>

      {/* SINAIS DO DIA */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <div style={{ color: "#e2e8f0", fontWeight: "800", fontSize: "15px" }}>
            📋 Sinais de {dia(dados?.data_ref)} {falsos > 0 && <span style={{ color: "#fbbf24", fontSize: "12px", fontWeight: "700" }}> · {falsos} COMPRAR com ⚠️ desconto falso</span>}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {["COMPRAR", "MANTER", "TODOS"].map(f => (
              <button key={f} onClick={() => setFiltro(f)} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #1e293b", cursor: "pointer", fontSize: "11px", fontWeight: "700",
                background: filtro === f ? "#38bdf8" : "#0a1520", color: filtro === f ? "#0d1829" : "#94a3b8" }}>{f}</button>
            ))}
          </div>
        </div>
        {carregando && !dados ? <div style={{ color: "#64748b", fontSize: "13px" }}>Carregando…</div> : !lista.length ? (
          <div style={{ color: "#64748b", fontSize: "13px" }}>Nenhum sinal {filtro !== "TODOS" ? filtro : ""} da B3 nessa rodada.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Ticker", "Sinal oficial", "Desconto B", "Pela média", "Pela mediana", "Pico 6m", "Preço", "Alvo oficial", "Alvo B", "Stop", "Sugestão B"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lista.map(s => {
                  const difAlvo = s.alvo_b != null && s.alvo_oficial != null && Math.abs(s.alvo_b - s.alvo_oficial) >= 0.01
                  const tam = { CHEIA: ["Posição cheia", "#4ade80"], MEIA: ["Meia posição", "#fbbf24"], NAO: ["Não operar", "#f87171"] }[s.tamanho_b] || ["—", "#64748b"]
                  return (
                    <tr key={s.ticker}>
                      <td style={{ ...td, color: "#38bdf8", fontWeight: "800" }} title={s.nome || ""}>{String(s.ticker).replace(".SA", "")}</td>
                      <td style={{ ...td, color: s.sinal_oficial === "COMPRAR" ? "#4ade80" : "#fbbf24", fontWeight: "700" }}>{s.sinal_oficial}</td>
                      <td style={td}><Selo desconto={s.desconto} /></td>
                      <td style={{ ...td, color: s.dist_media <= -2 ? "#4ade80" : "#94a3b8" }}>{pct(s.dist_media)}</td>
                      <td style={{ ...td, color: s.dist_mediana <= -2 ? "#4ade80" : "#f87171", fontWeight: "700" }}>{pct(s.dist_mediana)}</td>
                      <td style={{ ...td, color: s.pico_pct >= 40 ? "#fbbf24" : "#94a3b8", fontWeight: s.pico_pct >= 40 ? "700" : "400" }}>
                        {s.pico_pct != null ? `+${Number(s.pico_pct).toFixed(0)}%` : "—"}{s.pico_pct >= 40 ? " 🔺" : ""}
                      </td>
                      <td style={td}>{brl(s.preco_sinal)}</td>
                      <td style={{ ...td, color: "#4ade80" }}>{brl(s.alvo_oficial)}</td>
                      <td style={{ ...td, color: difAlvo ? "#38bdf8" : "#64748b", fontWeight: difAlvo ? "700" : "400" }}>
                        {s.tamanho_b === "NAO" ? "—" : difAlvo ? brl(s.alvo_b) : "igual"}
                      </td>
                      <td style={{ ...td, color: "#f87171" }}>{brl(s.stop)}</td>
                      <td style={{ ...td, color: tam[1], fontWeight: "700" }}>{tam[0]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ color: "#475569", fontSize: "11px", marginTop: "8px" }}>
              🔺 pico = a máxima dos 6 meses ficou 40% ou mais acima do preço normal (mediana). Estudo de 10 anos: desconto falso rendeu ~1/3 do real; alvo B subiu o acerto de 37% para 48% nas ações com pico.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

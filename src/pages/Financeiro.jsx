import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

const fmtBRL = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v) => `${(Number(v) || 0) >= 0 ? "+" : ""}${(Number(v) || 0).toFixed(2)}%`

export default function Financeiro() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    api.get(`${API}/financeiro/cdi`)
      .then(r => {
        if (r.data.sucesso) setDados(r.data.dados)
        else setErro(r.data.erro || "Erro ao carregar")
      })
      .catch(() => setErro("Erro de conexão"))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>Carregando desempenho financeiro...</div>
  }
  if (erro) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#f87171" }}>{erro}</div>
  }

  const di = dados?.desde_inicio
  const temDados = di && di.ok

  if (!temDados) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>💰</div>
        <div>Ainda não há trades encerrados para calcular o desempenho.</div>
        <div style={{ fontSize: "12px", marginTop: "6px" }}>Assim que você encerrar posições, o comparativo vs CDI aparece aqui.</div>
      </div>
    )
  }

  // Gráfico: rendimento real vs CDI por período (móveis + desde início)
  const dadosGrafico = [
    { nome: "Desde início", real: di.pct_real, cdi: di.pct_cdi },
    ...(dados.moveis || []).map(m => ({ nome: m.label.replace("Últimos ", ""), real: m.pct_real, cdi: m.pct_cdi })),
  ]

  // Gráfico mensal: evolução mês a mês
  const dadosMensais = (dados.mensais || []).map(m => ({
    nome: m.label.split("/")[0].slice(0, 3),
    real: m.pct_real,
    cdi: m.pct_cdi,
    trades: m.trades,
  }))

  const bateu = di.bateu_cdi

  return (
    <div style={{ width: "100%" }}>
      {/* HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "22px", fontWeight: "800", color: "#f1f5f9" }}>💰 Financeiro</div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          Seu rendimento vs CDI — {di.label}. CDI atual: {dados.cdi_atual}% a.a.
        </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <div style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Capital movimentado</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#38bdf8" }}>{fmtBRL(di.capital_movimentado)}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{di.trades} trades encerrados</div>
        </div>

        <div style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Seu rendimento</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: di.pct_real >= 0 ? "#4ade80" : "#f87171" }}>{fmtPct(di.pct_real)}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{fmtBRL(di.ganho_real)} no bolso</div>
        </div>

        <div style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Se estivesse no CDI</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#a78bfa" }}>{fmtPct(di.pct_cdi)}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{fmtBRL(di.ganho_cdi)} renderia</div>
        </div>

        <div style={{
          background: bateu ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
          border: `1px solid ${bateu ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
          borderRadius: "14px", padding: "20px"
        }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>{bateu ? "Bateu o CDI em" : "Abaixo do CDI em"}</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: bateu ? "#4ade80" : "#f87171" }}>
            {di.diferenca_pct >= 0 ? "+" : ""}{di.diferenca_pct.toFixed(2)} pp
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{bateu ? "acima do rendimento seguro" : "abaixo do rendimento seguro"}</div>
        </div>
      </div>

      {/* GRÁFICO: RENDIMENTO vs CDI POR PERÍODO */}
      <div style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Seu rendimento vs CDI por período</div>
        <div style={{ height: "300px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} width={44} />
              <Tooltip
                formatter={(value, name) => [`${value.toFixed(2)}%`, name === "real" ? "Seu rendimento" : "CDI"]}
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
              />
              <Legend formatter={(v) => v === "real" ? "Seu rendimento" : "CDI"} wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="real" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cdi" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO: EVOLUÇÃO MENSAL */}
      {dadosMensais.length > 0 && (
        <div style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Evolução mês a mês</div>
          <div style={{ height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosMensais} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} width={44} />
                <Tooltip
                  formatter={(value, name) => [`${value.toFixed(2)}%`, name === "real" ? "Seu rendimento" : "CDI"]}
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                />
                <Legend formatter={(v) => v === "real" ? "Seu rendimento" : "CDI"} wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="real" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cdi" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TABELA DETALHADA POR PERÍODO */}
      <div style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Detalhamento</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "560px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {["Período", "Trades", "Seu rendimento", "CDI", "Diferença"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Período" ? "left" : "right", color: "#64748b", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[di, ...(dados.moveis || []), ...(dados.mensais || [])].filter(p => p && p.ok).map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{p.label}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#94a3b8" }}>{p.trades}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: p.pct_real >= 0 ? "#4ade80" : "#f87171", fontWeight: "600" }}>{fmtPct(p.pct_real)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#a78bfa" }}>{fmtPct(p.pct_cdi)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: p.diferenca_pct >= 0 ? "#4ade80" : "#f87171", fontWeight: "600" }}>
                    {p.diferenca_pct >= 0 ? "+" : ""}{p.diferenca_pct.toFixed(2)} pp
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#475569", marginTop: "14px" }}>
        O CDI equivalente é calculado sobre o mesmo capital de cada trade, pelos dias exatos em que ficou investido — a comparação mais justa. "Desde o início" conta a partir do seu primeiro trade, sem períodos vazios.
      </div>
    </div>
  )
}
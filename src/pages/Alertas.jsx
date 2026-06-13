import { useState, useEffect } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

export default function Alertas() {
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`${API}/alertas`)
      .then(r => setAlertas(r.data.dados || []))
      .catch(() => setAlertas([]))
      .finally(() => setLoading(false))
  }, [])
  
  return (
    <div>
      <h2 style={{color:"#38bdf8",marginBottom:"16px"}}>🔔 Alertas</h2>
      {loading ? <p>Carregando...</p> : (
        alertas.length === 0 ? <p style={{color:"#94a3b8"}}>Nenhum alerta ativo no momento.</p> : (
          <ul style={{listStyle:"none",padding:0}}>
            {alertas.map((a,i) => (
              <li key={i} style={{background:"#1e293b",padding:"16px",borderRadius:"8px",marginBottom:"8px"}}>
                <strong style={{color:"#38bdf8"}}>{a.ticker}</strong> — {a.tipo} — {a.mensagem}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
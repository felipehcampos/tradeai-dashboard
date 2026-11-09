import axios from "axios"

// 09/11/2026: login de verdade. O site NÃO carrega mais chave nenhuma no código.
// Depois do login, o backend devolve um "passe" (token) de 30 dias, guardado neste navegador.
const API = import.meta.env.VITE_API_URL
export const CHAVE_TOKEN = "tradeai_token"

export function lerToken() {
  try { return localStorage.getItem(CHAVE_TOKEN) || "" } catch { return "" }
}
export function salvarToken(t) {
  try { localStorage.setItem(CHAVE_TOKEN, t) } catch { /* navegador sem storage */ }
}
export function apagarToken() {
  try { localStorage.removeItem(CHAVE_TOKEN) } catch { /* sem storage */ }
}
// O passe é "corpo.assinatura"; o corpo diz quando vence (exp). Só para saber se já venceu.
export function tokenAindaValido(t = lerToken()) {
  try {
    const corpo = t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")
    const exp = JSON.parse(atob(corpo + "===".slice((corpo.length + 3) % 4))).exp
    return exp * 1000 > Date.now()
  } catch { return false }
}

const api = axios.create({ baseURL: API })

api.interceptors.request.use(cfg => {
  const t = lerToken()
  if (t) cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${t}` }
  return cfg
})

// Passe vencido ou recusado → volta para a tela de login.
api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 403 && lerToken()) {
      apagarToken()
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api

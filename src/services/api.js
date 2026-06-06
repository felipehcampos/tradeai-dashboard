import axios from "axios"

const API = import.meta.env.VITE_API_URL
const API_KEY = import.meta.env.VITE_TRADEAI_API_KEY

const api = axios.create({
  baseURL: API,
  headers: {
    "X-API-Key": API_KEY
  }
})

export default api

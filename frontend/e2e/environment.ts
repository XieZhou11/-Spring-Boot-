/** 测试实例统一读取端口；保留旧前端变量，避免历史回归命令连接到不同来源。 */
export const frontendPort = Number(process.env.HANDCRAFT_E2E_FRONTEND_PORT || process.env.HANDCRAFT_E2E_PORT || 5173)
export const backendPort = Number(process.env.HANDCRAFT_E2E_BACKEND_PORT || 18080)
export const origin = `http://localhost:${frontendPort}`
export const api = `http://localhost:${backendPort}/api`

/** 仅测试实例使用可覆盖端口，避免并行工作区占用共享开发服务。 */
export const frontendPort = Number(process.env.HANDCRAFT_E2E_FRONTEND_PORT || 5173)
export const backendPort = Number(process.env.HANDCRAFT_E2E_BACKEND_PORT || 18080)
export const origin = `http://localhost:${frontendPort}`
export const api = `http://localhost:${backendPort}/api`

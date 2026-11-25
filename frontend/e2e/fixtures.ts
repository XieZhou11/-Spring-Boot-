import { test as base, expect } from '@playwright/test'
import { createConnection } from 'mysql2/promise'
import type { ResultSetHeader } from 'mysql2/promise'
import { createServer } from 'node:net'
import { createServer as createHttpServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { api, backendPort, origin } from './environment'

/** 所有浏览器上下文使用同一测试来源，可与开发服务器并行。 */
export const frontendOrigin = origin

/** 启动前先独占探测端口，避免误把其他服务的健康响应当作隔离后端。 */
async function requireBackendPortAvailable() {
  const probe = createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject)
      probe.listen({ port: backendPort, exclusive: true }, resolve)
    })
  } catch (failure) {
    const reason = failure instanceof Error && 'code' in failure ? failure.code : 'UNKNOWN'
    throw new Error(`测试后端端口 ${backendPort} 不可用（${reason}），请更换 HANDCRAFT_E2E_BACKEND_PORT；未连接现有服务`, { cause: failure })
  } finally {
    if (probe.listening) await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()))
  }
}

interface Mailbox {
  codes: Map<string, string>
  rejectNext: boolean
  /** 仅向本 worker 随机测试库中的指定账号授权，生产服务没有此接口。 */
  promoteAdmin: (email: string) => Promise<void>
  /** 仅在随机库补足分页规模，模拟已有的下架收藏及认证失效关注。 */
  seedInteractionHistory: (userId: string, workId: string, creatorId: string) => Promise<void>
  /** 仅调整本worker隔离库内已由真实业务建立订单的时限，避免浏览器验收实际等待48小时或七天。 */
  expireFulfillmentBoundary: (orderId: string, phase: 'NO_START' | 'AUTO_RECEIPT' | 'SHIPPING_OVERDUE' | 'COMPLETION') => Promise<void>
}

/** 只在测试进程使用隔离库和 SMTP 夹具，生产后端无测试接口或假验证码。 */
export const test = base.extend<object, { mailbox: Mailbox; storageMode: 'disabled' | 'receiver'; databaseGroup: 'shared' | 'interactions' | 'content-reports' }>({
  storageMode: ['disabled', { scope: 'worker', option: true }],
  // 公开作品会被其他账号浏览，独立库组避免跨功能空首页用例受前序发布影响。
  databaseGroup: ['shared', { scope: 'worker', option: true }],
  mailbox: [
    async ({ browserName, storageMode, databaseGroup }, use, workerInfo) => {
      // 探测必须早于创建随机测试库及协议接收器，端口冲突不能留下测试资源。
      await requireBackendPortAvailable()
      const mailbox: Mailbox = {
        codes: new Map(), rejectNext: false,
        promoteAdmin: async () => { throw new Error('测试数据库尚未就绪') },
        seedInteractionHistory: async () => { throw new Error('测试数据库尚未就绪') },
        expireFulfillmentBoundary: async () => { throw new Error('测试数据库尚未就绪') },
      }
      // 经过真实 OSS SDK 的 HTTP 协议；仅接收本夹具随机对象，绝不访问真实云端。
      const objects = new Map<string, { bytes: Buffer; type: string }>()
      const storage = createHttpServer(async (request, response) => {
        const path = new URL(request.url || '/', 'http://localhost').pathname
        response.setHeader('x-oss-request-id', 'browser-test-request')
        response.setHeader('Access-Control-Allow-Origin', frontendOrigin)
        if (request.method === 'PUT') {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.from(chunk))
          objects.set(path, { bytes: Buffer.concat(chunks), type: request.headers['content-type'] || 'image/png' })
          response.setHeader('ETag', '"browser-test-etag"')
          response.writeHead(200).end()
        } else if (request.method === 'DELETE') {
          objects.delete(path)
          response.writeHead(204).end()
        } else if (request.method === 'GET' && objects.has(path)) {
          const object = objects.get(path)!
          response.setHeader('Content-Type', object.type)
          response.writeHead(200).end(object.bytes)
        } else response.writeHead(404).end()
      })
      await new Promise<void>((resolve, reject) => {
        storage.once('error', reject)
        storage.listen(0, '127.0.0.1', resolve)
      })
      const storageAddress = storage.address()
      if (!storageAddress || typeof storageAddress === 'string') throw new Error('OSS 测试端口分配失败')
      const smtp = createServer((socket) => {
        let buffer = ''
        let recipient = ''
        let body: string[] | null = null
        socket.setEncoding('utf8')
        socket.write('220 localhost test SMTP\r\n')
        socket.on('data', (chunk: string) => {
          buffer += chunk
          while (buffer.includes('\n')) {
            const end = buffer.indexOf('\n')
            const line = buffer.slice(0, end).replace(/\r$/, '')
            buffer = buffer.slice(end + 1)
            if (body !== null) {
              if (line !== '.') {
                body.push(line)
                continue
              }
              const message = body.join('\r\n')
              const raw = message.split('\r\n\r\n').slice(1).join('\r\n\r\n')
              const text = /content-transfer-encoding: base64/i.test(message)
                ? Buffer.from(raw.replace(/\s/g, ''), 'base64').toString('utf8')
                : raw
              const code = text.match(/\b\d{6}\b/)?.[0]
              if (code) mailbox.codes.set(recipient, code)
              body = null
              socket.write('250 Accepted\r\n')
            } else if (/^(EHLO|HELO|MAIL FROM|RSET)/i.test(line)) socket.write('250 OK\r\n')
            else if (/^RCPT TO:/i.test(line)) {
              recipient = line.match(/<([^>]+)>/)?.[1]?.toLowerCase() || ''
              socket.write('250 OK\r\n')
            } else if (/^DATA$/i.test(line)) {
              if (mailbox.rejectNext) {
                mailbox.rejectNext = false
                socket.write('451 Temporary failure\r\n')
              } else {
                body = []
                socket.write('354 End with dot\r\n')
              }
            } else if (/^QUIT$/i.test(line)) socket.end('221 Bye\r\n')
            else socket.write('500 Unsupported\r\n')
          }
        })
        socket.on('error', () => {
          /* 客户端中止不影响下一个测试连接。 */
        })
      })
      await new Promise<void>((resolve, reject) => {
        smtp.once('error', reject)
        smtp.listen(0, '127.0.0.1', resolve)
      })
      const smtpAddress = smtp.address()
      if (!smtpAddress || typeof smtpAddress === 'string') throw new Error('SMTP 测试端口分配失败')
      const schema = `handcraft_browser_${databaseGroup}_${randomBytes(8).toString('hex')}`
      const database = await createConnection({
        host: 'localhost',
        user: 'root',
        password: '123456',
      })
      let backend: ReturnType<typeof spawn> | undefined
      let startupFailure: Error | undefined
      const log = createWriteStream(`${workerInfo.project.outputDir}/backend-${browserName}.log`)
      try {
        await database.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4`)
        mailbox.promoteAdmin = async (email) => {
          await database.execute(`UPDATE \`${schema}\`.user_account SET is_admin=1 WHERE email=?`, [email])
        }
        mailbox.expireFulfillmentBoundary = async (orderId, phase) => {
          const statements = {
            NO_START: "SET paid_at=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 49 HOUR) WHERE id=? AND order_type='CUSTOM' AND status='PAID' AND started_at IS NULL",
            AUTO_RECEIPT: "SET shipped_at=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 8 DAY),auto_confirm_at=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=? AND order_type='CUSTOM' AND status='SHIPPED'",
            SHIPPING_OVERDUE: "SET ship_deadline_at=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=? AND order_type='CUSTOM' AND status IN ('PAID','IN_PRODUCTION','PENDING_SHIP')",
            COMPLETION: "SET original_completed_at=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=? AND order_type='CUSTOM' AND status='COMPLETED'",
          }
          const [result] = await database.execute<ResultSetHeader>(`UPDATE \`${schema}\`.trade_order ${statements[phase]}`, [orderId])
          if (result.affectedRows !== 1) throw new Error(`履约时限夹具未命中本测试订单：${phase}`)
        }
        mailbox.seedInteractionHistory = async (userId, workId, creatorId) => {
          // 主流程对象仍由真实发布审核建立；这里只准备20条历史关系，使真实关系落在末页。
          await database.execute(`UPDATE \`${schema}\`.work_reaction SET created_at='2000-01-01 00:00:00' WHERE user_id=? AND work_id=? AND reaction_type='FAVORITE'`, [userId, workId])
          await database.execute(`UPDATE \`${schema}\`.creator_follow SET created_at='2000-01-01 00:00:00' WHERE follower_id=? AND creator_id=?`, [userId, creatorId])
          for (let index = 0; index < 20; index++) {
            const [work] = await database.execute<ResultSetHeader>(`INSERT INTO \`${schema}\`.work(creator_id,create_request_key,review_status) VALUES(?,UUID(),'OFFLINE')`, [creatorId])
            await database.execute(`INSERT INTO \`${schema}\`.work_reaction(user_id,work_id,reaction_type) VALUES(?,?,'FAVORITE')`, [userId, work.insertId])
            const [creator] = await database.execute<ResultSetHeader>(`INSERT INTO \`${schema}\`.user_account(email,password_hash,nickname,certification_status) SELECT ?,password_hash,'历史作者','NONE' FROM \`${schema}\`.user_account WHERE id=?`, [`history-${randomBytes(8).toString('hex')}@qq.com`, creatorId])
            await database.execute(`INSERT INTO \`${schema}\`.creator_follow(follower_id,creator_id) VALUES(?,?)`, [userId, creator.insertId])
          }
        }
        backend = spawn(
          'java',
          [
            '-jar',
            // 可选独立产物避免 Windows 占用开发后端 JAR，默认仍使用标准构建结果。
            resolve(process.env.HANDCRAFT_E2E_BACKEND_JAR || '../backend/target/handcraft-platform-0.0.1-SNAPSHOT.jar'),
            `--server.port=${backendPort}`,
            `--app.cors.allowed-origins=${frontendOrigin}`,
            `--spring.datasource.url=jdbc:mysql://localhost:3306/${schema}?serverTimezone=Asia/Shanghai`,
            '--spring.mail.host=127.0.0.1',
            `--spring.mail.port=${smtpAddress.port}`,
            '--spring.mail.username=browser-test@qq.com',
            '--spring.mail.password=test-only',
            '--spring.mail.properties.mail.smtp.auth=false',
            '--spring.mail.properties.mail.smtp.ssl.enable=false',
            '--app.auth.verification-secret=browser-test-only-secret-at-least-32-bytes',
            '--app.security.payment-account-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            // 普通回归固定验证未配置存储，避免读取本地真实凭据后向云端写入测试对象。
            ...(storageMode === 'receiver' ? [
              `--app.oss.endpoint=http://127.0.0.1:${storageAddress.port}`,
              '--app.oss.region=cn-beijing', '--app.oss.bucket=browser-test',
              '--app.oss.access-key-id=browser-test-id', '--app.oss.access-key-secret=browser-test-secret',
            ] : ['--app.oss.endpoint=']),
          ],
          { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        // Java缺失等启动错误由事件报告，不能等健康轮询超时或触发未处理异常。
        backend.once('error', failure => { startupFailure = failure })
        backend.stdout?.pipe(log)
        backend.stderr?.pipe(log)
        let ready = false
        for (let attempt = 0; attempt < 120; attempt++) {
          if (startupFailure) throw new Error(`测试后端进程无法启动（${startupFailure.name}），请检查 Java 环境`, { cause: startupFailure })
          if (backend.exitCode !== null)
            throw new Error('测试后端启动失败，查看 test-results/backend.log')
          try {
            ready = (await fetch(`${api}/health`)).ok
          } catch {
            /* 启动中。 */
          }
          if (ready) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        if (!ready) throw new Error('测试后端启动超时')
        await use(mailbox)
      } finally {
        if (backend?.pid && backend.exitCode === null) {
          const stopped = new Promise<void>((resolve) => backend?.once('exit', () => resolve()))
          backend.kill()
          await stopped
        }
        log.end()
        // schema 为本夹具生成的固定前缀随机标识，绝不删除开发库。
        await database.query(`DROP DATABASE IF EXISTS \`${schema}\``)
        await database.end()
        await new Promise<void>((resolve) => smtp.close(() => resolve()))
        await new Promise<void>((resolve) => storage.close(() => resolve()))
      }
    },
    { scope: 'worker', auto: true, timeout: 90_000 },
  ],
})

export { expect }

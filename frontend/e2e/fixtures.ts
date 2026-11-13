import { test as base, expect } from '@playwright/test'
import { createConnection } from 'mysql2/promise'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'

interface Mailbox {
  codes: Map<string, string>
  rejectNext: boolean
}

/** 只在测试进程使用隔离库和 SMTP 夹具，生产后端无测试接口或假验证码。 */
export const test = base.extend<object, { mailbox: Mailbox }>({
  mailbox: [
    async ({ browserName }, use, workerInfo) => {
      const mailbox: Mailbox = { codes: new Map(), rejectNext: false }
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
      const schema = `handcraft_browser_${randomBytes(8).toString('hex')}`
      const database = await createConnection({
        host: 'localhost',
        user: 'root',
        password: '123456',
      })
      let backend: ReturnType<typeof spawn> | undefined
      const log = createWriteStream(`${workerInfo.project.outputDir}/backend-${browserName}.log`)
      try {
        await database.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4`)
        backend = spawn(
          'java',
          [
            '-jar',
            resolve('../backend/target/handcraft-platform-0.0.1-SNAPSHOT.jar'),
            '--server.port=18080',
            `--spring.datasource.url=jdbc:mysql://localhost:3306/${schema}?serverTimezone=Asia/Shanghai`,
            '--spring.mail.host=127.0.0.1',
            `--spring.mail.port=${smtpAddress.port}`,
            '--spring.mail.username=browser-test@qq.com',
            '--spring.mail.password=test-only',
            '--spring.mail.properties.mail.smtp.auth=false',
            '--spring.mail.properties.mail.smtp.ssl.enable=false',
            '--app.auth.verification-secret=browser-test-only-secret-at-least-32-bytes',
            // 普通回归固定验证未配置存储，避免读取本地真实凭据后向云端写入测试对象。
            '--app.oss.endpoint=',
          ],
          { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        backend.stdout?.pipe(log)
        backend.stderr?.pipe(log)
        let ready = false
        for (let attempt = 0; attempt < 120; attempt++) {
          if (backend.exitCode !== null)
            throw new Error('测试后端启动失败，查看 test-results/backend.log')
          try {
            ready = (await fetch('http://localhost:18080/api/health')).ok
          } catch {
            /* 启动中。 */
          }
          if (ready) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        if (!ready) throw new Error('测试后端启动超时')
        await use(mailbox)
      } finally {
        if (backend && backend.exitCode === null) {
          const stopped = new Promise<void>((resolve) => backend?.once('exit', () => resolve()))
          backend.kill()
          await stopped
        }
        log.end()
        // schema 为本夹具生成的固定前缀随机标识，绝不删除开发库。
        await database.query(`DROP DATABASE IF EXISTS \`${schema}\``)
        await database.end()
        await new Promise<void>((resolve) => smtp.close(() => resolve()))
      }
    },
    { scope: 'worker', auto: true, timeout: 90_000 },
  ],
})

export { expect }

import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'

await fs.mkdir('artifacts', { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}), args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message) })
page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.log('CONSOLE ERROR', message.text()) } })
await page.goto(`${process.env.TEST_URL || 'http://127.0.0.1:5174'}/?test`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'START YOUR DESCENT' }).waitFor({ timeout: 45000 }).catch(async error => { console.log(await page.locator('body').innerText()); await page.screenshot({ path: 'artifacts/error.png' }); throw error })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'artifacts/garage.png' })
console.log('GARAGE', JSON.stringify(await page.evaluate(() => window.__descent?.snapshot())))
await page.getByRole('button', { name: 'START YOUR DESCENT' }).click()
await page.keyboard.down('w')
await page.waitForTimeout(4000)
await page.keyboard.up('w')
await page.screenshot({ path: 'artifacts/driving.png' })
console.log('DRIVING', JSON.stringify(await page.evaluate(() => window.__descent?.snapshot())))
console.log('ERRORS', JSON.stringify(errors))
await browser.close()

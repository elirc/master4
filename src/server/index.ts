import { createApp } from './app'

const port = Number(process.env.PORT ?? 4000)
const app = createApp()

app.listen(port, () => {
  console.log(`Atlas Fulfillment API listening on http://127.0.0.1:${port}`)
})

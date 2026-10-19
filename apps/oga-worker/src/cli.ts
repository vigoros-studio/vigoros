import { env } from './env'
import { researchPack, scoreboard } from './api'

/** Read-only probes of the worker's two sources. `cli research SE15 5DP` · `cli scoreboard`. */
const [cmd, ...rest] = process.argv.slice(2)
const main = async () => {
  const e = env()
  if (cmd === 'research') {
    const places = rest.length ? [rest.join(' ')] : ['SE15 5DP']
    console.log(JSON.stringify(await researchPack(e, places, 'neighbourhood', 60), null, 2))
  } else if (cmd === 'scoreboard') {
    console.log(JSON.stringify(await scoreboard(e, 30), null, 2))
  } else {
    console.log('commands: research <postcode> | scoreboard')
  }
}
main()

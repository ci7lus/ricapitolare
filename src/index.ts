import Koa from "koa"
import Router from "koa-router"
import { twitterRouter } from "./disguise/twitter"

const main = () => {
    const app = new Koa()
    const router = new Router()
    router.use("/fetch", twitterRouter.routes())
    app.use(router.routes())

    const port = process.env.PORT

    app.listen(port || 5000, () => {
        console.log(`listen on http://localhost:${port || 5000}`)
    })
}
main()

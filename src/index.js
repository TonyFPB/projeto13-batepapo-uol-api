import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dayjs from "dayjs"
import Joi from "joi"
import dotenv from "dotenv"

const userScheme = Joi.object({
    name: Joi.string().min(1).trim(true).required()
})

const messageScheme = Joi.object({
    to: Joi.string().min(1).trim().required(),
    text: Joi.string().min(1).trim().required(),
    type: Joi.string().valid("message", "private_message").required()
})

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.MONGO_URI)

try {
    await mongoClient.connect()
} catch (err) {
    console.log(err)
}
const db = mongoClient.db("chatUol")
const messagesCollection = db.collection("messages")
const participantsCollection = db.collection("participants")

const time = () => dayjs().format("HH:mm:ss")
//participants
app.post("/participants", async (req, res) => {
    const user = req.body

    try {
        const validationName = userScheme.validate(user, { abortEarly: false })
        if (validationName.error) {
            const errors = validationName.error.details.map(d => d.message)
            return res.status(422).send({ message: errors })
        }

        const name = validationName.value.name
        const userExists = await participantsCollection.findOne({ name })
        if (userExists) {
            return res.status(409).send({ message: "Usuário ja existente!" })
        }

        const newUser = { name, lastStatus: Date.now() }
        const newMessage = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', "time": time() }
        await participantsCollection.insertOne(newUser)
        await messagesCollection.insertOne(newMessage)
        res.status(201).send({ name })
    } catch (err) {
        res.sendStatus(500)
        console.log(err)
    }
})

app.get("/participants", async (req, res) => {
    try {
        const toSend = await participantsCollection.find().toArray()
        res.send(toSend.map(u => { return { "name": u.name } }))
    } catch (err) {
        res.sendStatus(500)
    }
})

app.post("/status", async (req, res) => {
    const username = req.headers.user
    try {
        const userExists = await participantsCollection.findOne({ "name": username })
        if (!userExists) {
            return res.sendStatus(404)
        }
        await participantsCollection.updateOne({ name: username }, { "$set": { lastStatus: Date.now() } })
        res.sendStatus(200)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

//messages
app.post("/messages", async (req, res) => {
    const username = req.headers.user
    const message = req.body

    try {
        const messageValidate = messageScheme.validate(message, { abortEarly: false })
        if (messageValidate.error) {
            const errors = messageValidate.error.details.map(d => d.message)
            return res.status(422).send({ "message": errors })
        }

        const userExists = await participantsCollection.findOne({ "name": username })
        if (!userExists) {
            return res.status(422).send({ "message": "Usuario nao esta logado" })
        }

        const newMessage = { "from": username, ...messageValidate.value, "time": time() }
        await messagesCollection.insertOne(newMessage)
        res.sendStatus(201)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})
app.get("/messages", async (req, res) => {
    const limit = Number(req.query.limit)
    const name = req.headers.user

    try {
        const userExists = await participantsCollection.findOne({ name })
        if (!userExists) {
            return res.sendStatus(401)
        }

        const allMessages = await messagesCollection.find({}).toArray()
        const userMessages = allMessages.filter(m => m.to === name || m.from === name || m.type === "status" || m.type === "message")
        if (!isNaN(limit)) {
            return res.send(userMessages.reverse().slice(0, limit).reverse())
        }
        res.send(userMessages)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

})
setInterval(() => {
    const timeExcludes = Date.now()
    participantsCollection.find().toArray().then((listPartipants) => {
        listPartipants.forEach(p => {
            const diference = timeExcludes - p.lastStatus
            if (diference >= 10000) {
                messagesCollection.insertOne({ from: p.name, to: 'Todos', text: 'sai da sala...', type: 'status', "time": time() })
                participantsCollection.deleteOne({ "name": p.name })

            }
        }
        )
    }
    )
}, 15000)


app.listen(5000, () => console.log("Server running in port 5000"))
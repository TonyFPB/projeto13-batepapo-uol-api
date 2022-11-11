import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dayjs from "dayjs"
import joi from "joi"
import dotenv from "dotenv"

const userScheme = joi.object({
    name: joi.string().min(1).trim().required()
})

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.MONGO_URI)
let db;
let messages;
let participants;

try {
    await mongoClient.connect()
    db = mongoClient.db("chatUol")
    messages = db.collection("messages")
    participants = db.collection("participants")
} catch (err) {
    console.log(err)
}

//participants
app.post("/participants", async (req, res) => {
    const user = req.body
    const time = dayjs().format("HH:mm:ss")

    try {
        const validationName = userScheme.validate(user, { abortEarly: false })
        if (validationName.error) {
            const errors = validationName.error.details.map(d => d.message)
            return res.status(422).send({ message: errors })
        }

        const userExists = await participants.findOne({ name: user.name })
        if (userExists) {
            return res.status(409).send({ message: "Usuário ja existente!" })
        }
        // {from: 'xxx', to: 'Todos', text: 'entra na sala...', type: 'status', time: 'HH:MM:SS'}
        const newUser = { name: user.name, lastStatus: Date.now() }
        const newMessage = {from: user.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: time}
        await participants.insertOne(newUser)
        await messages.insertOne(newMessage)
        res.sendStatus(201)
    } catch (err) {
        res.sendStatus(500)
        console.log(err)
    }
})
app.get("/participants", async (req, res) => {
    try {
        const toSend = await participants.find().toArray()
        res.send(toSend)
    } catch (err) {
        res.sendStatus(500)
    }
})


app.listen(5000, () => console.log("Server running in port 5000"))
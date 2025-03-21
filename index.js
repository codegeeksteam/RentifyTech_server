require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hw01f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("rentifytechDB").collection("users");

    //User registration related API
    app.get("/all-users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.status(409).send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RentifyTech_server Site is Running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

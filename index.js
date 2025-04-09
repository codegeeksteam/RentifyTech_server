require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
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
    const usersCollection = client.db('rentifytechDB').collection('users');
    const gadgetsCollection = client.db('rentifytechDB').collection('gadgets');

    // JWT Authentication API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: '365d',
      });
      res.send({ token });
    });

    // middle aware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send('Forbidden Access');
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send('Invalid or Expired Token');
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify Token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'Admin';
      if (!isAdmin) {
        return res.status(403).send('forbidden access');
      }
      next();
    };

    // use verify admin after verify Token
    const verifyAgent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAgent = user?.role === 'Agent';
      if (!isAgent) {
        return res.status(403).send('forbidden access');
      }
      next();
    };

    //User registration related API
    app.get('/all-users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'Admin';
      }
      res.send({ admin });
    });

    app.get('/users/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let users = false;
      if (user) {
        users = user?.role === 'User';
      }
      res.send({ users });
    });

    app.get('/users/agent/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let agent = false;
      if (user) {
        agent = user?.role === 'Agent';
      }
      res.send({ agent });
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.status(409).send({ message: 'User already exists' });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // gadget crud
    // posting a gadget
    app.post('/gadgets', async (req, res) => {
      const gadget = req.body;
      const result = await gadgetsCollection.insertOne(gadget);
      res.send(result);
    });
    // getting all gadgets
    app.get('/gadgets', async (req, res) => {
      const result = await gadgetsCollection.find().toArray();
      res.send(result);
    });

    // get single gadget by id
    const { ObjectId } = require('mongodb'); 
    app.get('/gadget/:id', async (req, res) => {
      try {
        const gadgetId = req.params.id;
        
        // Query the database using ObjectId
        const gadget = await gadgetsCollection.findOne({ _id: new ObjectId(gadgetId) });
    
        if (!gadget) {
          return res.status(404).send({ message: 'Gadget not found' });
        }
    
        res.send(gadget);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching gadget', error: error.message });
      }
    });

    // get gadgets of a seller
    app.get('/gadgets/seller/:email', async (req, res) => {
      try {
        const sellerEmail = req.params.email;
    
        // Query the database for gadgets by the seller's email
        const sellerGadgets = await gadgetsCollection.find({ 'seller.email': sellerEmail }).toArray();
    
        if (sellerGadgets.length === 0) {
          return res.status(404).send({ message: 'No gadgets found for this seller' });
        }
    
        res.send(sellerGadgets);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching seller gadgets', error: error.message });
      }
    });




    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('RentifyTech_server Site is Running!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

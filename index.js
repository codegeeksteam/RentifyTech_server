require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_API_KEY);
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
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
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("rentifytechDB").collection("users");
    const postsCollection = client.db("rentifytechDB").collection("posts");
    const gadgetsCollection = client.db("rentifytechDB").collection("gadgets");
    const cartCollection = client.db("rentifytechDB").collection("cart");
    const paymentCollection = client.db("rentifytechDB").collection("payment");
    const wishListsCollection = client
      .db("rentifytechDB")
      .collection("wishLists");

    // JWT Authentication API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // Middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send("Forbidden Access");
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send("Invalid or Expired Token");
        req.decoded = decoded;
        next();
      });
    };

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send("Forbidden Access");
      }
      next();
    };

    // Verify Agent
    const verifyAgent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAgent = user?.role === "Agent";
      if (!isAgent) {
        return res.status(403).send("Forbidden Access");
      }
      next();
    };

    // User registration related API
    app.get("/all-users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "Admin";
      }
      res.send({ admin });
    });

    app.get("/users/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let users = false;
      if (user) {
        users = user?.role === "User";
      }
      res.send({ users });
    });

    app.get("/users/agent/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let agent = false;
      if (user) {
        agent = user?.role === "Agent";
      }
      res.send({ agent });
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

    // Posts API
    app.get("/posts", async (req, res) => {
      const posts = await postsCollection.find().toArray();
      res.send(posts);
    });

    app.get("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsCollection.findOne(query);
      res.send(result);
    });

    // Promote Agent to Admin
    app.patch(
      "/users/make-admin/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const result = await usersCollection.updateOne(
          { email },
          { $set: { role: "Admin" } }
        );
        res.send(result);
      }
    );

    // Delete User
    app.delete(
      "/delete-user/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
    );

    /**
     * ------- Gadget CRUD ----------
     */
    // Posting a gadget
    app.post("/gadgets", async (req, res) => {
      const gadget = req.body;
      const result = await gadgetsCollection.insertOne(gadget);
      res.send(result);
    });

    // Getting all gadgets
    app.get("/gadgets", async (req, res) => {
      const result = await gadgetsCollection.find().toArray();
      res.send(result);
    });

    // Get single gadget by id
    app.get("/gadget/:id", async (req, res) => {
      try {
        const gadgetId = req.params.id;
        const gadget = await gadgetsCollection.findOne({
          _id: new ObjectId(gadgetId),
        });

        if (!gadget) {
          return res.status(404).send({ message: "Gadget not found" });
        }

        res.send(gadget);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error fetching gadget", error: error.message });
      }
    });

    // Get gadgets of a seller
    app.get("/gadgets/seller/:email", async (req, res) => {
      try {
        const sellerEmail = req.params.email;
        const sellerGadgets = await gadgetsCollection
          .find({ "seller.email": sellerEmail })
          .toArray();

        if (sellerGadgets.length === 0) {
          return res
            .status(404)
            .send({ message: "No gadgets found for this seller" });
        }

        res.send(sellerGadgets);
      } catch (error) {
        res.status(500).send({
          message: "Error fetching seller gadgets",
          error: error.message,
        });
      }
    });

    // Update gadget by id
    app.put("/update-gadget/:id", async (req, res) => {
      try {
        const gadgetId = req.params.id;
        const updatedGadget = req.body;

        if (!ObjectId.isValid(gadgetId)) {
          return res.status(400).send({ message: "Invalid gadget ID" });
        }

        const existingGadget = await gadgetsCollection.findOne({
          _id: new ObjectId(gadgetId),
        });

        if (!existingGadget) {
          return res.status(404).send({ message: "Gadget not found" });
        }

        const result = await gadgetsCollection.updateOne(
          { _id: new ObjectId(gadgetId) },
          { $set: updatedGadget }
        );

        if (result.modifiedCount === 0) {
          return res.status(400).send({ message: "No changes were made" });
        }

        res.send({ message: "Gadget updated successfully", result });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error updating gadget", error: error.message });
      }
    });

    // Delete gadget by id
    app.delete("/delete-gadget/:id", async (req, res) => {
      try {
        const gadgetId = req.params.id;

        if (!ObjectId.isValid(gadgetId)) {
          return res.status(400).send({ message: "Invalid gadget ID" });
        }

        const existingGadget = await gadgetsCollection.findOne({
          _id: new ObjectId(gadgetId),
        });

        if (!existingGadget) {
          return res.status(404).send({ message: "Gadget not found" });
        }

        const result = await gadgetsCollection.deleteOne({
          _id: new ObjectId(gadgetId),
        });

        if (result.deletedCount === 0) {
          return res.status(400).send({ message: "Failed to delete gadget" });
        }

        res.send({ message: "Gadget deleted successfully", result });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error deleting gadget", error: error.message });
      }
    });

    // Cart Collection
    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/cart", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete("/cartDelete/:id", async (req, res) => {
      const cartItemId = req.params.id;
      const query = { _id: new ObjectId(cartItemId) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Wish List Collection
    app.get("/wish", async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const result = await wishListsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/wishlist", async (req, res) => {
      const wishListsItem = req.body;
      const result = await wishListsCollection.insertOne(wishListsItem);
      res.send(result);
    });

    app.delete("/wishListDelete/:id", async (req, res) => {
      const wishItemId = req.params.id;
      const query = { _id: new ObjectId(wishItemId) };
      const result = await wishListsCollection.deleteOne(query);
      res.send(result);
    });

    // // payment route
    // app.post("/create-payment-intent", async (req, res) => {
    //   try {
    //     const { amount } = req.body;

    //     // amount should be in *cents*, e.g., $10 = 1000
    //     const paymentIntent = await stripe.paymentIntents.create({
    //       amount,
    //       currency: "usd",
    //       payment_method_types: ["card"],
    //     });

    //     res.send({
    //       clientSecret: paymentIntent.client_secret,
    //     });
    //   } catch (error) {
    //     res.status(500).send({ error: error.message });
    //   }
    // }); // payment route
    // app.post("/create-payment-intent", async (req, res) => {
    //   try {
    //     const { amount } = req.body;

    //     // amount should be in *cents*, e.g., $10 = 1000
    //     const paymentIntent = await stripe.paymentIntents.create({
    //       amount,
    //       currency: "usd",
    //       payment_method_types: ["card"],
    //     });

    //     res.send({
    //       clientSecret: paymentIntent.client_secret,
    //     });
    //   } catch (error) {
    //     res.status(500).send({ error: error.message });
    //   }
    // });

    // Payment route
    // app.post("/create-payment-intent", async (req, res) => {
    //   try {
    //     const { amount } = req.body;

    //     // Validate amount
    //     if (!amount || isNaN(amount)) {
    //       return res.status(400).send({ error: "Invalid or missing amount" });
    //     }

    //     // Convert amount to cents (integer)
    //     // If amount is in dollars (e.g., 305.57), multiply by 100 to get cents (30557)
    //     const amountInCents = Math.round(parseFloat(amount) * 100);

    //     // Ensure amount is a positive integer
    //     if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
    //       return res
    //         .status(400)
    //         .send({ error: "Amount must be a positive integer in cents" });
    //     }

    //     const paymentIntent = await stripe.paymentIntents.create({
    //       amount: amountInCents,
    //       currency: "usd",
    //       payment_method_types: ["card"],
    //     });

    //     const result = await paymentCollection.insertOne(paymentIntent);
    //     res.send(result);
    //     res.sendStatus("Successful");

    //     console.log("Payment Intent Created:", paymentIntent.client_secret);
    //   } catch (error) {
    //     console.error("Error creating payment intent:", error);
    //     res
    //       .status(500)
    //       .send({ error: error.message || "Failed to create payment intent" });
    //   }
    // });

    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amount } = req.body;

        if (!amount || isNaN(amount)) {
          return res.status(400).send({ error: "Invalid or missing amount" });
        }

        const amountInCents = Math.round(parseFloat(amount) * 100);
        if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
          return res
            .status(400)
            .send({ error: "Amount must be a positive integer in cents" });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
        });

        const result = await paymentCollection.insertOne({
          amount: amountInCents,
          clientSecret: paymentIntent.client_secret,
          createdAt: new Date(),
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: error.message });
      }
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

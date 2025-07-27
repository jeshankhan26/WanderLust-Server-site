const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");
const { ObjectId } = require("mongodb");
const app = express();
const port = 3000;
const cors = require("cors");

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// 🔐 Firebase Admin SDK using environment variables
// const serviceAccount = require("./sportify-c0413-firebase-adminsdk-fbsvc-bef1671050.json");
const decoded = Buffer.from(process.env.VITE_FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.onxzedt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Send a ping to confirm a successful connection

    // Database
    const database = client.db("wanderlustDA");
    const usersCollection = database.collection("users");
    const roleCollection = database.collection("user_role");

    // ✅ Firebase Token Verification Middleware
    const verifyFirebaseToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res
          .status(401)
          .json({ message: "Unauthorized - No token found" });
      }

      const token = authHeader.split(" ")[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
      } catch (error) {
        console.error("❌ Firebase Token Verification Failed:", error);
        return res.status(403).json({ message: "Invalid or expired token" });
      }
    };
    // Check User Exists or not
    app.get("/user-exists", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).json({ error: "Email is required" });
        }

        const foundUser = await usersCollection.findOne({ email });
        res.send({ exists: !!foundUser });
      } catch (error) {
        console.error("Error checking user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
    // ✅ Check Role API
    app.post("/check-role", verifyFirebaseToken, async (req, res) => {
      const email = req.user.email;

      try {
        const user = await usersCollection.findOne({ email });
        const role = user?.role || "user";
        return res.status(200).json({ role });
      } catch (err) {
        console.error("Role Check Failed:", err);
        return res.status(500).json({ error: "Role check failed" });
      }
    });

    // ✅ Add or Update User (Protected)
    app.post("/adduser", async (req, res) => {
      try {
        const newUser = req.body;
        if (!newUser.email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const existing = await usersCollection.findOne({
          email: newUser.email,
        });
        if (existing) {
          return res.status(200).json({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne(newUser);
        res.status(201).json(result);
      } catch (error) {
        console.error("❌ Add User Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // ✅ Get All Users
    app.get("/adduser", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch users", error });
      }
    });
    // ✅ Correct server route for adding roles
    app.post("/api/roles", async (req, res) => {
      try {
        const newRole = req.body;

        if (!newRole.role) {
          return res.status(400).json({ message: "Role is required" });
        }

        const existing = await roleCollection.findOne({ role: newRole.role });
        if (existing) {
          return res.status(200).json({ message: "Role already exists" });
        }

        const result = await roleCollection.insertOne(newRole);
        res.status(201).json({ insertedId: result.insertedId });
      } catch (error) {
        console.error("❌ Add Role Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    // Get All User_Role
    app.get("/api/roles", async (req, res) => {
      const cursor = roleCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
        // Delete a User_Role
    app.delete("/api/roles/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roleCollection.deleteOne(query);
      res.send(result);
    });

    // Rest Of MongoDB Code

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
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

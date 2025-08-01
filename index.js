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
    const serviceCollection = database.collection("service");
    const packageCollection = database.collection("package");
    const blogCollection = database.collection("blog");
    const guideCollection = database.collection("guide");
    const bookingCollection = database.collection("bookingCollection");
    const paymentCollection = database.collection("paymentCollection");

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
    // ✅ GET a single user by ID
    app.get("/adduser/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
      } catch (error) {
        console.error("❌ Failed to fetch user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    // PATCH: Update User Role
    app.patch("/updateRole/:id", async (req, res) => {
      const userId = req.params.id;
      const { role } = req.body;

      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      if (!["user", "member"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "Role updated successfully" });
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
    // Update user route with image upload
    app.patch("/adduser/:id", async (req, res) => {
      const { id } = req.params;
      const { name, email, photoURL } = req.body;

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: { name, email, photoURL },
          }
        );
        res.send(result);
      } catch (err) {
        console.error("❌ Error updating user:", err);
        res.status(500).send({ message: "Update failed", error: err.message });
      }
    });
    // DELETE a user by ID
    app.delete("/adduser/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "User deleted" });
        } else {
          res.status(404).send({ success: false, message: "User not found" });
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({ success: false, message: "Server error" });
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
    // Express route - Search users by name, email, or role (partial, case-insensitive)
    app.get("/searchUsers", async (req, res) => {
      const { query } = req.query;
      if (!query) return res.json([]);

      try {
        const regex = new RegExp(query, "i"); // i = case-insensitive

        const users = await usersCollection
          .find({
            $or: [
              { name: { $regex: regex } },
              { email: { $regex: regex } },
              { role: { $regex: regex } },
            ],
          })
          .toArray();

        res.json(users);
      } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: "Failed to search users" });
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
    // Service Section
// Backend: POST /api/services
app.post("/api/services", async (req, res) => {
  try {
    const { title, subtitle, iconUrl, email } = req.body;

    // ✅ Basic inline validation (fast)
    if (!title || !subtitle || !iconUrl || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Clean and minimal insert
    const service = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      iconUrl: iconUrl.trim(),
      email: email.trim(),
      createdAt: new Date(),
    };

    const result = await serviceCollection.insertOne(service);

    // ✅ Quick response
    res.status(201).json({
      message: "Service created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("❌ Error saving service:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

    // Get all services
    app.get("/api/services", async (req, res) => {
      try {
        const services = await serviceCollection.find().toArray();
        res.send(services);
      } catch (err) {
        res.status(500).send({ message: "Error fetching services" });
      }
    });

    // Delete a service by ID
    app.delete("/api/services/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await serviceCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ success: true });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Service not found" });
        }
      } catch (err) {
        res.status(500).send({ success: false, message: "Delete failed" });
      }
    });
    // Package Section
    app.post("/packageCollection", async (req, res) => {
      const data = req.body;
      const result = await packageCollection.insertOne(data);
      res.send(result);
    });
    // GET all packages
    app.get("/api/packages", async (req, res) => {
      try {
        const packages = await packageCollection.find().toArray();
        res.send(packages);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch packages" });
      }
    });

    // DELETE a package
    app.delete("/api/packages/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await packageCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ message: "Package deleted successfully" });
        } else {
          res.status(404).send({ error: "Package not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to delete package" });
      }
    });
    // Get a single package
    // GET a single package by ID
    app.get("/api/packages/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      try {
        const result = await packageCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!result) {
          return res.status(404).json({ message: "Package not found" });
        }
        res.json(result);
      } catch (error) {
        console.error("❌ Error fetching package:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Put
    app.patch("/api/update/packages/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = { ...req.body };

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      // Remove _id if present in the update payload
      if (updatedData._id) {
        delete updatedData._id;
      }

      try {
        const result = await packageCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Package not found" });
        }
        res.json({ message: "Package updated successfully" });
      } catch (error) {
        console.error("PATCH update error stack:", error.stack);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Moderator Section
    app.get("/api/mypost", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email; // use req.user.email instead of authorEmail
        // No search parameter or filter
        const query = {
          email: email, // assuming in DB the field is authorEmail
        };

        const userPosts = await packageCollection
          .find(query)
          .sort({ _id: -1 }) // sort descending by _id (latest first)
          .toArray();

        res.json(userPosts);
      } catch (error) {
        console.error("❌ Get Posts Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    // Update status
    app.put("/api/packages/status/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const result = await packageCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Package not found" });
        }

        res.json({ message: "Status updated successfully" });
      } catch (error) {
        console.error("❌ Server error while updating status:", error);
        res.status(500).json({ message: "Server error" });
      }
    });
    app.post("/api/blogs", async (req, res) => {
      const { title, article, thumbnail, email, status, videoUrl } = req.body;

      if (!title || !article || !thumbnail || !email) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const blog = {
        title,
        article,
        thumbnail,
        email,
        status,
        videoUrl: videoUrl || "", // ✅ handle optional
      };

      const result = await blogCollection.insertOne(blog);
      res.status(201).json(result);
    });
    app.get("/api/blogs", async (req, res) => {
      try {
        const services = await blogCollection.find().toArray();
        res.send(services);
      } catch (err) {
        res.status(500).send({ message: "Error fetching services" });
      }
    });

// GET single blog by ID
app.get("/api/blog/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const blog = await blogCollection.findOne({ _id: new ObjectId(id) });

    if (!blog) {
      return res.status(404).send({ error: "Blog not found" });
    }

    res.send(blog);
  } catch (error) {
    console.error("❌ Failed to fetch blog:", error);
    res.status(500).send({ error: "Failed to fetch blog" });
  }
});

    // My Post
    app.get("/api/myblog", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email; // use req.user.email instead of authorEmail
        // No search parameter or filter
        const query = {
          email: email, // assuming in DB the field is authorEmail
        };

        const userPosts = await blogCollection
          .find(query)
          .sort({ _id: -1 }) // sort descending by _id (latest first)
          .toArray();

        res.json(userPosts);
      } catch (error) {
        console.error("❌ Get Posts Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    
    // Blog Status Update
    app.put("/api/blog/status/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const result = await blogCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Package not found" });
        }

        res.json({ message: "Status updated successfully" });
      } catch (error) {
        console.error("❌ Server error while updating status:", error);
        res.status(500).json({ message: "Server error" });
      }
    });
    // DELETE a package
    app.delete("/api/blog/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await blogCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ message: "Package deleted successfully" });
        } else {
          res.status(404).send({ error: "Package not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to delete package" });
      }
    });
    // POST /api/guides
    // In your Express server (e.g., routes/guides.js or inside app.js)

    app.post("/api/guides", async (req, res) => {
      const { name, image, fb_link, instagram_link, status, email } = req.body;

      if (!name || !image) {
        return res
          .status(400)
          .json({ message: "Name and image are required." });
      }

      const guide = {
        name,
        image,
        fb_link: fb_link || "",
        instagram_link: instagram_link || "",
        status: status || 1,
        email: email || "", // optionally save email
        createdAt: new Date(),
      };

      try {
        const result = await guideCollection.insertOne(guide);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error inserting guide:", error);
        res.status(500).json({ message: "Server error" });
      }
    });
     app.get("/api/guides", async (req, res) => {
      try {
        const services = await guideCollection.find().toArray();
        res.send(services);
      } catch (err) {
        res.status(500).send({ message: "Error fetching services" });
      }
    });
    // Guide
    app.get("/api/guide", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email; // use req.user.email instead of authorEmail
        // No search parameter or filter
        const query = {
          email: email, // assuming in DB the field is authorEmail
        };

        const userPosts = await guideCollection
          .find(query)
          .sort({ _id: -1 }) // sort descending by _id (latest first)
          .toArray();

        res.json(userPosts);
      } catch (error) {
        console.error("❌ Get Posts Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.put("/api/guide/status/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const result = await guideCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Package not found" });
        }

        res.json({ message: "Status updated successfully" });
      } catch (error) {
        console.error("❌ Server error while updating status:", error);
        res.status(500).json({ message: "Server error" });
      }
    });
    // DELETE a package
    app.delete("/api/guide/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await guideCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ message: "Package deleted successfully" });
        } else {
          res.status(404).send({ error: "Package not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to delete package" });
      }
    });
    // ✅ Save booking data
    app.post("/api/bookings", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);
      res.send(result);
    });
     app.get("/api/mybooking", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email; 
        const query = {
          userEmail: email, 
        };

        const userPosts = await bookingCollection
          .find(query)
          .sort({ _id: -1 }) // sort descending by _id (latest first)
          .toArray();

        res.json(userPosts);
      } catch (error) {
        console.error("❌ Get Posts Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // ✅ Save payment data
    app.post("/api/payments", async (req, res) => {
      const paymentData = req.body;
      const result = await paymentCollection.insertOne(paymentData);
      res.send(result);
    });
     app.get("/api/mypayments", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email; 
        const query = {
          userEmail: email, 
        };

        const userPosts = await paymentCollection
          .find(query)
          .sort({ _id: -1 }) // sort descending by _id (latest first)
          .toArray();

        res.json(userPosts);
      } catch (error) {
        console.error("❌ Get Posts Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
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

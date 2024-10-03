require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// MongoDB Connection
const uri = process.env.NEXT_PUBLIC_DATABASE_URI;

const client = new MongoClient(uri, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("babKrShop");
    const usersCollection = db.collection("users");
    const productsCollection = db.collection("baby accessories");
    const categoriesCollection = db.collection("categories");
    const ordersCollection = db.collection("orders");

    // * Authentication & Authorization
    // User Registration
    app.post("/register", async (req, res) => {
      const { name, email, role, password } = req.body;

      // Check if email already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await usersCollection.insertOne({
        name,
        email,
        role,
        password: hashedPassword,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });

    // User Login
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid  password" });
      }

      // Generate JWT token
      const accessToken = jwt.sign(
        { name: user.name, email: user.email, role: user.role },
        process.env.NEXT_PUBLIC_JWT_SECRET,
        {
          expiresIn: process.env.NEXT_PUBLIC_EXPIRES_IN,
        }
      );

      console.log(accessToken);
      res.json({
        success: true,
        message: "Login successful",
        accessToken,
      });
    });

    // =============================================================

    //  get all  products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find({}).toArray();
      res.status(200).json({
        success: true,
        message: "All Products retrieved successfully",
        data: result,
      });
    });
    // get a specific product
    app.get("/products/:productId", async (req, res) => {
      try {
        const id = req.params.productId;

        const _id = new ObjectId(id);
        const result = await productsCollection.findOne({ _id });

        if (!result) {
          res.status(404).json({
            success: false,
            message: "Product not found",
          });
        } else {
          res.status(200).json({
            success: true,
            message: "Product retrieved successfully",
            data: result,
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });
    //  get all  categories
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find({}).toArray();
      res.status(200).json({
        success: true,
        message: "All Categories retrieved successfully",
        data: result,
      });
    });
    // get specific categories
    app.get("/baby-accessories", async (req, res) => {
      const name = req.query.category;
      let categories = [];
      if (name) {
        categories = await productsCollection
          .find({ category: { $regex: new RegExp(name), $options: "i" } })
          .toArray();
      } else if (!name) {
        categories = await productsCollection.find({}).toArray();
      }
      res.send({ status: true, message: "success", data: categories });
    });
    // * update a product
    app.put("/products/:productId", async (req, res) => {
      try {
        const id = req.params.productId;
        // Validate the ObjectId before converting
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid product ID format",
          });
        }
        const _id = new ObjectId(id);
        const data = req.body;
        const updatedProduct = {
          $set: {
            image: data.image,
            title: data.title,
            category: data.category,
            price: data.price,
            prevPrice: data.prevPrice,
            isFlashSale: data.isFlashSale,
            ...data,
          },
        };

        const result = await productsCollection.updateOne(
          { _id },
          updatedProduct
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Product updated successfully",
          data: updatedProduct,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });
    // * delete a product
    app.delete("/products/:productId", async (req, res) => {
      try {
        const id = req.params.productId;
        const _id = new ObjectId(id);

        const result = await productsCollection.deleteOne({ _id });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Product deleted successfully",
        });
      } catch (error) {
        throw new Error(error.message);
      }
    });

    // * create a new product
    app.post("/product", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.status(200).json({
        success: true,
        message: "Product created successfully",
        data: result,
      });
    });
    // * create a new category
    app.post("/category", async (req, res) => {
      const category = req.body;
      const result = await categoriesCollection.insertOne(category);
      res.status(200).json({
        success: true,
        message: "Category created successfully",
        data: result,
      });
    });

    // * create a new order
    app.post("/order", async (req, res) => {
      const {
        userName,
        userEmail,
        products,
        totalItems,
        totalAmount,
        paymentMethod,
        status,
      } = req.body;
      const result = await ordersCollection.insertOne({
        userName,
        userEmail,
        products,
        totalItems,
        totalAmount,
        paymentMethod,
        status,
        createdAt: new Date(),
      });
      res.status(200).json({
        success: true,
        message: "Order created successfully",
        data: result,
      });
    });
    // * get all orders or user-specific orders
    app.get("/orders", async (req, res) => {
      const { userEmail } = req.query;

      let result;
      if (userEmail) {
        // If userEmail is provided, get specific user's orders
        result = await ordersCollection.find({ userEmail }).toArray();
        res.status(200).json({
          success: true,
          message: "User Orders retrieved successfully",
          data: result,
        });
      } else {
        // If no userEmail is provided, get all orders
        result = await ordersCollection.find({}).toArray();
        res.status(200).json({
          success: true,
          message: "All Orders retrieved successfully",
          data: result,
        });
      }
    });
    // * get specific order
    app.get("/orders/:orderId", async (req, res) => {
      const id = req.params.orderId;
      const _id = new ObjectId(id);
      const result = await ordersCollection.findOne({ _id });

      res.status(200).json({
        success: true,
        message: "Order retrieved successfully",
        data: result,
      });
    });
    //  * update a specific order
    app.put("/orders/:orderId", async (req, res) => {
      const id = req.params.orderId;
      const _id = new ObjectId(id);
      const data = req.body;
      const updatedOrder = {
        $set: {
          status: "delivered",
          ...data,
        },
      };

      const result = await ordersCollection.updateOne({ _id }, updatedOrder);

      res.status(200).json({
        success: true,
        message: "Order updated successfully",
        data: updatedOrder,
      });
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  const statusObject = {
    statusMessage: "Baby Care Shop Server is running very smoothly!",
    timeStamp: new Date(),
  };
  res.send(statusObject);
});

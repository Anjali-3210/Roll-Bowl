const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

// Customer Login Route
app.post("/customer-login", async (req, res) => {
  const { name, phone } = req.body;

  let user = await prisma.user.findFirst({
    where: { phone }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        phone,
        token: uuidv4(), 
      },
    });
  }
  
  res.redirect(`/customer?token=${user.token}`);
});

// Admin Login Route
app.post("/admin-login", (req, res) => {
  const { adminKey } = req.body;

  if (adminKey === process.env.ADMIN_KEY) {
    return res.redirect("/admin?key=" + adminKey);
  }

  res.send("Invalid Admin Key");
});


app.get("/", (req, res) => {
  res.send("Roll Bowl backend is running");
});

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post("/users", async (req, res) => {
  const user = await prisma.user.create({
    data: {
      name: req.body.name,
      token: uuidv4(),
    },
  });

  res.json(user);
});

app.post("/subscribe", async (req, res) => {
  const { userId, startDate, endDate } = req.body;

  const subscription = await prisma.subscription.create({
    data: {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      userId: userId,
    },
  });

  res.json(subscription);
});


app.get("/u/:token", async (req, res) => {
  const { token } = req.params;

  const user = await prisma.user.findUnique({
    where: { token },
    include: {
      subscription: true,
      votes: true,
    },
  });

  if (!user) {
    return res.status(404).send("Invalid or expired link");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const menu = await prisma.menu.findFirst({
  where: {
    date: {
      gte: today,
      lte: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    },
  },
  });

  let remainingDays = 0;

if (user.subscription) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(user.subscription.endDate);
  end.setHours(0, 0, 0, 0);

  remainingDays = Math.ceil(
    (end - today) / (1000 * 60 * 60 * 24)
  );
}



  res.render("customer", {
    name: user.name,
    token: user.token,
    todayMenu: menu,
    remainingDays,
  });
});



app.post("/menu", async (req, res) => {
  const { date, items } = req.body;

  const menu = await prisma.menu.upsert({
    where: {
      date: new Date(date),
    },
    update: {
      items,
    },
    create: {
      date: new Date(date),
      items,
    },
  });

  res.json(menu);
});


app.get("/menu/today", async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const menu = await prisma.menu.findFirst({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  res.json(menu);
});



app.post("/vote", async (req, res) => {
  const { token, willEat, choice } = req.body;

  const user = await prisma.user.findUnique({
    where: { token },
  });

  if (!user) {
    return res.status(404).json({ error: "Invalid user token" });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const vote = await prisma.vote.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: tomorrow,
      },
    },
    update: {
      willEat,
      choice,
    },
    create: {
      userId: user.id,
      date: tomorrow,
      willEat,
      choice,
    },
  });

  res.json(vote);
});



app.get("/admin/tomorrow-count", async (req, res) => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const count = await prisma.vote.count({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      willEat: true,
    },
  });

  res.json({
    date: start,
    willEatCount: count,
  });
});



app.get("/admin/tomorrow-users", async (req, res) => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const users = await prisma.vote.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      willEat: true,
    },
    include: {
      user: true,
    },
  });

  res.json(
    users.map(v => ({
      userId: v.user.id,
      name: v.user.name,
      choice: v.choice,
    }))
  );
});



app.get("/admin", async (req, res) => {
  const adminKey = req.query.key;

  if (adminKey !== "rollbowl-admin-123") {
    return res.status(403).send("Access denied");
  }

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const votes = await prisma.vote.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      willEat: true,
    },
    include: {
      user: true,
    },
  });

  res.render("admin", {
    count: votes.length,
    users: votes.map(v => ({
      name: v.user.name,
      choice: v.choice,
    })),
  });
});


app.post("/vote-ui", async (req, res) => {
  const { token, willEat, choice } = req.body;

  const user = await prisma.user.findUnique({
    where: { token },
  });

  if (!user) {
    return res.status(404).send("Invalid user");
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await prisma.vote.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: tomorrow,
      },
    },
    update: {
      willEat: willEat === "true",
      choice,
    },
    create: {
      userId: user.id,
      date: tomorrow,
      willEat: willEat === "true",
      choice,
    },
  });

  res.send("Your response has been recorded. Thank you!");
});


app.get("/admin/kitchen-summary", async (req, res) => {
  const adminKey = req.query.key;

  if (adminKey !== "rollbowl-admin-123") {
    return res.status(403).send("Access denied");
  }

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const votes = await prisma.vote.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      willEat: true,
    },
  });

  const summary = {};

  votes.forEach(v => {
    if (!v.choice) return;
    summary[v.choice] = (summary[v.choice] || 0) + 1;
  });

  res.json(summary);
});


app.get("/admin/kitchen", async (req, res) => {
  const adminKey = req.query.key;

  if (adminKey !== "rollbowl-admin-123") {
    return res.status(403).send("Access denied");
  }

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const votes = await prisma.vote.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      willEat: true,
    },
  });

  const summary = {};
  votes.forEach(v => {
    if (!v.choice) return;
    summary[v.choice] = (summary[v.choice] || 0) + 1;
  });

  res.render("kitchen", { summary });
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});






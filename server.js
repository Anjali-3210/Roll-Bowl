const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const prisma = new PrismaClient();
app.use(express.static("public"));

async function isHoliday(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const holiday = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: start,
        lte: end
      }
    }
  });

  return !!holiday;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.get("/", (req, res) => {
  res.render("index");
});

// Unified entry route
app.post("/entry", async (req, res) => {
  const { name, phone, adminKey, role } = req.body;

  if (role === "admin") {
    if (adminKey === process.env.ADMIN_KEY) {
      return res.redirect("/admin?key=" + adminKey);
    }

    if (adminKey === process.env.KITCHEN_KEY) {
      return res.redirect("/kitchen?key=" + adminKey);
    }

    return res.send("Invalid admin/kitchen key");
  }

  // Customer flow
  let user = await prisma.user.findFirst({
    where: { phone }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        phone,
        token: uuidv4()
      }
    });
  }

  return res.redirect(`/u/${user.token}`);
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
  const { userId, startDate, planType } = req.body;

  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 25); // 25-day validity

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      startDate: start,
      endDate: end,
      totalMeals: 20,
      mealsConsumed: 0,
      planType, // BASIC or PREMIUM
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
    subscription,
  });
});



app.post("/menu", async (req, res) => {
  const { date, items } = req.body;

  const menu = await prisma.menu.upsert({
    where: { date: new Date(date) },
    update: {
      items,
      isWeekly: false, // override
    },
    create: {
      date: new Date(date),
      items,
      isWeekly: false,
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

  if (adminKey !== "Rollbowl@0907") {
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

app.post("/admin/holiday", async (req, res) => {
  const { date, reason } = req.body;

  const holiday = await prisma.holiday.create({
    data: {
      date: new Date(date),
      reason
    }
  });

  res.json(holiday);
});


app.post("/admin/menu-week", async (req, res) => {
  const { startDate, items } = req.body;

  const start = new Date(startDate); // Sunday
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    // Skip weekends automatically
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    await prisma.menu.upsert({
      where: { date },
      update: {
        items,
        isWeekly: true,
      },
      create: {
        date,
        items,
        isWeekly: true,
      },
    });
  }

  res.send("Weekly menu uploaded successfully");
});


app.post("/vote-ui", async (req, res) => {

  // ⏰ 10:30 PM cutoff check
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(22, 30, 0, 0); // 10:30 PM

  if (now > cutoff) {
    return res.send("Order for tomorrow is closed after 10:30 PM.");
  }

  const { token, willEat, choice } = req.body;

  // 👤 User check
  const user = await prisma.user.findUnique({
    where: { token },
  });

  if (!user) {
    return res.status(404).send("Invalid user");
  }

  // 📅 Tomorrow date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // 🚫 Holiday / weekend check
  if (isWeekend(tomorrow) || await isHoliday(tomorrow)) {
    return res.send("Voting is disabled due to holiday / weekend.");
  }

  // 📦 Active subscription check
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      endDate: {
        gte: new Date(),
      },
    },
  });

  if (!subscription) {
    return res.send("No active subscription.");
  }

  // 🍽️ Meal quota check
  if (subscription.mealsConsumed >= subscription.totalMeals) {
    return res.send("Your meal quota is exhausted.");
  }

  // 🧠 Normalize selected choices
  let selectedChoices = [];

  if (Array.isArray(choice)) {
    selectedChoices = choice;
  } else if (choice) {
    selectedChoices = [choice];
  }

  // 🔒 Plan-based validation
  if (subscription.planType === "BASIC") {
    if (selectedChoices.length !== 1) {
      return res.send("Basic plan allows only one item.");
    }
  }

  if (subscription.planType === "PREMIUM") {
    if (selectedChoices.length !== 2) {
      return res.send("Premium plan allows exactly two items.");
    }

    const hasRoll = selectedChoices.some(c =>
      c.toLowerCase().includes("roll")
    );

    const hasBowl = selectedChoices.some(
      c =>
        c.toLowerCase().includes("rice") ||
        c.toLowerCase().includes("bowl")
    );

    if (!hasRoll || !hasBowl) {
      return res.send("Premium plan requires one roll and one bowl.");
    }
  }

  // 🗳️ Save / update vote
  await prisma.vote.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: tomorrow,
      },
    },
    update: {
      willEat: willEat === "true",
      choice: selectedChoices.join(", "),
    },
    create: {
      userId: user.id,
      date: tomorrow,
      willEat: willEat === "true",
      choice: selectedChoices.join(", "),
    },
  });

  // ➕ Increment meals ONLY if eating
  if (willEat === "true") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        mealsConsumed: {
          increment: 1,
        },
      },
    });
  }

  // ✅ Success screen
  res.render("vote-success");
});



app.get("/admin/kitchen-summary", async (req, res) => {
  const adminKey = req.query.key;

  if (adminKey !== "Rollbowl@0907") {
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

  if (adminKey !== "Rollbowl@0907") {
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




























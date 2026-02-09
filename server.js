const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const prisma = new PrismaClient();
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

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

app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (err) {
    console.error("USERS FETCH ERROR:", err);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/subscribe", async (req, res) => {
  try {
    const { userId, startDate } = req.body;

    if (!userId || !startDate) {
      return res.status(400).send("userId and startDate are required");
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 25); // 25-day validity

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        startDate: start,
        endDate: end
      }
    });

    res.json(subscription);

  } catch (err) {
    console.error("SUBSCRIBE ERROR:", err);
    res.status(500).send("Internal Server Error: " + err.message);
  }
});


app.get("/u/:token", async (req, res) => {
  try {
    const { token } = req.params;

    console.log("TOKEN:", token);

    const user = await prisma.user.findUnique({
      where: { token }
    });

    console.log("USER:", user);

    if (!user) {
      return res.send("User not found");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        endDate: {
          gte: new Date()
        }
      }
    });

    console.log("SUBSCRIPTION:", subscription);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const menu = await prisma.menu.findFirst({
      where: { date: today }
    });

    console.log("MENU:", menu);

    res.render("customer", {
      name: user.name,
      token: user.token,
      todayMenu: menu,
      subscription
    });

  } catch (err) {
    console.error("LOGIN PAGE CRASH:", err);
    res.status(500).send(err.message);
  }
});




app.post("/menu", async (req, res) => {
  const { date, items } = req.body;

  const menu = await prisma.menu.upsert({
    where: { date: new Date(date) },
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

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).send("Access denied");
  }

  const users = await prisma.user.findMany({
    include: {
      subscription: true
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data = [];

  for (const user of users) {
    if (!user.subscription) continue;

    const usedMeals = await prisma.vote.count({
      where: {
        userId: user.id,
        willEat: true
      }
    });

    const end = new Date(user.subscription.endDate);
    end.setHours(0, 0, 0, 0);

    const remainingDays = Math.max(
      0,
      Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    );

    data.push({
      name: user.name,
      phone: user.phone,
      startDate: user.subscription.startDate,
      endDate: user.subscription.endDate,
      mealsUsed: usedMeals,
      mealsRemaining: Math.max(0, 20 - usedMeals),
      remainingDays
    });
  }

  res.render("admin", { users: data });
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
  try {
    const { weekStartDate, menu } = req.body;

    if (!weekStartDate || !menu) {
      return res.status(400).send("weekStartDate and menu are required");
    }

    const sunday = new Date(weekStartDate);
    sunday.setHours(0, 0, 0, 0);

    if (sunday.getDay() !== 0) {
      return res.status(400).send("weekStartDate must be a Sunday");
    }

    const dayOffsetMap = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5
    };

    for (const day of Object.keys(dayOffsetMap)) {
      if (!menu[day]) continue;

      const date = new Date(sunday);
      date.setDate(sunday.getDate() + dayOffsetMap[day]);
      date.setHours(0, 0, 0, 0); // 🔴 CRITICAL LINE

      // Delete existing menu for safety (prevents Prisma crash)
      await prisma.menu.deleteMany({
        where: { date }
      });

      // Create fresh entry
      await prisma.menu.create({
        data: {
          date,
          items: menu[day],
        }
      });
    }

    res.send("Weekly day-wise menu uploaded successfully");

  } catch (err) {
    console.error("WEEKLY MENU ERROR:", err);
    res.status(500).send("Internal Server Error: " + err.message);
  }
});




app.post("/vote-ui", async (req, res) => {
  try {
    const { token, willEat } = req.body;
    let { choice } = req.body;

    // Normalize choice to array
    if (!choice) {
      choice = [];
    } else if (!Array.isArray(choice)) {
      choice = [choice];
    }

    // ⏰ 10:30 PM cutoff
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(22, 30, 0, 0);

    if (now > cutoff) {
      return res.send("Order for tomorrow is closed after 10:30 PM.");
    }

    const user = await prisma.user.findUnique({
      where: { token }
    });

    if (!user) {
      return res.send("Invalid user");
    }

    // Tomorrow date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Active subscription check
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        endDate: { gte: new Date() }
      }
    });

    if (!subscription) {
      return res.send("No active subscription.");
    }

    // Meal limit (20)
    const usedMeals = await prisma.vote.count({
      where: {
        userId: user.id,
        willEat: true
      }
    });

    if (usedMeals >= 20) {
      return res.send("Your 20 meal quota is exhausted.");
    }

    // Basic validation
    if (willEat === "true" && choice.length === 0) {
      return res.send("Please select at least one item.");
    }

    // Save vote
    await prisma.vote.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: tomorrow
        }
      },
      update: {
        willEat: willEat === "true",
        choice: choice.join(", ")
      },
      create: {
        userId: user.id,
        date: tomorrow,
        willEat: willEat === "true",
        choice: choice.join(", ")
      }
    });

    // Success
    res.send("✅ Your meal for tomorrow has been recorded!");

  } catch (err) {
    console.error("VOTE ERROR:", err);
    res.status(500).send("Internal Server Error");
  }
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









































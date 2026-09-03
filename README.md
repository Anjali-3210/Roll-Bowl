# Roll Bowl – Smart Meal Subscription Platform

Roll Bowl is a full-stack meal subscription and management platform that allows customers to subscribe to meal plans, view daily menus, vote for their meals, and track their meal usage. An admin dashboard allows staff to manage menus, monitor meal requirements, and manage customer subscriptions.

## Features

### Customer

- Customer registration and token-based authentication
- Personalized customer dashboard
- View subscription start date and end date
- View active subscription plan
- Track meals consumed and meals remaining
- View daily menu with date and day
- Vote for meals within the allowed voting window
- Skip a meal when required
- Plan-based meal selection
- SOLO plan allows selection of one item
- PLUS plan allows selection of two items

### Admin

- Secure admin dashboard
- View total meals required for the upcoming meal
- View customers who are eating
- View customer subscription information
- View customer plan type
- View subscription start and end dates
- View meals consumed and meals remaining
- View remaining subscription days
- Upload and manage daily menus
- Monitor daily meal requirements

## Subscription Plans

| Plan | Price | Meal Selection | Meal Quota | Validity |
|------|------:|----------------|------------|----------|
| SOLO | ₹1000 | 1 item         | 20 meals | 25 days |
| PLUS | ₹1900 |1 Roll+Rice Bowl|20 meals| 25 days |

### SOLO Plan

Customers can select exactly one item from the available menu.

### PLUS Plan

Customers can select exactly two items:

- One Roll
- One Rice Bowl

The backend validates the plan restrictions before recording the vote.

## Voting System

The application uses a time-based voting system.

- Before 10:00 AM – Customers can vote for today's meal.
- 10:00 AM to 6:00 PM – Voting is closed.
- After 6:00 PM – Customers can vote for tomorrow's meal.

The selected voting date is automatically determined by the backend based on the current time.

## Menu Management

The admin can upload menus for individual days.

Menus can be changed when necessary, allowing the system to handle emergency menu changes or other operational requirements.

Customers can see the menu along with the corresponding date and day before submitting their meal choice.

## Dashboard

### Customer Dashboard

The customer dashboard displays:

- Customer name
- Subscription plan
- Subscription start date
- Subscription end date
- Remaining subscription days
- Total meals
- Meals consumed
- Meals remaining
- Today's available menu
- Meal voting options

### Admin Dashboard

The admin dashboard displays:

- Total meals to prepare
- Customers eating
- Customer names
- Customer contact information
- Subscription plan
- Subscription start date
- Subscription end date
- Remaining subscription days
- Meals consumed
- Meals remaining

## Technology Stack

### Frontend

- HTML5
- CSS3
- Bootstrap
- EJS

### Backend

- Node.js
- Express.js

### Database

- PostgreSQL
- Prisma ORM

### Tools

- Git
- GitHub
- Postman
- VS Code

### Deployment

- Render

## System Architecture

```text
Customer / Admin
       |
       v
   EJS + HTML + CSS
       |
       v
   Express.js
       |
       v
   REST APIs
       |
       v
   Prisma ORM
       |
       v
   PostgreSQL

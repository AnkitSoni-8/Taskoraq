# Jira Clone - Project Management Workspace

A full-stack project management application built with **React**, **Node.js**, **Express**, and **MongoDB**. This project provides real-time issue tracking, Kanban board interactions, sprint management, and team collaboration.

---

## 🛠️ Developer Notes & Architecture Decisions

> **Personal Note:**  
> While building this Jira Clone, my main focus was on optimizing board performance and creating a seamless real-time drag-and-drop user experience. 

### Key Technical Challenges & How I Solved Them:
1. **State Synchronization in Kanban Board:**
   - *Challenge:* Preventing UI flicker and lag when dragging tasks across columns with Socket.io updates.
   - *Solution:* Implemented optimistic UI updates on the frontend while verifying state persistence asynchronously in the backend.

2. **Custom Auth & Role-Based Access Control (RBAC):**
   - *Challenge:* Managing dynamic permissions between Admins, Project Managers, and Developers.
   - *Solution:* Built custom Express middleware (`auth.js`) paired with JWT verification to dynamically validate user permissions on API endpoints.

---

## 🚀 Features

- **Kanban Board:** Interactive drag-and-drop task management.
- **Sprint Management:** Create, start, and complete sprints smoothly.
- **Real-Time Collaboration:** Socket.io integrations for instant status updates.
- **Analytics & Reports:** Detailed project progress and audit logging.
- **User Roles & Invites:** Invite team members and manage role-based visibility.

---

## 🧰 Tech Stack

- **Frontend:** React, Vite, Framer Motion / GSAP, Tailwind / Custom CSS
- **Backend:** Node.js, Express.js, MongoDB (Mongoose)
- **Realtime:** Socket.io
- **Testing:** Vitest

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB running locally or MongoDB Atlas URI

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/jira-clone.git
   cd jira-clone
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npm run seed  # Seed sample demo data
   npm start
   ```

3. **Frontend Setup:**
   ```bash
   # From root directory
   npm install
   npm run dev
   ```

---

## 📝 Future Improvements & TODOs
- [ ] Add voice command integration for fast issue creation.
- [ ] Implement export to PDF / CSV for analytics reports.
- [ ] Enhanced keyboard shortcuts for power users.

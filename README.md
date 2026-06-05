# 🛺 MaATO

**MaATO** is a privacy-first, real-time visibility network for shared auto-rickshaws in Indian cities (starting with Asansol, West Bengal). It connects passengers looking for shared rides with nearby auto-rickshaw drivers without exposing personal identity or phone numbers.

![MaATO Logo](https://raw.githubusercontent.com/mana629/MaATO/main/public/logo.svg) *(Logo description: Stylized M and A monogram in a gold rounded square outline)*

---

## 🌟 Key Features

- **Privacy-First**: No phone numbers are exchanged. Passengers and drivers are identified purely by random, anonymous system IDs (e.g., `USR-4K2M`, `DRV-8B9A`).
- **Real-Time Visibility**: Live map view of active shared auto-rickshaws in the city using open-source mapping (`React Leaflet` + `OpenStreetMap`).
- **Live Ride Broadcasts**: Passengers can input their destination and number of passengers to instantly broadcast requests to nearby drivers in real-time.
- **Supabase Realtime**: Location updates and ride acceptance events are pushed instantly via PostgreSQL Replication.
- **Premium Design Aesthetics**: Luxury dark-gold aesthetic featuring standard typography (`Cormorant Garamond` and `Outfit` fonts) and clean micro-interactions.

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (SSR React Meta-Framework)
- **Bundler & Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native CSS variable mapping
- **Database & Backend**: [Supabase](https://supabase.com/)
  - Database: PostgreSQL
  - Authentication: Passwordless Email OTP
  - Realtime: Postgres Changes (Replication triggers)
- **Map Library**: [Leaflet](https://leafletjs.com/) via [React Leaflet](https://react-leaflet.js.org/)

---

## 📊 Database Schema & Security Policies

MaATO implements Row Level Security (RLS) policies on all tables to ensure strict privacy boundaries.

### 1. `profiles`
Tracks public profile details for each authenticated user.
- `id` (uuid, primary key) -> References `auth.users(id)`
- `system_id` (text, unique) -> Format: `USR-[4-char hex]` or `DRV-[4-char hex]`
- `role` (text) -> `passenger` or `driver`
- **Security**: Authenticated users can read any profile (only public role + system_id are exposed). Users can only update their own profile.

### 2. `driver_profiles`
Tracks driver location and online status.
- `user_id` (uuid, primary key) -> References `auth.users(id)`
- `vehicle_number` (text)
- `is_online` (boolean)
- `current_lat` / `current_lng` (double precision)
- `last_seen` (timestamp)
- **Security**: Anyone logged in can read online drivers. Drivers can manage only their own profile.

### 3. `passenger_requests`
Tracks live broadcasted requests.
- `id` (uuid, primary key)
- `passenger_id` (uuid) -> References `auth.users(id)`
- `destination_label` (text)
- `pickup_lat` / `pickup_lng` (double precision)
- `passenger_count` (integer, 1 to 6)
- `status` (text) -> `open`, `accepted`, `cancelled`, or `completed`
- `accepted_by` (uuid) -> References `auth.users(id)` (driver)
- **Security**: Passengers can create requests. Logged-in users can read open requests, or their own requests (any status). Drivers can update requests only to accept them (transition status to `accepted` and set `accepted_by = self`).

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm/bun installed.

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/mana629/MaATO.git
   cd MaATO
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   bun dev
   ```

5. Build for production:
   ```bash
   npm run build
   # or
   bun build
   ```

---

## 🔒 License
This project is open-source. Feel free to contribute or self-host!

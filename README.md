# 📚 Book Guardian

A beautiful, mobile-first web application to manage your personal book collection. Track your books, organize them into libraries and shelves, manage lending, and discover new titles using ISBN lookup.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square&logo=docker)

## ✨ Features

- **📚 Library Management**: Organize your books into custom libraries and shelves
- **🔍 Smart Book Entry**:
  - **Manual Mode**: Full control with detailed form entry
  - **ISBN Lookup**: Automatically fetch book details from Google Books API
  - **Camera Mode**: Capture book covers for AI-powered analysis (requires OpenAI API key)
- **🤝 Lending Tracker**: Keep track of who borrowed your books and when they're due back
- **⭐ Ratings & Reviews**: Rate your books and add personal notes
- **🔎 Advanced Filtering**: Filter by rating, reading status, library, and more
- **📤 Export Options**: Export your collection in CSV, MARC21, or JSON formats
- **📱 Mobile First**: Optimized for smartphones with a responsive design for desktop
- **🎨 Modern UI**: Beautiful, intuitive interface built with Tailwind CSS
- **📊 Admin Dashboard**: Track AI usage, manage user quotas, and monitor platform statistics
- **💰 Usage Tracking**: Built-in token and API call tracking with three-tier quota system (Free, Pro, Unlimited)

## 🚀 Quick Start

### Using Docker Compose (Recommended)

The easiest way to run Book Guardian is using Docker Compose:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RuBiCK/bookguardian.git
   cd bookguardian
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env if needed (default values work for Docker Compose)
   ```

3. **Start the application**:
   ```bash
   docker compose up -d
   ```

4. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser

The first startup will:
- Build the Next.js application
- Start PostgreSQL database
- Run database migrations automatically

### Manual Installation

If you prefer to run without Docker:

#### Prerequisites

- Node.js 18 or higher
- PostgreSQL 15 or higher (or use Docker for database only)

#### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RuBiCK/bookguardian.git
   cd bookguardian
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the database** (if using Docker):
   ```bash
   docker compose up -d postgres
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database connection string
   ```

5. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration

Book Guardian uses environment variables for configuration. Copy `.env.example` to `.env` and customize as needed.

### Required Configuration

```env
# Database connection string
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

### Optional Configuration

```env
# OpenAI API Key (for Camera feature)
# Get your key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-actual-api-key-here

# Google Books API Key (for enhanced ISBN lookup)
# Get your key from https://console.cloud.google.com/
GOOGLE_BOOKS_API_KEY=your-google-books-api-key-here
```

### Camera Feature Setup

The camera feature uses AI to extract book information from cover images. To enable it:

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add it to your `.env` file as `OPENAI_API_KEY`
4. The feature will automatically become functional

> **Note**: The camera feature is currently a demonstration skeleton. Full implementation requires integrating the OpenAI API in `src/components/AddBookCamera.tsx`.

### Admin Dashboard Setup

Book Guardian includes a built-in admin dashboard for tracking AI usage and managing user quotas. To set up your first admin user:

1. **Create your user account** by signing up through the application
2. **Set yourself as admin** by running the SQL script:

```bash
# For Docker deployment
docker exec -i book-guardian-db psql -U library_user -d personal_library << 'EOF'
-- Update all users with default quotas
UPDATE "User"
SET role = 'USER', tier = 'FREE',
    "monthlyTokenQuota" = 50000, "monthlyCallQuota" = 20,
    "tokensUsed" = 0, "callsUsed" = 0,
    "quotaResetDate" = NOW() + INTERVAL '1 month'
WHERE role IS NULL OR role = '';

-- Set your user as ADMIN with unlimited quota
UPDATE "User"
SET role = 'ADMIN', tier = 'UNLIMITED',
    "monthlyTokenQuota" = 999999999, "monthlyCallQuota" = 999999
WHERE email = 'your-email@example.com';  -- Replace with your email

SELECT email, role, tier FROM "User";
EOF
```

3. **Access the admin dashboard** by clicking your profile → "Admin Dashboard"

#### Quota Tiers

Book Guardian includes three quota tiers for AI usage:

- **Free Tier**: 50,000 tokens, 20 API calls per month
- **Pro Tier**: 500,000 tokens, 200 API calls per month
- **Unlimited Tier**: Unlimited usage (admin users)

Admins can change user tiers through the admin dashboard. Quotas reset automatically at the beginning of each month.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL 15](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Deployment**: Docker & Docker Compose

## 📦 Production Deployment

### Docker Compose (Recommended)

The included `docker-compose.yml` is production-ready and includes:

- Multi-stage optimized Docker build
- Health checks for both services
- Automatic database migrations
- Persistent data volumes
- Restart policies

Deploy to your server:

```bash
# Clone the repository
git clone https://github.com/RuBiCK/bookguardian.git
cd bookguardian

# Configure production environment
cp .env.example .env
# Edit .env with production database credentials

# Start in production mode
docker compose up -d

# View logs
docker compose logs -f app
```

### Environment Variables for Production

Make sure to set secure values for production:

```env
DATABASE_URL="postgresql://secure_user:secure_password@postgres:5432/personal_library?schema=public"
NODE_ENV=production
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Book data provided by [Google Books API](https://developers.google.com/books)
- Icons by [Lucide](https://lucide.dev/)

---

Made with ❤️ for book lovers everywhere

# Christmas Present App

## Overview
The Christmas Present App is a multi-user application designed to enhance the experience of giving and receiving Christmas presents. It allows users to create, manage, and share their present lists with friends and family.

## Features
- User authentication and management
- Create, retrieve, update, and delete presents
- Real-time updates for present lists
- Integration with Supabase for database management

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node package manager)
- Supabase account

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/christmas-present-app.git
   ```
2. Navigate to the project directory:
   ```
   cd christmas-present-app
   ```
3. Install the dependencies:
   ```
   npm install
   ```

### Configuration
1. Create a `.env` file in the root directory and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3000
   ```

### Running the Application
To start the application, run:
```
npm start
```
The server will start on `http://localhost:3000`.

### API Endpoints
- `POST /presents` - Create a new present
- `GET /presents` - Retrieve all presents
- `PUT /presents/:id` - Update a present
- `DELETE /presents/:id` - Delete a present

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.
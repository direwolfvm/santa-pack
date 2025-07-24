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
1. Copy `.env.example` to `.env` and adjust the Supabase credentials if needed:
   ```
   SUPABASE_URL=https://nlcisvrrkypadyjzsfnj.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY2lzdnJya3lwYWR5anpzZm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNDUzMTAsImV4cCI6MjA2NzgyMTMxMH0.QURkxMU1XcS7TfO1MFcs5wC3-A4Beon1Fc8A97QgJU4
   PORT=8080
   ```

### Running the Application
To start the application, run:
```
npm start
```
The server will start on `http://localhost:8080`.

If your environment requires an outbound HTTP(S) proxy, set `HTTP_PROXY` or
`HTTPS_PROXY` (or `GLOBAL_AGENT_HTTP_PROXY`) before starting the server. The
application uses `global-agent` to route requests through the proxy when these
variables are present.

### API Endpoints
- `POST /api/presents` - Create a new present
- `GET /api/presents` - Retrieve all presents
- `PUT /api/presents/:id` - Update a present
- `DELETE /api/presents/:id` - Delete a present
- `GET /api/families` - Retrieve all families
- `POST /api/families` - Create a family
- `GET /api/families/:familyId/gift-rounds` - Retrieve gift rounds for a family
- `POST /api/families/:familyId/gift-rounds` - Create a gift round for a family

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.

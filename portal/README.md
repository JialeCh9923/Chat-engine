# Chat Engine Tax Filing Portal

A comprehensive web application that demonstrates full integration with the Chat Engine Tax Filing API. This portal provides a modern, responsive interface for managing tax filing workflows, including document upload, AI-powered conversations, tax form management, and real-time updates.

## Features

### 🚀 Core Functionality
- **Authentication**: Secure API key management with local storage
- **Session Management**: Create, view, and manage tax filing sessions
- **Document Upload**: Drag-and-drop file upload with progress tracking
- **AI Conversations**: Chat interface for AI-powered tax assistance
- **Tax Forms**: Create, edit, and calculate tax forms
- **Real-time Updates**: Server-Sent Events (SSE) integration
- **Dashboard**: Comprehensive statistics and charts

### 📊 Dashboard & Analytics
- Activity overview charts (last 30 days)
- Status distribution visualization
- Task completion progress tracking
- Average processing time metrics
- Real-time event monitoring

### 🎨 User Interface
- Modern, responsive design
- Dark mode support
- Mobile-friendly layout
- Toast notifications
- Loading indicators
- Modal dialogs

## Quick Start

### 1. Start the API Server
```bash
# Navigate to the main project directory
cd c:\Users\jiale\OneDrive\Documents\Chat-engine

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 2. Open the Portal
1. Navigate to the portal directory
2. Open `index.html` in your web browser
3. Or serve it using a local web server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (install http-server globally first)
npm install -g http-server
http-server -p 8080
```

### 3. Connect to the API
1. Click "Connect API Key" in the header
2. Enter your API key (minimum 10 characters)
3. Click "Save API Key"
4. The portal will automatically test the connection

## Portal Structure

```
portal/
├── index.html          # Main portal HTML structure
├── styles.css          # Comprehensive CSS styling
├── api-client.js       # API client for all endpoints
├── app.js             # Main application logic
├── charts.js          # Dashboard charts and statistics
└── README.md          # This documentation
```

## API Integration

The portal integrates with all Chat Engine API endpoints:

### Health Checks
- `/health` - General API health
- Service-specific health checks for sessions, conversations, documents, jobs, tax forms, clients, and SSE

### Sessions
- Create, read, update, delete sessions
- Session statistics and overview
- Session selection and management

### Conversations
- Create and manage AI conversations
- Send and receive messages
- Real-time conversation updates

### Documents
- Drag-and-drop file upload
- Document processing status
- Document metadata management

### Tax Forms
- Create and edit tax forms
- Tax calculations and validation
- Form suggestions and imports/exports

### Jobs
- Job queue management
- Job progress tracking
- Job cancellation

### Real-time Updates
- Server-Sent Events integration
- Live status updates
- Event monitoring dashboard

## Usage Guide

### Getting Started
1. **Connect API Key**: Click the "Connect API Key" button and enter your API key
2. **Create Session**: Click "Create Session" to start a new tax filing session
3. **Upload Documents**: Drag and drop files onto the upload area
4. **Start Conversation**: Use the chat interface for AI assistance
5. **Create Tax Forms**: Click "Create Tax Form" to start a new form
6. **Monitor Progress**: Use the dashboard to track all activities

### Dashboard Features
- **Activity Chart**: Shows sessions, conversations, and jobs over the last 30 days
- **Status Distribution**: Visual breakdown of item statuses
- **Progress Chart**: Task completion rates by category
- **Timeline Chart**: Average processing times
- **Recent Items**: Quick access to recent sessions and jobs

### Session Management
- View all sessions with status and creation date
- Select active session for operations
- Edit session details
- Delete sessions

### Document Upload
- Drag-and-drop multiple files
- Real-time upload progress
- Supported formats: PDF, images, text files
- Automatic processing status updates

### Chat Interface
- Real-time AI conversations
- Message history
- Session-specific context
- Error handling and retry logic

### Tax Forms
- Create forms by type and tax year
- View form calculations and status
- Calculate taxes automatically
- Generate suggestions
- Export/import functionality

### Real-time Monitoring
- Live event stream via SSE
- Job progress updates
- Document processing notifications
- Conversation updates
- Session status changes

## Configuration

### API Client Configuration
```javascript
// In api-client.js
const api = new ChatEngineAPI({
    baseURL: 'http://localhost:3000/api', // Change to your API URL
    apiKey: 'your-api-key-here'
});
```

### Styling Customization
The portal uses CSS custom properties for easy theming:

```css
:root {
    --primary-color: #3b82f6;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
    --dark-bg: #1f2937;
    --dark-text: #f9fafb;
}
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Dependencies

### External Libraries
- **Chart.js** - For dashboard charts and statistics
- **Font Awesome** - For icons and symbols
- **Google Fonts** - For typography (Inter font)

### No Build Required
The portal uses vanilla JavaScript and doesn't require any build tools or bundlers. Simply open the HTML file in a browser or serve it with any static file server.

## Troubleshooting

### Connection Issues
- Ensure the API server is running
- Check the API URL in the configuration
- Verify the API key is correct
- Check browser console for detailed error messages

### Upload Issues
- Ensure files are within size limits
- Check file format support
- Verify session is selected
- Check network connectivity

### Real-time Updates Not Working
- Ensure SSE endpoint is accessible
- Check browser EventSource support
- Verify no firewall/proxy blocking SSE
- Check API server logs

### Charts Not Displaying
- Ensure Chart.js is loaded correctly
- Check browser console for JavaScript errors
- Verify data is being loaded properly
- Check for ad blockers that might block Chart.js

## Development

### Adding New Features
1. Add HTML structure to `index.html`
2. Add CSS styles to `styles.css`
3. Add API methods to `api-client.js`
4. Add application logic to `app.js`
5. Add chart functionality to `charts.js` if needed

### API Integration
The `api-client.js` file provides a comprehensive client for all API endpoints. Add new methods following the existing pattern:

```javascript
async newEndpointMethod(data) {
    return await this.request('/new-endpoint', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}
```

### Styling Guidelines
- Use CSS custom properties for colors
- Follow BEM-like naming for classes
- Ensure responsive design
- Test on multiple screen sizes
- Maintain consistent spacing and typography

## License

This portal is part of the Chat Engine Tax Filing project and follows the same licensing terms.
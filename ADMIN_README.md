# Admin Feedback Management

This application includes an admin feature that allows you to delete feedback messages. Only you (the admin) can access this functionality.

## How to Use Admin Features

### 1. Default Admin Credentials
- **Token**: `admin123`
- **Password**: `adminpass123`

### 2. How to Login as Admin
1. Go to the feedback section on the website
2. Click the "🔐 Admin Login" button
3. Enter the admin token when prompted
4. Enter the admin password when prompted
5. If credentials are correct, you'll see "Admin Mode Active"

### 3. How to Delete Feedback
1. After logging in as admin, you'll see all feedback with timestamps
2. Each feedback item will have a red "🗑️ Delete" button
3. Click the delete button next to any feedback you want to remove
4. Confirm the deletion when prompted
5. The feedback will be permanently removed

### 4. How to Logout
- Click the "Logout" button in the admin controls section

## Security Notes

⚠️ **IMPORTANT**: For production use, you should change the default admin credentials:

### Option 1: Environment Variables (Recommended)
Add these to your `.env` file:
```
ADMIN_TOKEN=your_secure_token_here
ADMIN_PASSWORD=your_secure_password_here
```

### Option 2: Direct Code Change
In `script.js`, change the `ADMIN_CREDENTIALS` object:
```javascript
const ADMIN_CREDENTIALS = {
    token: 'your_secure_token_here',
    password: 'your_secure_password_here'
};
```

In `server.js`, change the default values:
```javascript
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your_secure_token_here';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your_secure_password_here';
```

## Features

- ✅ Admin-only access to delete functionality
- ✅ Confirmation dialog before deletion
- ✅ Timestamp display for admin view
- ✅ Secure authentication system
- ✅ Persistent admin login (until logout)
- ✅ Clean, modern UI for admin interface

## Technical Details

- Admin authentication uses HTTP headers for security
- Feedback deletion is permanent and cannot be undone
- Admin session is stored in localStorage for convenience
- All admin functions are properly secured on both frontend and backend 
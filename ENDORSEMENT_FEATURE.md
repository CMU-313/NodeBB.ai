# Instructor Endorsement Feature

This feature allows instructors to endorse student or TA posts to provide authoritative confirmation and reduce confusion in community forums.

## Features

- **Instructor-Only Permission**: Only users in the "instructors" group can endorse posts
- **Cannot Endorse Own Posts**: Instructors cannot endorse their own posts
- **Visual Indicators**: Endorsed posts display a clear visual indicator
- **API Endpoints**: REST API endpoints for endorsing/unendorsing posts
- **Real-time Updates**: UI updates immediately when posts are endorsed/unendorsed

## API Endpoints

### Endorse a Post
```
PUT /api/v3/posts/:pid/endorse
```

### Unendorse a Post
```
DELETE /api/v3/posts/:pid/endorse
```

### Get Endorsement Status
```
GET /api/v3/posts/:pid/endorse
```

## Database Schema

The following fields are added to posts:
- `endorsed` (integer): 1 if endorsed, 0 if not
- `endorsedBy` (integer): UID of the instructor who endorsed the post
- `endorsedTimestamp` (integer): Unix timestamp when the post was endorsed

## Installation

1. The feature requires the "instructors" group to be created
2. Add users to the instructors group via the admin panel
3. The database migration will automatically create the instructors group

## Usage

1. **For Instructors**: 
   - View any topic with student/TA posts
   - Click the endorsement button (check circle icon) next to posts you want to endorse
   - Click again to remove endorsement

2. **For Students/TAs**:
   - See endorsed posts with a green "Instructor Endorsed" badge
   - Hover over the badge to see which instructor endorsed the post

## Files Modified

### Backend
- `src/posts/endorsement.js` - Core endorsement functionality
- `src/posts/data.js` - Database field definitions
- `src/posts/index.js` - Module loading
- `src/privileges/posts.js` - Endorsement privilege checks
- `src/privileges/users.js` - Instructor group check
- `src/user/index.js` - User privilege functions
- `src/topics/posts.js` - Post data enhancement
- `src/privileges/topics.js` - Topic privilege display
- `src/api/posts.js` - API endpoint implementations
- `src/controllers/write/posts.js` - HTTP controllers
- `src/routes/write/posts.js` - Route definitions
- `src/upgrades/1727697600000.js` - Database migration

### Frontend
- `build/public/templates/topic.tpl` - Template modifications
- `public/src/client/topic/postTools.js` - Client-side functionality
- `public/language/en-GB/topic.json` - UI text
- `public/language/en-GB/error.json` - Error messages

## Testing

To test the feature:
1. Create an instructor user and add them to the "instructors" group
2. Log in as the instructor
3. Navigate to any topic with posts
4. Verify that endorsement buttons appear next to other users' posts
5. Test endorsing and unendorsing posts
6. Verify the visual indicators appear correctly
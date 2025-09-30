# Anonymous Posting Feature

## Overview
This feature allows NodeBB users to post topics and replies anonymously. When a post is marked as anonymous, the author's username is hidden and replaced with "Anonymous".

## Implementation Details

### Backend Changes

#### 1. Post Creation (`src/posts/create.js`)
- Added support for `anonymous` field in post data
- When `data.anonymous` is truthy, the post is stored with `anonymous: 1` in the database

#### 2. Post Data Structure (`src/posts/data.js`)
- Added `anonymous` to the list of integer fields
- Ensures the anonymous flag is properly parsed from the database

#### 3. Post Display (`src/posts/summary.js`)
- Added `anonymous` to the fields retrieved when getting post summaries
- Modified post processing to replace user information with anonymous data when `post.anonymous === 1`
- Anonymous posts display:
  - Username: "Anonymous"
  - Display name: "Anonymous"
  - User slug: "anonymous"
  - UID: 0 (guest)
  - No profile picture
  - Status: offline

### API Usage

To create an anonymous post, include the `anonymous` field in the post data:

#### Anonymous Topic
```javascript
POST /api/v3/topics
{
  "cid": 1,
  "title": "My Anonymous Question",
  "content": "I have a question but want to remain anonymous",
  "anonymous": true
}
```

#### Anonymous Reply
```javascript
POST /api/v3/topics/:tid
{
  "content": "This is my anonymous reply",
  "anonymous": true
}
```

### Testing

A comprehensive test suite has been added in `test/anonymous-posts.js` that verifies:
1. Anonymous topics can be created
2. Anonymous replies can be created
3. Anonymous posts display "Anonymous" as the username
4. Non-anonymous posts continue to display the actual username

Run the tests with:
```bash
npm test -- --grep "Anonymous Posts"
```

## Future Enhancements

### UI Integration
To make this feature user-friendly, the following UI enhancements should be added:

1. **Composer Checkbox**
   - Add a checkbox in the composer (post/reply form) to allow users to opt-in to anonymous posting
   - Label: "Post anonymously"
   - This would require modifying the composer plugin or creating a custom plugin

2. **Visual Indicators**
   - Add an icon or badge to anonymous posts in topic lists and post views
   - Help users understand which posts are anonymous

3. **User Settings**
   - Allow users to set a preference for default anonymous posting behavior
   - Add option to always post anonymously in certain categories

4. **Moderation Tools**
   - Add ability for moderators/admins to reveal the true author of anonymous posts
   - Store the original UID securely while displaying anonymously

### Security Considerations

1. **True Author Tracking**
   - The current implementation preserves the original `uid` in the database
   - This allows moderators to track who made anonymous posts if needed
   - Consider adding a `originalUid` field for better separation

2. **Abuse Prevention**
   - Consider adding rate limiting for anonymous posts
   - Allow categories to disable anonymous posting
   - Add reputation requirements for anonymous posting

3. **Privacy**
   - Ensure anonymous posts don't leak user information through other metadata
   - Review notification systems to avoid revealing anonymous poster identity
   - Check if voting/reactions preserve anonymity

## Files Modified

1. `src/posts/create.js` - Added anonymous flag storage
2. `src/posts/data.js` - Added anonymous to integer fields
3. `src/posts/summary.js` - Added anonymous user display logic
4. `test/anonymous-posts.js` - Added comprehensive test suite

## Database Schema

No database migration is required. The `anonymous` field is stored as an integer (0 or 1) in the post object in Redis/MongoDB:

```
post:<pid> {
  pid: <number>,
  uid: <number>,  // Original author UID (preserved)
  content: <string>,
  anonymous: 1,   // NEW: 1 for anonymous, 0 or undefined for normal
  ...
}
```

## Usage Example

```javascript
// Create an anonymous topic programmatically
const topics = require('./src/topics');

const result = await topics.post({
  uid: userId,
  cid: categoryId,
  title: 'My Anonymous Question',
  content: 'This is posted anonymously',
  anonymous: true  // Enable anonymous mode
});

// Result will have anonymous flag set
console.log(result.postData.anonymous); // 1

// When retrieved, user info will show as Anonymous
const posts = require('./src/posts');
const postSummary = await posts.getPostSummaryByPids([result.postData.pid], userId, {});
console.log(postSummary[0].user.username); // "Anonymous"
```
